// src/pages/community/index.tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

interface CommunityListItem {
  id: string;
  title: string;
  description: string;
  ownerEmail: string;
  totalTasksPrice: number;
  platformFeePercent: number;
  tasksCount: number;
  publishedAt?: string;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);

const formatDate = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function CommunityIndexPage() {
  const [projects, setProjects] = useState<CommunityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/community/projects`);

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error || 'No se pudieron cargar los proyectos de comunidad'
          );
        }

        const data = (await res.json()) as CommunityListItem[];
        setProjects(data);
      } catch (err: any) {
        console.error('[community-index] Error cargando proyectos', err);
        setError(
          err.message || 'No se pudieron cargar los proyectos de comunidad'
        );
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-lg font-semibold text-slate-700">
          Cargando proyectos de la comunidad…
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="mb-2 text-xl font-bold text-slate-900">
            No se pudieron cargar los proyectos
          </h1>
          <p className="mb-4 text-slate-600">{error}</p>
          <Link
            href="/tools/dashboard"
            className="inline-flex justify-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Volver al dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Comunidad
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Proyectos publicados
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Explora proyectos de otros usuarios y elige tareas en las que
              colaborar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/tools/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Volver al dashboard
            </Link>
            <Link
              href="/tools/generator"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Crear nuevo proyecto
            </Link>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-600">
              Todavía no hay proyectos publicados en la comunidad.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Genera un proyecto desde el generador de tareas y publícalo para
              que otros desarrolladores puedan colaborar.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/community/${project.id}`}
                className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:-translate-y-1 hover:shadow-md hover:ring-blue-400 transition"
              >
                <h2 className="mb-1 line-clamp-2 text-sm font-semibold text-slate-900">
                  {project.title}
                </h2>
                <p className="mb-3 line-clamp-3 text-xs text-slate-600">
                  {project.description}
                </p>
                <p className="mb-2 text-[11px] text-slate-500">
                  Publicado por{' '}
                  <span className="font-medium">
                    {project.ownerEmail}
                  </span>
                  {project.publishedAt && (
                    <>
                      {' · '}
                      {formatDate(project.publishedAt)}
                    </>
                  )}
                </p>
                <div className="mt-auto flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Tareas:{' '}
                    <span className="font-semibold">
                      {project.tasksCount}
                    </span>
                  </span>
                  <span>
                    Presupuesto:{' '}
                    <span className="font-semibold">
                      {formatPrice(project.totalTasksPrice || 0)}
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
