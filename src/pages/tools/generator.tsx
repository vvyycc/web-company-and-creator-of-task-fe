// src/pages/tools/generator.tsx
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

type TaskComplexity = 'SIMPLE' | 'MEDIUM' | 'HIGH';

type TaskCategory =
  | 'ARCHITECTURE'
  | 'MODEL'
  | 'SERVICE'
  | 'VIEW'
  | 'INFRA'
  | 'QA';

type ColumnId = 'todo' | 'doing' | 'done';

export interface GeneratedTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  complexity: TaskComplexity;
  priority: number;
  estimatedHours: number; // puede venir vacío en la práctica
  hourlyRate: number;
  taskPrice: number;
  // alias legacy
  layer?: TaskCategory;
  price?: number;
  developerNetPrice?: number;
  // board
  columnId?: ColumnId;
  assigneeEmail?: string | null;
  assigneeAvatar?: string | null;
}

export interface ProjectEstimation {
  id?: string;
  projectTitle: string;
  projectDescription: string;
  ownerEmail: string;
  tasks: GeneratedTask[];
  totalHours: number;
  totalTasksPrice: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  generatorServiceFee?: number;
  generatorFee?: number;
  grandTotalClientCost: number;
  published?: boolean;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);

const safeNumber = (v: unknown): number =>
  typeof v === 'number' && !Number.isNaN(v) ? v : 0;

// 🔹 Calcula las horas de una tarea usando estimatedHours o (precio/tarifa)
const getTaskHours = (task: GeneratedTask): number => {
  const explicit =
    typeof task.estimatedHours === 'number' && !Number.isNaN(task.estimatedHours)
      ? task.estimatedHours
      : undefined;

  if (explicit !== undefined) return explicit;

  const rate =
    typeof task.hourlyRate === 'number' &&
    !Number.isNaN(task.hourlyRate) &&
    task.hourlyRate > 0
      ? task.hourlyRate
      : 30;

  const rawPrice =
    typeof task.taskPrice === 'number' && !Number.isNaN(task.taskPrice)
      ? task.taskPrice
      : typeof task.price === 'number' && !Number.isNaN(task.price)
      ? task.price
      : 0;

  return rawPrice / rate;
};

export default function GeneratorPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [estimation, setEstimation] = useState<ProjectEstimation | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      setOwnerEmail(session.user.email);
    }
  }, [session?.user?.email]);

  // ✅ Total horas: usa estimation.totalHours si es > 0,
  // si no, las recalcula a partir de las tareas.
  const totalHours = useMemo(() => {
    if (!estimation) return 0;

    const total = safeNumber(estimation.totalHours);
    if (total > 0) return total;

    if (!Array.isArray(estimation.tasks)) return 0;

    return estimation.tasks.reduce((sum, t) => sum + getTaskHours(t), 0);
  }, [estimation]);

  // ✅ Total tareas: si el backend lo manda a 0 tras regenerar,
  // lo recalculamos SIEMPRE desde tasks (que es la fuente real).
  const totalTasksPrice = useMemo(() => {
    if (!estimation) return 0;

    const backendTotal = safeNumber(estimation.totalTasksPrice);
    if (backendTotal > 0) return backendTotal;

    if (!Array.isArray(estimation.tasks)) return 0;

    return estimation.tasks.reduce(
      (sum, t) => sum + safeNumber(t.taskPrice ?? t.price ?? 0),
      0
    );
  }, [estimation]);

  // ✅ Fuerza 1% si viene vacío/0
  const platformFeePercent = useMemo(() => {
    if (!estimation) return 1;
    const pf = safeNumber(estimation.platformFeePercent);
    return pf > 0 ? pf : 1;
  }, [estimation]);

  // ✅ Comisión: derivada del totalTasksPrice (robusto)
  const platformFeeAmount = useMemo(() => {
    const amount = (totalTasksPrice * platformFeePercent) / 100;
    return +amount.toFixed(2);
  }, [totalTasksPrice, platformFeePercent]);

  // ✅ Total cliente: derivado (robusto)
  const grandTotalClientCost = useMemo(() => {
    const backend = safeNumber(estimation?.grandTotalClientCost);
    // Si backend viene bien y es >0, puedes usarlo; si no, recomputa
    if (backend > 0) return backend;
    return +(totalTasksPrice + platformFeeAmount).toFixed(2);
  }, [estimation?.grandTotalClientCost, totalTasksPrice, platformFeeAmount]);

  const handleGenerateTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      setPublishError(null);
      setEstimation(null);

      const res = await fetch(`${API_BASE}/projects/generate-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail,
          projectTitle,
          projectDescription,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error(
          '[generator] Error HTTP generando tareas',
          res.status,
          data
        );

        if (res.status === 402 && data?.error === 'subscription_required') {
          setError(
            data.message ??
              'Necesitas una suscripción activa de 30 €/mes para usar el generador.'
          );
          return;
        }

        throw new Error(
          data.error || 'No se pudo generar el troceado de tareas'
        );
      }

      const data = (await res.json()) as { project: ProjectEstimation };

      // ✅ Normalización defensiva mínima (por si el backend manda percent=0 o totales vacíos)
      const proj = data.project;
      const fixed: ProjectEstimation = {
        ...proj,
        platformFeePercent:
          safeNumber(proj.platformFeePercent) > 0 ? proj.platformFeePercent : 1,
      };

      setEstimation(fixed);
    } catch (err: any) {
      console.error('[generator] Error generando tareas', err);
      setError(
        err.message ||
          'No se pudo generar el troceado de tareas. Inténtalo de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePublishToCommunity = async () => {
    if (!estimation) return;

    try {
      setPublishing(true);
      setPublishError(null);

      const ownerEmailResolved =
        (estimation as any).ownerEmail || session?.user?.email || null;

      const projectTitleResolved =
        (estimation as any).projectTitle || (estimation as any).title || null;

      const projectDescriptionResolved =
        (estimation as any).projectDescription ||
        (estimation as any).description ||
        null;

      if (!ownerEmailResolved || !projectTitleResolved || !projectDescriptionResolved) {
        setPublishError('Faltan datos para publicar (email/título/descripción).');
        return;
      }

      // ✅ payload coherente (incluye totales recalculados)
      const estimationPayload = {
        ...estimation,
        ownerEmail: ownerEmailResolved,
        projectTitle: projectTitleResolved,
        projectDescription: projectDescriptionResolved,
        platformFeePercent,
        totalTasksPrice,
        platformFeeAmount,
        grandTotalClientCost,
      };

      const res = await fetch(`${API_BASE}/community/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail: ownerEmailResolved,
          projectTitle: projectTitleResolved,
          projectDescription: projectDescriptionResolved,
          estimation: estimationPayload,
        }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        console.error('[generator] Error HTTP publicando proyecto', res.status, data);
        throw new Error(data.error || 'No se pudo publicar el proyecto en la comunidad');
      }

      router.push(data.publicUrl || `/community/${data.id}`);
    } catch (err: any) {
      console.error('[generator] Error publishing project', err);
      setPublishError(err.message || 'No se pudo publicar el proyecto en la comunidad');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Cabecera + volver al dashboard */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Generador de tareas y presupuesto
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Divide tu proyecto en tareas con prioridad, capa técnica y precio
              estimado. La tarifa base de trabajo es de 30 €/h y la plataforma
              aplica un 1% de comisión sobre el presupuesto de las tareas.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
          >
            Volver al dashboard
          </Link>
        </div>

        {/* Formulario */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Título del proyecto
              </label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Ej: Automatización de correos con diccionario"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Descripción del proyecto
              </label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={5}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Describe qué quieres automatizar, qué actores intervienen, qué flujos hay, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Email del propietario
              </label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="tu-email@empresa.com"
              />
              <p className="mt-1 text-xs text-slate-500">
                Usaremos este email para asociar el proyecto generado.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              Este servicio está disponible mediante una suscripción de{' '}
              <span className="font-semibold">30 €/mes</span> para convertir tu
              idea en un plan detallado de trabajo. La tarifa técnica base es de{' '}
              <span className="font-semibold">30 €/h</span> y la plataforma
              aplicará un <span className="font-semibold">1%</span> de comisión
              sobre el presupuesto de tareas generado.
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerateTasks}
                disabled={
                  loading || !projectTitle || !projectDescription || !ownerEmail
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading
                  ? 'Generando tareas…'
                  : estimation
                  ? 'Regenerar tareas'
                  : 'Generar tareas'}
              </button>
            </div>
          </div>
        </section>

        {/* Resultado */}
        {estimation && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Resultado
            </h2>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              {estimation.projectTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-700">
              {estimation.projectDescription}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              La plataforma actúa como intermediaria entre el cliente y los
              programadores. El presupuesto mostrado incluye un 1% de comisión
              de plataforma. El generador se paga mediante suscripción mensual,
              no se añade fee extra por proyecto.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                    <th className="px-4 py-2">Título</th>
                    <th className="px-4 py-2">Descripción</th>
                    <th className="px-4 py-2">Categoría</th>
                    <th className="px-4 py-2">Complejidad</th>
                    <th className="px-4 py-2">Prioridad</th>
                    <th className="px-4 py-2">Horas</th>
                    <th className="px-4 py-2">Tarifa</th>
                    <th className="px-4 py-2">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {estimation.tasks.map((task, index) => (
                    <tr
                      key={task.id ?? index}
                      className="border-b border-slate-100 align-top"
                    >
                      <td className="px-4 py-2 font-semibold text-slate-900">
                        {task.title}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {task.description}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {task.category}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {task.complexity}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {task.priority}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {getTaskHours(task).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {Number(task.hourlyRate ?? 30).toFixed(2)} € / h
                      </td>
                      <td className="px-4 py-2 text-slate-900">
                        {formatPrice(Number(task.taskPrice ?? task.price ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
              <p>
                Horas totales estimadas:{' '}
                <span className="font-semibold">{totalHours.toFixed(2)}</span>
              </p>
              <p>
                Presupuesto tareas:{' '}
                <span className="font-semibold">{formatPrice(totalTasksPrice)}</span>
              </p>
              <p>
                Comisión plataforma ({platformFeePercent}%):{' '}
                <span className="font-semibold">{formatPrice(platformFeeAmount)}</span>
              </p>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Coste total estimado para el cliente:{' '}
              <span className="font-semibold">{formatPrice(grandTotalClientCost)}</span>
            </p>

            {publishError && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {publishError}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handlePublishToCommunity}
                disabled={publishing}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 md:w-auto"
              >
                {publishing
                  ? 'Publicando proyecto…'
                  : 'Publicar este proyecto en la comunidad'}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
