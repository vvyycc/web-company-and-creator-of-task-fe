import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import CommunityProjectError from '@/components/CommunityProjectError';
import { useProjectSocket } from '@/hooks/useProjectSocket';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

type BoardTask = {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  status?: string;
  verificationStatus?: 'NOT_SUBMITTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  assigneeName?: string;
  assigneeEmail?: string;
  assignedToEmail?: string;
};

type Project = {
  id: string;
  ownerEmail?: string;
};

export default function ProjectReviewPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();

  const projectId = typeof id === 'string' ? id : undefined;

  const [project, setProject] = useState<Project | null>(null);
  const [pendingTasks, setPendingTasks] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [modalTask, setModalTask] = useState<BoardTask | null>(null);
  const [modalDecision, setModalDecision] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const resolveTaskId = useCallback((task?: Partial<BoardTask>) => {
    if (!task) return '';
    return task._id || task.id || '';
  }, []);

  useEffect(() => {
    if (!router.isReady || !projectId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);

        const [pendingRes, projectRes] = await Promise.all([
          fetch(`${API_BASE}/verification/projects/${projectId}/pending`),
          fetch(`${API_BASE}/community/projects/${projectId}`),
        ]);

        if (pendingRes.status === 404) {
          setNotFound(true);
          return;
        }

        if (!pendingRes.ok) {
          throw new Error('No se pudo cargar las tareas pendientes.');
        }

        if (projectRes.ok) {
          const projectData = await projectRes.json();
          setProject(projectData.project ?? projectData);
        }

        const data = await pendingRes.json();
        setPendingTasks(Array.isArray(data?.tasks) ? data.tasks : data || []);
      } catch (err: any) {
        console.error('[community] Error cargando revisión', err);
        setError(err.message || 'Error cargando las tareas pendientes.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, router.isReady]);

  const updateTask = useCallback(
    (updated: BoardTask | null | undefined) => {
      if (!updated) return;
      const taskId = resolveTaskId(updated);
      if (!taskId) return;

      setPendingTasks((prev) => {
        const idx = prev.findIndex((task) => resolveTaskId(task) === taskId);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...updated };
          return copy;
        }
        return [...prev, updated];
      });
    },
    [resolveTaskId]
  );

  const handleSocketEvent = useCallback(
    (task: BoardTask) => {
      updateTask(task);
    },
    [updateTask]
  );

  useProjectSocket(projectId, handleSocketEvent);

  const isReviewer = useMemo(
    () => !!project?.ownerEmail && project.ownerEmail === session?.user?.email,
    [project?.ownerEmail, session?.user?.email]
  );

  const canReviewTask = (task: BoardTask) =>
    task.status === 'IN_REVIEW' && task.verificationStatus === 'SUBMITTED';

  const handleReview = async () => {
    if (!modalTask || !modalDecision || !session?.user?.email) return;
    const taskId = resolveTaskId(modalTask);
    if (!taskId) return;

    try {
      setSaving(true);
      setModalError(null);
      const res = await fetch(`${API_BASE}/verification/tasks/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerEmail: session.user.email,
          approved: modalDecision === 'approve',
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo actualizar la verificación.');
      }

      const data = await res.json().catch(() => ({}));
      updateTask((data as any)?.task ?? data);
      setModalTask(null);
      setModalDecision(null);
      setNotes('');
    } catch (err: any) {
      console.error('[community] Error en revisión', err);
      setModalError(err.message || 'Error al procesar la revisión.');
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    const styles: Record<string, string> = {
      TODO: 'bg-slate-100 text-slate-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      IN_REVIEW: 'bg-amber-100 text-amber-800',
      DONE: 'bg-emerald-100 text-emerald-800',
      REJECTED: 'bg-red-100 text-red-800',
    };

    const labels: Record<string, string> = {
      TODO: 'Por hacer',
      IN_PROGRESS: 'En progreso',
      IN_REVIEW: 'En revisión',
      DONE: 'Finalizada',
      REJECTED: 'Rechazada',
    };

    return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const renderVerificationBadge = (verificationStatus?: string) => {
    if (!verificationStatus) return null;
    const styles: Record<string, string> = {
      NOT_SUBMITTED: 'bg-slate-200 text-slate-800',
      SUBMITTED: 'bg-amber-100 text-amber-800',
      APPROVED: 'bg-emerald-100 text-emerald-800',
      REJECTED: 'bg-red-100 text-red-800',
    };

    const labels: Record<string, string> = {
      NOT_SUBMITTED: 'Sin enviar',
      SUBMITTED: 'Enviado',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
    };

    return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[verificationStatus] || 'bg-slate-200 text-slate-800'}`}>
        {labels[verificationStatus] || verificationStatus}
      </span>
    );
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-700">Cargando tareas en revisión…</p>
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

  if (status === 'unauthenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-xl bg-white p-6 shadow-md">
          <p className="text-slate-800">Necesitas iniciar sesión para acceder a las revisiones.</p>
          <button
            onClick={() => signIn()}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Iniciar sesión
          </button>
        </div>
      </main>
    );
  }

  if (!isReviewer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-xl bg-white p-6 text-center shadow-md">
          <p className="text-slate-800">No tienes permisos para revisar este proyecto.</p>
          <div className="mt-3 flex justify-center">
            <Link
              href={`/community/projects/${id}/board`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Volver al tablero
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Comunidad</p>
            <h1 className="text-3xl font-bold text-slate-900">Pendientes de revisión</h1>
            <p className="text-slate-600">Aprueba o rechaza las tareas enviadas.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/community/projects/${id}/board`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Volver al tablero
            </Link>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {pendingTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
            No hay tareas pendientes de revisión en este momento.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => {
              const assignee = task.assigneeName || task.assigneeEmail;
              return (
                <div key={resolveTaskId(task)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-slate-600">{task.description}</p>
                      )}
                      {assignee && (
                        <p className="text-xs font-semibold text-blue-600">Asignada a: {assignee}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {renderStatusBadge(task.status)}
                        {renderVerificationBadge(task.verificationStatus)}
                      </div>
                    </div>
                    {canReviewTask(task) && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setModalTask(task);
                            setModalDecision('approve');
                          }}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => {
                            setModalTask(task);
                            setModalDecision('reject');
                          }}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalTask && modalDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 text-white shadow-2xl">
            <h3 className="text-xl font-bold">
              {modalDecision === 'approve' ? 'Aprobar tarea' : 'Rechazar tarea'}
            </h3>
            <p className="mt-2 text-sm text-slate-200">Añade notas para el desarrollador (opcional).</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-blue-500"
              rows={4}
              placeholder="Notas adicionales"
            />

            {modalError && <p className="mt-2 text-sm text-red-400">{modalError}</p>}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setModalTask(null);
                  setModalDecision(null);
                  setNotes('');
                  setModalError(null);
                }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleReview}
                disabled={saving}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  modalDecision === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {saving ? 'Guardando…' : modalDecision === 'approve' ? 'Aprobar' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
