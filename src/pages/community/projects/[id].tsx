import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import CommunityProjectError from '@/components/CommunityProjectError';

type CommunityTask = {
  id?: string;
  title: string;
  description?: string;
  category?: string;
  complexity?: string;
  priority?: number;
  estimatedHours?: number;
  hourlyRate?: number;
  taskPrice?: number;
};

type CommunityProject = {
  id: string;
  projectTitle: string;
  projectDescription?: string;
  tasks?: CommunityTask[];
  estimation?: {
    tasks?: CommunityTask[];
    totalTasksPrice?: number;
    totalHours?: number;
    platformFeePercent?: number;
    platformFeeAmount?: number;
    grandTotalClientCost?: number;
  };
  totalTasksPrice?: number;
  totalHours?: number;
  platformFeePercent?: number;
  platformFeeAmount?: number;
  grandTotalClientCost?: number;
};

export default function CommunityProjectDetailPage() {
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject] = useState<CommunityProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (typeof id !== 'string') return;

    const fetchProject = async () => {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);

        const res = await fetch(`${API_BASE}/community/projects/${id}`);

        if (res.status === 404) {
          setNotFound(true);
          return;
        }

        if (!res.ok) {
          throw new Error('No se pudo cargar el proyecto de la comunidad.');
        }

        const data = await res.json();
        setProject(data.project ?? data);
      } catch (err: any) {
        console.error('[community] Error fetching project', err);
        setError(err.message || 'Error al cargar el proyecto.');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [API_BASE, id, router.isReady]);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

  const derivedData = useMemo(() => {
    const tasks = project?.estimation?.tasks ?? project?.tasks ?? [];
    const totalTasksPrice =
      project?.estimation?.totalTasksPrice ??
      project?.totalTasksPrice ??
      tasks.reduce((sum, task) => sum + (task.taskPrice ?? 0), 0);
    const totalHours =
      project?.estimation?.totalHours ??
      project?.totalHours ??
      tasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
    const platformFeePercent = project?.estimation?.platformFeePercent ?? project?.platformFeePercent ?? 1;
    const platformFeeAmount =
      project?.estimation?.platformFeeAmount ?? (totalTasksPrice * platformFeePercent) / 100;
    const grandTotalClientCost =
      project?.estimation?.grandTotalClientCost ?? project?.grandTotalClientCost ?? totalTasksPrice + platformFeeAmount;

    return {
      tasks,
      totalTasksPrice,
      totalHours,
      platformFeePercent,
      platformFeeAmount,
      grandTotalClientCost,
    };
  }, [project]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-700">Cargando proyecto…</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <CommunityProjectError />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  if (!project) return null;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Comunidad</p>
          <h1 className="text-3xl font-bold text-slate-900">{project.projectTitle}</h1>
          <p className="text-slate-700">{project.projectDescription}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/community/projects/${project.id}/board`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Ver tablero
          </Link>
          <Link
            href="/community"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Volver al listado
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          {derivedData.tasks.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 font-semibold text-slate-700">Título</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Descripción</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Categoría</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Complejidad</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Prioridad</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Horas</th>
                  <th className="px-4 py-2 font-semibold text-slate-700">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {derivedData.tasks.map((task) => (
                  <tr key={task.id ?? task.title}>
                    <td className="px-4 py-2 text-slate-900">{task.title}</td>
                    <td className="px-4 py-2 text-slate-700">{task.description}</td>
                    <td className="px-4 py-2 text-slate-700">{task.category ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-700">{task.complexity ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-700">{task.priority ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-700">{task.estimatedHours ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-900">{formatPrice(task.taskPrice ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-4 text-sm text-slate-600">No hay tareas disponibles para este proyecto.</p>
          )}
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            Horas totales estimadas: <strong>{derivedData.totalHours}</strong>
          </div>
          <div>
            Presupuesto tareas: <strong>{formatPrice(derivedData.totalTasksPrice)}</strong>
          </div>
          <div>
            Comisión plataforma ({derivedData.platformFeePercent}%):{' '}
            <strong>{formatPrice(derivedData.platformFeeAmount)}</strong>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            Coste total estimado para el cliente:{' '}
            <strong>{formatPrice(derivedData.grandTotalClientCost)}</strong>
          </div>
        </div>
      </div>
    </main>
  );
}
