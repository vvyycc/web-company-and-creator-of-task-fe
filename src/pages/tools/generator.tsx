import { useCallback, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

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
  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [result, setResult] = useState<ProjectEstimation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const effectiveOwnerEmail = ownerEmail || (session?.user?.email as string) || '';

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

  useEffect(() => {
    if (!effectiveOwnerEmail) return;

    const checkSubscription = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/billing/me-subscription?email=${encodeURIComponent(effectiveOwnerEmail)}`
        );
        const data = await res.json();
        setHasActiveSubscription(data.hasActiveSubscription);
      } catch (err) {
        console.error('[generator] Error checking subscription', err);
        setHasActiveSubscription(false);
      }
    };

    checkSubscription();
  }, [API_BASE, effectiveOwnerEmail]);

  const actuallyGenerateTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setResult(null);
      const res = await fetch(`${API_BASE}/projects/generate-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle,
          projectDescription,
          ownerEmail: effectiveOwnerEmail,
        }),
      });

      if (res.status === 402) {
        const data = await res.json();
        setSubscriptionModalOpen(true);
        setStripeError(data.message || 'Necesitas una suscripción activa para generar tareas.');
        return;
      }

      if (!res.ok) {
        throw new Error('No se pudo generar el troceado');
      }

      const data: ProjectEstimation = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error('[generator] Error generating tasks', err);
      setError(err.message || 'Error al generar tareas.');
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE, effectiveOwnerEmail, projectDescription, projectTitle]);

  const handleGenerate = async () => {
    setStripeError(null);

    if (!hasActiveSubscription) {
      setSubscriptionModalOpen(true);
      return;
    }

    await actuallyGenerateTasks();
  };

  const handlePublishToCommunity = async () => {
    if (!result) return;
    try {
      const res = await fetch(`${API_BASE}/community/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail: effectiveOwnerEmail,
          projectTitle: result.projectTitle,
          projectDescription: result.projectDescription,
          estimation: result,
        }),
      });

      if (!res.ok) throw new Error('No se pudo publicar el proyecto');

      // TODO: mostrar mensaje de éxito o redirigir
    } catch (err) {
      console.error('[generator] Error publishing project', err);
      setError('No se pudo publicar el proyecto');
    }
  };

  useEffect(() => {
    if (router.query.status === 'subscription_success' && effectiveOwnerEmail) {
      const refreshSubscription = async () => {
        try {
          const res = await fetch(
            `${API_BASE}/billing/me-subscription?email=${encodeURIComponent(effectiveOwnerEmail)}`
          );
          const data = await res.json();
          setHasActiveSubscription(data.hasActiveSubscription);
          if (data.hasActiveSubscription && projectTitle && projectDescription) {
            await actuallyGenerateTasks();
          }
        } catch (err) {
          console.error('[generator] Error refreshing subscription after checkout', err);
        }
      };

      refreshSubscription();
    }
  }, [API_BASE, actuallyGenerateTasks, effectiveOwnerEmail, projectDescription, projectTitle, router.query.status]);

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
            30 €/h, la plataforma cobra un 1% de comisión sobre el presupuesto del proyecto y el servicio de generación
            y troceado está disponible con una suscripción de 30 €/mes.
          </p>
          <p className="text-sm text-slate-600">
            Te mostraremos el desglose completo de tareas, horas y precios con desglose de comisiones y tarifas. La
            plataforma actúa como intermediaria entre clientes y programadores.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleGenerate();
          }}
          className="grid gap-6 rounded-xl border border-slate-200 p-6"
        >
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
              Este servicio está disponible mediante una suscripción de <strong>30 €/mes</strong> para convertir tu idea
              en un plan detallado de trabajo.
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

          {(error || stripeError) && (
            <p className="text-sm text-red-600">{error || stripeError}</p>
          )}
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
              {result && result.tasks && result.tasks.length > 0 && (
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
              )}
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
              onClick={handlePublishToCommunity}
              className="mt-4 w-full rounded-lg border border-primary-500 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
            >
              Publicar este proyecto en la comunidad
            </button>
          </div>
        )}

        <SubscriptionModal
          open={isSubscriptionModalOpen}
          onClose={() => setSubscriptionModalOpen(false)}
          email={effectiveOwnerEmail}
        />
      </div>
    </main>
  );
}

function SubscriptionModal({
  open,
  onClose,
  email,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
}) {
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubscribe = async () => {
    try {
      setIsRedirecting(true);
      setError(null);

      const res = await fetch(`${API_BASE}/billing/create-subscription-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error('No se pudo iniciar la suscripción');

      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      console.error('[subscription] Error creating session', err);
      setError('No se pudo iniciar la suscripción. Inténtalo de nuevo.');
      setIsRedirecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-xl font-semibold text-slate-900">Suscríbete para usar el generador</h2>
        <p className="mb-4 text-sm text-slate-600">
          El generador de tareas y presupuesto está disponible mediante una suscripción de <strong>30 €/mes</strong>.
          La plataforma conecta clientes y programadores y convierte tu idea en un plan detallado de trabajo.
        </p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Cancelar
          </button>
          <button onClick={handleSubscribe} disabled={isRedirecting} className="btn-primary">
            {isRedirecting ? 'Redirigiendo a Stripe…' : 'Suscribirme por 30 €/mes'}
          </button>
        </div>
      </div>
    </div>
  );
}
