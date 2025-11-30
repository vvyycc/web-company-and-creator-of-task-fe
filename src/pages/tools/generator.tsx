import { FormEvent, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';

type TaskComplexity = 'SIMPLE' | 'MEDIUM' | 'HIGH';

type TaskCategory = 'ARCHITECTURE' | 'MODEL' | 'SERVICE' | 'VIEW' | 'INFRA' | 'QA';

interface GeneratedTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  complexity: TaskComplexity;
  priority: number;
  estimatedHours: number;
  hourlyRate: number;
  taskPrice: number;
}

interface ProjectEstimation {
  projectTitle: string;
  projectDescription: string;
  ownerEmail: string;
  tasks: GeneratedTask[];
  totalHours: number;
  totalTasksPrice: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  generatorServiceFee: number;
  grandTotalClientCost: number;
}

export default function GeneratorPage() {
  const { data: session, status } = useSession();
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [result, setResult] = useState<ProjectEstimation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/projects/generate-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectTitle,
          projectDescription,
          ownerEmail: ownerEmail || session?.user?.email,
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo generar el proyecto. Inténtalo de nuevo.');
      }

      const data = (await response.json()) as ProjectEstimation;
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error al generar tareas.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayGeneratorFee = async () => {
    setIsPaying(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/stripe/checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerEmail: ownerEmail || session?.user?.email,
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo iniciar el pago en Stripe.');
      }

      const sessionData = await response.json();

      if (sessionData?.url) {
        window.location.href = sessionData.url;
      } else {
        throw new Error('No se obtuvo la URL de pago de Stripe.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago.');
    } finally {
      setIsPaying(false);
    }
  };

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-lg font-semibold text-slate-700">Cargando…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-4 text-2xl font-bold text-slate-900">Acceso restringido</h1>
          <p className="mb-4 text-slate-600">
            Necesitas iniciar sesión con Google para usar el generador de tareas.
          </p>
          <button
            onClick={() => signIn('google')}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Iniciar sesión con Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-8 rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Herramienta</p>
          <h1 className="text-3xl font-bold text-slate-900">Generador de tareas y presupuesto</h1>
          <p className="text-slate-600">
            Divide tu proyecto en tareas con prioridad, capa técnica y precio estimado. La tarifa base de trabajo es de
            30 €/h. La plataforma cobra un 1% de comisión sobre el presupuesto del proyecto y el servicio de generación
            y troceado tiene un fee fijo de 30 €.
          </p>
          <p className="text-sm text-slate-600">
            Te mostraremos el desglose completo de tareas, horas y precios antes de que realices el pago del servicio de
            generación.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 rounded-xl border border-slate-200 p-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800" htmlFor="title">
              Título del proyecto
            </label>
            <input
              id="title"
              name="title"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Ej. Automatización de flujos Web3"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800" htmlFor="description">
              Descripción del proyecto
            </label>
            <textarea
              id="description"
              name="description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              required
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Describe las necesidades, el stack o los objetivos principales"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800" htmlFor="ownerEmail">
              Email del propietario
            </label>
            <input
              id="ownerEmail"
              name="ownerEmail"
              type="email"
              value={ownerEmail || session.user?.email || ''}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
              disabled={Boolean(session.user?.email && !ownerEmail)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-slate-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder="tu@email.com"
            />
            <p className="text-xs text-slate-500">Usaremos este email para asociar el proyecto generado.</p>
          </div>

          <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              Este servicio tiene un precio fijo de <strong>30 €</strong> por convertir tu idea en un plan detallado de
              trabajo.
            </p>
            <p>
              La tarifa técnica base es de <strong>30 €/h</strong> y la plataforma aplicará un <strong>1%</strong> de
              comisión sobre el presupuesto del proyecto.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={isLoading}
          >
            {isLoading ? 'Generando tareas…' : 'Generar tareas'}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {result && (
          <div className="space-y-4 rounded-xl border border-slate-200 p-6">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Resultado</p>
              <h2 className="text-2xl font-bold text-slate-900">{result.projectTitle}</h2>
              <p className="text-slate-700">{result.projectDescription}</p>
              <p className="text-sm text-slate-600">
                La plataforma actúa como intermediaria entre el cliente y los programadores. El presupuesto mostrado
                incluye un 1% de comisión de plataforma y un fee fijo de 30 € por el servicio de generación de tareas.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-slate-700">Título</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Descripción</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Categoría</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Complejidad</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Prioridad</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Horas</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Tarifa</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result?.tasks?.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-semibold text-slate-900">{task.title}</td>
                      <td className="px-4 py-2 text-slate-700">{task.description}</td>
                      <td className="px-4 py-2 text-slate-700">{task.category}</td>
                      <td className="px-4 py-2 text-slate-700">{task.complexity}</td>
                      <td className="px-4 py-2 text-slate-700">{task.priority}</td>
                      <td className="px-4 py-2 text-slate-700">{task.estimatedHours}</td>
                      <td className="px-4 py-2 text-slate-700">{task.hourlyRate.toFixed(2)} € / h</td>
                      <td className="px-4 py-2 text-slate-900">{formatPrice(task.taskPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                Horas totales estimadas: <strong>{result.totalHours}</strong>
              </div>
              <div>
                Presupuesto tareas: <strong>{formatPrice(result.totalTasksPrice)}</strong>
              </div>
              <div>
                Comisión plataforma (1%): <strong>{formatPrice(result.platformFeeAmount)}</strong>
              </div>
              <div>
                Fee del generador: <strong>{formatPrice(result.generatorServiceFee)}</strong>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                Coste total estimado para el cliente:{' '}
                <strong>{formatPrice(result.grandTotalClientCost)}</strong>
              </div>
            </div>

            <button
              onClick={handlePayGeneratorFee}
              disabled={isPaying}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isPaying ? 'Redirigiendo a Stripe…' : 'Pagar 30 € para generar y publicar el proyecto'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
