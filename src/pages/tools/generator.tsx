import { FormEvent, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import RecommendedStackPanel, {
  RecommendedStack,
  StackCategory,
} from '../../components/RecommendedStackPanel';

type TaskComplexity = 'SIMPLE' | 'MEDIUM' | 'HIGH' | string;

type GeneratedTask = {
  id?: string;
  title: string;
  description: string;
  complexity?: TaskComplexity;
  hours?: number;
  price?: number;
  acceptanceCriteria?: string[];
};

type GenerateTasksResponse = {
  stack: RecommendedStack;
  tasks: GeneratedTask[];
};

const STACK_KEYS: StackCategory[] = ['frontend', 'backend', 'smartContracts', 'database', 'testing'];

const buildGenerateTasksUrl = () => {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '');
  return base ? `${base}/generate-tasks` : '/generate-tasks';
};

export default function GeneratorPage() {
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const [stackDraft, setStackDraft] = useState<RecommendedStack | null>(null);
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedCriteria({});
  }, [tasks]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStackDraft(null);
    setTasks([]);

    try {
      const response = await fetch(buildGenerateTasksUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle,
          projectDescription,
          ownerEmail,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as any)?.error || 'No se pudieron generar las tareas.');
      }

      const data = (await response.json()) as GenerateTasksResponse;
      const normalizedStack = STACK_KEYS.reduce<RecommendedStack>((acc, key) => {
        const incoming = data?.stack?.[key];
        acc[key] = Array.isArray(incoming) ? incoming : [];
        return acc;
      }, {});

      setStackDraft(normalizedStack);
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch (err: any) {
      setError(err?.message || 'Ha ocurrido un error inesperado generando las tareas.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCriteria = (taskId: string) => {
    setExpandedCriteria((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const hasResults = useMemo(() => Boolean(stackDraft && tasks.length > 0), [stackDraft, tasks]);

  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
      }),
    []
  );

  return (
    <>
      <Head>
        <title>Generador de tareas | Tools</title>
      </Head>
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl space-y-8">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Herramienta</p>
            <h1 className="text-3xl font-bold text-slate-900">Generador de tareas</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              Envía el título, descripción y email del propietario. El backend (OpenAI) devolverá el stack sugerido y
              las tareas técnicas. Todo se mantiene en estado local para que puedas revisar y editar antes de publicar.
            </p>
          </header>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-800">Título del proyecto</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    name="projectTitle"
                    value={projectTitle}
                    onChange={(event) => setProjectTitle(event.target.value)}
                    placeholder="Ej. Plataforma de automatización interna"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-800">Email del propietario</span>
                  <input
                    type="email"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    name="ownerEmail"
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    placeholder="nombre@empresa.com"
                    required
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-800">Descripción del proyecto</span>
                <textarea
                  className="min-h-[140px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  name="projectDescription"
                  value={projectDescription}
                  onChange={(event) => setProjectDescription(event.target.value)}
                  placeholder="Describe el problema, usuarios implicados, restricciones y entregables esperados."
                  required
                />
              </label>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {loading ? 'Generando…' : 'Generar tareas'}
                </button>
              </div>
            </form>
          </section>

          {hasResults && stackDraft && (
            <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
              <RecommendedStackPanel stack={stackDraft} onChange={setStackDraft} />

              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Tareas generadas</p>
                  <p className="text-sm text-slate-700">
                    Revisa cada tarea, su complejidad, esfuerzo estimado y precio. Los criterios de aceptación se pueden desplegar.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                        <th className="px-4 py-2">Título</th>
                        <th className="px-4 py-2">Descripción</th>
                        <th className="px-4 py-2">Complejidad</th>
                        <th className="px-4 py-2">Horas</th>
                        <th className="px-4 py-2">Precio</th>
                        <th className="px-4 py-2">Criterios de aceptación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task, index) => {
                        const taskId = task.id ?? `task-${index}`;
                        const criteria = task.acceptanceCriteria ?? [];
                        const isExpanded = expandedCriteria[taskId];

                        return (
                          <tr key={taskId} className="border-b border-slate-100 align-top">
                            <td className="px-4 py-3 font-semibold text-slate-900">{task.title}</td>
                            <td className="px-4 py-3 text-slate-700">{task.description}</td>
                            <td className="px-4 py-3 text-slate-700">{task.complexity ?? '—'}</td>
                            <td className="px-4 py-3 text-slate-700">{typeof task.hours === 'number' ? task.hours.toFixed(1) : '—'}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {typeof task.price === 'number' ? priceFormatter.format(task.price) : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              <div className="space-y-2">
                                <button
                                  type="button"
                                  onClick={() => toggleCriteria(taskId)}
                                  className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 transition hover:border-blue-200 hover:text-blue-700"
                                >
                                  {isExpanded ? 'Ocultar criterios' : `Ver criterios (${criteria.length})`}
                                </button>
                                {isExpanded && criteria.length > 0 && (
                                  <ul className="list-disc space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                    {criteria.map((criterion, cIndex) => (
                                      <li key={`${taskId}-criterion-${cIndex}`}>{criterion}</li>
                                    ))}
                                  </ul>
                                )}
                                {isExpanded && criteria.length === 0 && (
                                  <p className="text-xs text-slate-500">No hay criterios de aceptación disponibles.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
