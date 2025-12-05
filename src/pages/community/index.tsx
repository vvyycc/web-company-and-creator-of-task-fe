import Link from 'next/link';
import { useEffect, useState } from 'react';

type CommunityProject = {
  id: string;
  title: string;
  description?: string;
  totalTasksPrice: number;
  platformFeePercent: number;
  publishedAt: string;
  tasksCount: number;
};

const API_URL = 'http://localhost:4000/community/projects';

export default function CommunityProjectsPage() {
  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(false);

        const res = await fetch(API_URL);

        if (!res.ok) {
          if (res.status >= 500) {
            throw new Error('Server error');
          }
          setProjects([]);
          return;
        }

        const data = await res.json();
        const list: CommunityProject[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.projects)
          ? data.projects
          : [];

        setProjects(list);
      } catch (err) {
        console.error('[community] Error fetching projects', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const formatDate = (value: string) => new Date(value).toLocaleDateString();
  const formatPrice = (value: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  const truncate = (value = '') => (value.length > 120 ? `${value.slice(0, 120)}…` : value);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Proyectos de la comunidad</h1>
        </header>

        {loading && <p className="text-slate-700">Cargando proyectos de la comunidad…</p>}

        {error && (
          <p className="text-red-600">
            No se pudieron cargar los proyectos. Inténtalo de nuevo más tarde.
          </p>
        )}

        {!loading && !error && projects.length === 0 && (
          <p className="text-slate-700">Todavía no hay proyectos publicados en la comunidad.</p>
        )}

        {!loading && !error && projects.length > 0 && (
          <div>
            {projects.map((project) => (
              <div key={project.id} className="bg-white rounded-xl shadow p-6 mb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{project.title}</h2>
                    <p className="text-sm text-slate-700">{truncate(project.description)}</p>
                  </div>
                  <Link
                    href={`/community/projects/${project.id}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
                  >
                    Ver proyecto
                  </Link>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-800 sm:grid-cols-2 md:grid-cols-3">
                  <div>Nº de tareas: {project.tasksCount}</div>
                  <div>Presupuesto total: {formatPrice(project.totalTasksPrice)}</div>
                  <div>Comisión {project.platformFeePercent}%</div>
                  <div>Publicado el {formatDate(project.publishedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
