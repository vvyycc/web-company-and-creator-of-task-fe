import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type CommunityTask = {
  id?: string;
  title: string;
  description?: string;
  estimatedHours?: number;
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
    platformFeePercent?: number;
  };
  totalTasksPrice?: number;
  platformFeePercent?: number;
  createdAt?: string;
  publishedAt?: string;
};

export default function CommunityProjectsPage() {
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/community/projects`);
        if (!res.ok) {
          throw new Error('No se pudo cargar el listado de proyectos de la comunidad.');
        }

        const data = await res.json();
        const list: CommunityProject[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.projects)
          ? data.projects
          : [];

        setProjects(list);
      } catch (err: any) {
        console.error('[community] Error fetching projects', err);
        setError(err.message || 'Error al cargar los proyectos de la comunidad.');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [API_BASE]);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

  const formatDate = (value?: string) => {
    if (!value) return 'Fecha no disponible';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTasks = (project: CommunityProject) => project.tasks ?? project.estimation?.tasks ?? [];

  const projectsWithTotals = useMemo(
    () =>
      projects.map((project) => {
        const tasks = getTasks(project);
        const totalTasksPrice =
          project.totalTasksPrice ??
          project.estimation?.totalTasksPrice ??
          tasks.reduce((sum, task) => sum + (task.taskPrice ?? 0), 0);
        const platformFeePercent = project.platformFeePercent ?? project.estimation?.platformFeePercent ?? 1;
        const platformFeeAmount = (totalTasksPrice * platformFeePercent) / 100;

        return {
          ...project,
          tasks,
          totalTasksPrice,
          platformFeePercent,
          platformFeeAmount,
        };
      }),
    [projects]
  );

  const truncate = (value = '', maxLength = 120) =>
    value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Comunidad</p>
          <h1 className="text-3xl font-bold text-slate-900">Proyectos de la comunidad</h1>
          <p className="text-slate-600">
            Explora los proyectos publicados por la comunidad y descubre el desglose de tareas
            y presupuestos estimados.
          </p>
        </header>

        {loading && <p className="text-sm text-slate-600">Cargando proyectos…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && projectsWithTotals.length === 0 && (
          <p className="text-slate-700">
            Todavía no hay proyectos publicados en la comunidad.
          </p>
        )}

        {!loading && !error && projectsWithTotals.length > 0 && (
          <div className="grid gap-4">
            {projectsWithTotals.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-slate-900">{project.projectTitle}</h2>
                    <p className="text-sm text-slate-600">
                      {truncate(project.projectDescription, 120)}
                    </p>
                  </div>
                  <Link
                    href={`/community/projects/${project.id}`}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Ver proyecto
                  </Link>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 md:grid-cols-3">
                  <div>
                    <span className="font-semibold text-slate-900">Tareas:</span> {project.tasks?.length ?? 0}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Presupuesto tareas:</span>{' '}
                    {formatPrice(project.totalTasksPrice)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Comisión plataforma (1%):</span>{' '}
                    {formatPrice(project.platformFeeAmount)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Fecha de publicación:</span>{' '}
                    {formatDate(project.publishedAt ?? project.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
