import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import CommunityProjectError from '@/components/CommunityProjectError';

type CommunityTask = {
  id?: string;
  title: string;
  description?: string;
  layer?: string;
  priority?: number;
  estimatedHours?: number;
  taskPrice?: number;
};

type CommunityProject = {
  id: string;
  title: string;
  description?: string;
  tasks?: CommunityTask[];
  totalTasksPrice: number;
  platformFeePercent: number;
  publishedAt?: string;
};

const API_BASE = 'http://localhost:4000';

export default function CommunityProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject] = useState<CommunityProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  useEffect(() => {
    if (!router.isReady || typeof id !== 'string') return;

    const fetchProject = async () => {
      try {
        setLoading(true);
        setErrorCode(null);

        const res = await fetch(`${API_BASE}/community/projects/${id}`);

        if (res.status === 404) {
          setProject(null);
          setErrorCode(404);
          return;
        }

        if (!res.ok) {
          setErrorCode(500);
          return;
        }

        const data = await res.json();
        setProject(data.project ?? data);
      } catch (err) {
        console.error('[community] Error fetching project', err);
        setErrorCode(500);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id, router.isReady]);

  const derivedData = useMemo(() => {
    const tasks = project?.tasks ?? [];
    const totalTasksPrice = project?.totalTasksPrice ?? 0;
    const platformFeePercent = project?.platformFeePercent ?? 1;

    return {
      tasks,
      totalTasksPrice,
      platformFeePercent,
    };
  }, [project]);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString() : 'Fecha no disponible';

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-700">Cargando proyecto…</p>
      </main>
    );
  }

  if (errorCode === 404) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <CommunityProjectError />
        </div>
      </main>
    );
  }

  if (errorCode === 500) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-red-600">Error al cargar el proyecto. Intenta de nuevo más tarde.</p>
      </main>
    );
  }

  if (!project) return null;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Comunidad</p>
          <h1 className="text-3xl font-bold text-slate-900">{project.title}</h1>
          <p className="text-slate-700">{project.description}</p>
          <p className="text-sm text-slate-500">Publicado el {formatDate(project.publishedAt)}</p>
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
                  <th className="px-4 py-2 font-semibold text-slate-700">Capa</th>
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
                    <td className="px-4 py-2 text-slate-700">{task.layer ?? '—'}</td>
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
            Presupuesto tareas: <strong>{formatPrice(derivedData.totalTasksPrice)}</strong>
          </div>
          <div>
            Comisión plataforma: <strong>{derivedData.platformFeePercent}%</strong>
          </div>
        </div>
      </div>
    </main>
  );
}
