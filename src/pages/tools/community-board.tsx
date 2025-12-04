import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

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
  columnId?: 'todo' | 'doing' | 'done';
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

interface CommunityProjectPayload {
  id: string;
  ownerEmail: string;
  projectTitle: string;
  projectDescription: string;
  estimation: ProjectEstimation;
  isPublished: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export default function CommunityBoardPage() {
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject] = useState<CommunityProjectPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchProject = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/community/projects/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error('[community-board] Error HTTP', res.status, data);
          throw new Error('No se pudo cargar el proyecto de la comunidad');
        }

        const data: CommunityProjectPayload = await res.json();
        setProject(data);
      } catch (err: any) {
        console.error('[community-board] Error cargando proyecto', err);
        setError(err.message || 'No se pudo cargar el proyecto');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-lg font-semibold text-slate-700">Cargando proyecto…</p>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-4 text-2xl font-bold text-slate-900">
            Proyecto de comunidad no disponible
          </h1>
          <p className="mb-4 text-slate-600">
            {error || 'No se pudo encontrar el proyecto solicitado.'}
          </p>
          <button
            onClick={() => router.push('/tools/generator')}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Volver al generador
          </button>
        </div>
      </main>
    );
  }

  const tasks = project.estimation?.tasks ?? [];

  // De momento todas las tareas empiezan en "Por hacer"
  const todo = tasks.sort((a, b) => a.priority - b.priority);
  const doing: GeneratedTask[] = [];
  const done: GeneratedTask[] = [];

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-2 rounded-2xl bg-white p-6 shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Proyecto en la comunidad
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            {project.projectTitle}
          </h1>
          <p className="text-slate-700">{project.projectDescription}</p>
          <p className="text-sm text-slate-500">
            Este tablero conecta a <strong>creadores de proyectos</strong> con{' '}
            <strong>programadores</strong>. Las tareas se pueden tomar de la columna
            &ldquo;Por hacer&rdquo;.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {/* Columna TODO */}
          <Column title="Por hacer" subtitle="Tareas disponibles para programadores">
            {todo.length === 0 && (
              <p className="text-sm text-slate-500">
                No hay tareas disponibles en este momento.
              </p>
            )}
            {todo.map((task) => (
              <TaskCard key={task.id} task={task} formatPrice={formatPrice} />
            ))}
          </Column>

          {/* Columna DOING */}
          <Column title="En progreso" subtitle="Tareas que alguien está realizando">
            {doing.length === 0 && (
              <p className="text-sm text-slate-500">Aún no hay tareas en progreso.</p>
            )}
            {doing.map((task) => (
              <TaskCard key={task.id} task={task} formatPrice={formatPrice} />
            ))}
          </Column>

          {/* Columna DONE */}
          <Column title="Hecho" subtitle="Tareas finalizadas">
            {done.length === 0 && (
              <p className="text-sm text-slate-500">Todavía no hay tareas completadas.</p>
            )}
            {done.map((task) => (
              <TaskCard key={task.id} task={task} formatPrice={formatPrice} />
            ))}
          </Column>
        </section>
      </div>
    </main>
  );
}

function Column({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-slate-50 p-4 shadow-sm">
      <div className="mb-3 border-b border-slate-200 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">{children}</div>
    </div>
  );
}

function TaskCard({
  task,
  formatPrice,
}: {
  task: GeneratedTask;
  formatPrice: (v: number) => string;
}) {
  const handleClaim = () => {
    console.log('[community-board] Tarea reclamada:', task.id, task.title);
    alert(
      `Aquí iría el flujo para reclamar la tarea:\n\n"${task.title}"\n\n(por ejemplo, login + enviar propuesta).`
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {task.category}
        </span>
      </div>
      <p className="text-xs text-slate-600">{task.description}</p>
      <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <span className="font-semibold">Prioridad:</span> {task.priority}
        </div>
        <div>
          <span className="font-semibold">Complejidad:</span> {task.complexity}
        </div>
        <div>
          <span className="font-semibold">Horas:</span> {task.estimatedHours}
        </div>
        <div>
          <span className="font-semibold">Precio:</span> {formatPrice(task.taskPrice)}
        </div>
      </div>
      <button
        onClick={handleClaim}
        className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
      >
        Quiero hacer esta tarea
      </button>
    </div>
  );
}
