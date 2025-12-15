import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import CommunityProjectError from '@/components/CommunityProjectError';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

type PendingTask = {
  _id?: string;
  id?: string;
  title: string;
  layer?: string;
  priority?: number;
  price?: number;
  taskPrice?: number;
  acceptanceCriteria?: string;
  assignedToEmail?: string;
  verificationNotes?: string;
  verificationStatus?: string;
  status?: string;
};

type CommunityProject = {
  id: string;
  title: string;
  ownerEmail?: string;
};

type NoteModalProps = {
  title: string;
  confirmLabel: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: (notes: string) => void;
  onClose: () => void;
  confirmClassName?: string;
};

const NoteModal = ({
  title,
  confirmLabel,
  loading,
  error,
  onConfirm,
  onClose,
  confirmClassName,
}: NoteModalProps) => {
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-300">Comparte notas para el desarrollador.</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 transition hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold text-slate-200">Notas</label>
          <textarea
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalles relevantes para la revisión…"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(notes)}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
              confirmClassName || 'bg-emerald-600 hover:bg-emerald-700'
            } ${loading ? 'opacity-70' : ''}`}
          >
            {loading ? 'Enviando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function PendingReviewPage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === 'string' ? id : undefined;
  const { data: session, status } = useSession();

  const [project, setProject] = useState<CommunityProject | null>(null);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    task: PendingTask;
    approved: boolean;
  } | null>(null);

  const isOwner = useMemo(
    () => session?.user?.email && project?.ownerEmail === session.user.email,
    [project?.ownerEmail, session?.user?.email]
  );

  useEffect(() => {
    if (!router.isReady || !projectId) return;

    const fetchProject = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/community/projects/${projectId}`);

        if (res.status === 404) {
          setNotFound(true);
          return;
        }

        if (!res.ok) {
          throw new Error('No se pudo cargar el proyecto.');
        }

        const data = await res.json();
        setProject(data.project ?? data ?? null);
      } catch (err: any) {
        console.error('[community] Error fetching project', err);
        setError(err.message || 'No se pudo cargar el proyecto.');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, router.isReady]);

  useEffect(() => {
    if (!router.isReady || !projectId) return;

    const fetchPending = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/verification/projects/${projectId}/pending`);
        if (!res.ok) {
          throw new Error('No se pudieron cargar las tareas pendientes.');
        }

        const data = await res.json();
        setPendingTasks(Array.isArray(data) ? data : data?.tasks || []);
      } catch (err: any) {
        console.error('[community] Error fetching pending tasks', err);
        setError(err.message || 'No se pudieron cargar las tareas pendientes.');
      } finally {
        setLoading(false);
      }
    };

    fetchPending();
  }, [projectId, router.isReady]);

  const handleReviewAction = async (task: PendingTask, approved: boolean, notes: string) => {
    const taskId = task._id || task.id;
    if (!taskId || !session?.user?.email) return;

    try {
      setActionLoading(true);
      setActionError(null);

      const res = await fetch(`${API_BASE}/verification/tasks/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerEmail: session.user.email, approved, notes }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || 'No se pudo actualizar la tarea.');
      }

      setPendingTasks((prev) => prev.filter((t) => (t._id || t.id) !== taskId));
      setReviewModal(null);
    } catch (err: any) {
      setActionError(err.message || 'No se pudo actualizar la tarea.');
    } finally {
      setActionLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-700">Cargando información…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-xl bg-white p-6 text-center shadow">
          <p className="text-sm text-slate-700">Inicia sesión para continuar.</p>
          <button
            onClick={() => signIn('google')}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Iniciar sesión
          </button>
        </div>
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

  if (!isOwner) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-700">No autorizado.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Comunidad</p>
            <h1 className="text-3xl font-bold text-slate-900">Pendientes de revisión</h1>
            <p className="text-slate-600">Aprueba o rechaza tareas enviadas por los desarrolladores.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/community/projects/${project?.id || projectId}/board`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Volver al tablero
            </Link>
            <Link
              href={`/community/projects/${project?.id || projectId}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Ficha del proyecto
            </Link>
          </div>
        </div>

        {pendingTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
            No hay tareas pendientes de revisión ahora mismo.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTasks.map((task) => {
              const taskId = task._id || task.id || task.title;
              const price = task.price ?? task.taskPrice;
              return (
                <div
                  key={taskId}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{task.title}</p>
                      <p className="text-sm text-slate-600">Asignada a: {task.assignedToEmail || '—'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      {task.layer && (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{task.layer}</span>
                      )}
                      {typeof task.priority === 'number' && (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">Prioridad {task.priority}</span>
                      )}
                      {typeof price === 'number' && (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                          Precio €{price}
                        </span>
                      )}
                    </div>
                  </div>

                  {task.acceptanceCriteria && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">Criterios de aceptación</p>
                      <p className="mt-1 whitespace-pre-line">{task.acceptanceCriteria}</p>
                    </div>
                  )}

                  {task.verificationNotes && (
                    <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      <p className="font-semibold">Notas enviadas</p>
                      <p className="mt-1 whitespace-pre-line">{task.verificationNotes}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => setReviewModal({ task, approved: true })}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => setReviewModal({ task, approved: false })}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reviewModal && (
        <NoteModal
          title={reviewModal.approved ? 'Aprobar tarea' : 'Rechazar tarea'}
          confirmLabel={reviewModal.approved ? 'Aprobar' : 'Rechazar'}
          confirmClassName={
            reviewModal.approved
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-red-600 hover:bg-red-700'
          }
          loading={actionLoading}
          error={actionError}
          onClose={() => {
            if (actionLoading) return;
            setActionError(null);
            setReviewModal(null);
          }}
          onConfirm={(notes) => handleReviewAction(reviewModal.task, reviewModal.approved, notes)}
        />
      )}
    </main>
  );
}
