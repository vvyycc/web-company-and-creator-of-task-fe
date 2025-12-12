import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import CommunityProjectError from '@/components/CommunityProjectError';
import { useProjectSocket } from '@/hooks/useProjectSocket';

type ColumnId = string;

type BoardTask = {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  columnId?: ColumnId;
  status?: ColumnId;
  priority?: number;
  assigneeName?: string;
  assigneeEmail?: string;
  assignedToEmail?: string;
  verificationStatus?: 'NOT_SUBMITTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  column?: { _id?: string; id?: string; title?: string } | string;
};

type BoardColumn = {
  _id?: string;
  id?: string;
  title: string;
  order?: number;
  key?: string;
  tasks?: BoardTask[];
};

type BoardResponse = {
  columns: BoardColumn[];
  tasks?: BoardTask[];
};

type Project = {
  id: string;
  ownerEmail?: string;
};

export default function CommunityProjectBoardPage() {
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const router = useRouter();
  const { id } = router.query;

  const { data: session } = useSession();

  const projectId = typeof id === 'string' ? id : undefined;

  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  const [submitModalTask, setSubmitModalTask] = useState<BoardTask | null>(null);
  const [submitNotes, setSubmitNotes] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [reviewModalTask, setReviewModalTask] = useState<BoardTask | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject' | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const resolveColumnId = useCallback((task: BoardTask) => {
    if (!task) return '';
    const column = task.column as BoardColumn | string | undefined;
    const fromColumn =
      typeof column === 'string'
        ? column
        : column?.id || column?._id || column?.title;

    return (
      task.columnId || task.status || fromColumn || ''
    );
  }, []);

  const resolveTaskId = useCallback((task?: Partial<BoardTask>) => {
    if (!task) return '';
    return task._id || task.id || '';
  }, []);

  const normalizeColumns = useCallback((rawColumns: BoardColumn[]) =>
    rawColumns.map((column) => ({
      ...column,
      id: column.id || column._id || column.key || column.title,
      title: column.title || 'Sin título',
      tasks: column.tasks || [],
    })),
  []);

  const normalizeTasks = useCallback(
    (rawColumns: BoardColumn[], rawTasks?: BoardTask[]) => {
      if (Array.isArray(rawTasks)) {
        return rawTasks;
      }

      const fallbackTasks: BoardTask[] = [];
      for (const column of rawColumns) {
        if (!Array.isArray(column.tasks)) continue;
        const normalizedColumnId = column.id || column._id || column.title;

        for (const task of column.tasks) {
          fallbackTasks.push({
            ...task,
            columnId: task.columnId || task.status || normalizedColumnId,
          });
        }
      }

      return fallbackTasks;
    },
    []
  );

  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, BoardTask[]> = {};

    for (const column of columns) {
      const colId = column.id || column._id || column.title;
      grouped[colId] = [];
    }

    for (const task of tasks) {
      const colId = resolveColumnId(task);
      if (!colId) continue;
      if (!grouped[colId]) grouped[colId] = [];
      grouped[colId].push(task);
    }

    Object.values(grouped).forEach((list) =>
      list.sort((a, b) => (a.priority || 0) - (b.priority || 0))
    );

    return grouped;
  }, [columns, resolveColumnId, tasks]);

  useEffect(() => {
    if (!router.isReady || !projectId) return;

    const fetchBoard = async () => {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);

        const [boardRes, projectRes] = await Promise.all([
          fetch(`${API_BASE}/community/projects/${projectId}/board`),
          fetch(`${API_BASE}/community/projects/${projectId}`),
        ]);

        if (boardRes.status === 404) {
          setNotFound(true);
          return;
        }

        if (!boardRes.ok) {
          throw new Error('No se pudo cargar el tablero de este proyecto.');
        }

        if (projectRes.ok) {
          const projectData = await projectRes.json();
          setProject(projectData.project ?? projectData);
        }

        const data: BoardResponse | BoardColumn[] = await boardRes.json();

        const rawColumns = Array.isArray((data as BoardResponse)?.columns)
          ? (data as BoardResponse).columns
          : Array.isArray(data)
          ? (data as BoardColumn[])
          : [];

        const normalizedColumns = normalizeColumns(rawColumns);
        const normalizedTasks = normalizeTasks(
          normalizedColumns,
          (data as BoardResponse).tasks
        );

        setColumns(normalizedColumns);
        setTasks(normalizedTasks);
      } catch (err: any) {
        console.error('[community] Error fetching board', err);
        setError(err.message || 'No se pudo cargar el tablero.');
      } finally {
        setLoading(false);
      }
    };

    fetchBoard();
  }, [API_BASE, normalizeColumns, normalizeTasks, projectId, router.isReady]);

  const moveTaskLocally = useCallback(
    (taskId: string, targetColumnId: string) => {
      setTasks((prev) =>
        prev.map((task) =>
          resolveTaskId(task) === taskId
            ? { ...task, columnId: targetColumnId, status: targetColumnId }
            : task
        )
      );
    },
    [resolveTaskId]
  );

  const persistTaskMove = useCallback(
    async (taskId: string, targetColumnId: string) => {
      try {
        await fetch(`${API_BASE}/community/tasks/${taskId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ columnId: targetColumnId, status: targetColumnId }),
        });
      } catch (err) {
        console.error('[community] Error actualizando tarea', err);
      }
    },
    [API_BASE]
  );

  const handleDropOnColumn = useCallback(
    (columnId: string) => {
      if (!draggedTaskId) return;
      moveTaskLocally(draggedTaskId, columnId);
      persistTaskMove(draggedTaskId, columnId);
      setDraggedTaskId(null);
    },
    [draggedTaskId, moveTaskLocally, persistTaskMove]
  );

  const updateTask = useCallback(
    (updatedTask: BoardTask | null | undefined) => {
      if (!updatedTask) return;
      const taskId = resolveTaskId(updatedTask);
      if (!taskId) return;

      setTasks((prev) => {
        const existingIndex = prev.findIndex((task) => resolveTaskId(task) === taskId);
        if (existingIndex !== -1) {
          const copy = [...prev];
          copy[existingIndex] = { ...copy[existingIndex], ...updatedTask };
          return copy;
        }
        return [...prev, updatedTask];
      });
    },
    [resolveTaskId]
  );

  const handleSocketEvent = useCallback(
    (updatedTask: BoardTask) => {
      updateTask(updatedTask);
    },
    [updateTask]
  );

  useProjectSocket(projectId, handleSocketEvent);

  const currentEmail = session?.user?.email;

  const isReviewer = useMemo(
    () => !!project?.ownerEmail && project.ownerEmail === currentEmail,
    [currentEmail, project?.ownerEmail]
  );

  const showSubmitButton = useCallback(
    (task: BoardTask) => {
      const assigneeEmail = task.assignedToEmail || task.assigneeEmail;
      const normalizedStatus = task.status || task.columnId;
      if (!currentEmail || !assigneeEmail) return false;
      return (
        currentEmail === assigneeEmail &&
        (normalizedStatus === 'IN_PROGRESS' || normalizedStatus === 'REJECTED')
      );
    },
    [currentEmail]
  );

  const showReviewActions = useCallback(
    (task: BoardTask) => {
      if (!isReviewer) return false;
      const normalizedStatus = task.status || task.columnId;
      return normalizedStatus === 'IN_REVIEW' && task.verificationStatus === 'SUBMITTED';
    },
    [isReviewer]
  );

  const handleSubmitTask = async () => {
    if (!submitModalTask || !currentEmail) return;
    const taskId = resolveTaskId(submitModalTask);
    if (!taskId) return;

    try {
      setSubmitLoading(true);
      setSubmitError(null);
      const res = await fetch(`${API_BASE}/verification/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devEmail: currentEmail, notes: submitNotes }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo enviar la tarea a revisión.');
      }

      const data = await res.json().catch(() => ({}));
      updateTask((data as any)?.task ?? data);
      setSubmitModalTask(null);
      setSubmitNotes('');
    } catch (err: any) {
      console.error('[community] Error enviando a revisión', err);
      setSubmitError(err.message || 'Error al enviar a revisión.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReviewTask = async () => {
    if (!reviewModalTask || !currentEmail || !reviewDecision) return;
    const taskId = resolveTaskId(reviewModalTask);
    if (!taskId) return;

    try {
      setReviewLoading(true);
      setReviewError(null);
      const res = await fetch(`${API_BASE}/verification/tasks/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerEmail: currentEmail,
          approved: reviewDecision === 'approve',
          notes: reviewNotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo actualizar la verificación.');
      }

      const data = await res.json().catch(() => ({}));
      updateTask((data as any)?.task ?? data);
      setReviewModalTask(null);
      setReviewNotes('');
      setReviewDecision(null);
    } catch (err: any) {
      console.error('[community] Error revisando tarea', err);
      setReviewError(err.message || 'Error al revisar la tarea.');
    } finally {
      setReviewLoading(false);
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
        <p className="text-sm text-slate-700">Cargando tablero…</p>
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

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Comunidad</p>
            <h1 className="text-3xl font-bold text-slate-900">Tablero del proyecto</h1>
            <p className="text-slate-600">Visualiza el flujo de trabajo del proyecto de comunidad.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isReviewer && (
              <Link
                href={`/community/projects/${id}/review`}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Revisión
              </Link>
            )}
            <Link
              href={`/community/projects/${id}`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Volver a la ficha
            </Link>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {columns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
            El tablero todavía no está disponible para este proyecto.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {columns.map((column) => {
              const columnKey = column.id || column._id || column.title;
              const columnTasks = tasksByColumn[columnKey] || [];

              return (
                <div
                  key={columnKey}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnColumn(columnKey as string);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">{column.title}</h2>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">
                      {columnTasks.length}
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {columnTasks.length > 0 ? (
                      columnTasks.map((task) => {
                        const taskId = resolveTaskId(task) || task.title;
                        const assigneeLabel =
                          task.assigneeName || task.assigneeEmail;

                        return (
                          <div
                            key={taskId}
                            className="rounded-lg bg-white p-3 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md"
                            draggable
                            onDragStart={() => setDraggedTaskId(taskId)}
                            onDragEnd={() => setDraggedTaskId(null)}
                          >
                            <p className="font-semibold text-slate-900">{task.title}</p>
                            {task.description && (
                              <p className="text-sm text-slate-600">{task.description}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {renderStatusBadge(task.status || task.columnId)}
                              {renderVerificationBadge(task.verificationStatus)}
                            </div>
                            {assigneeLabel && (
                              <p className="mt-2 text-xs font-semibold text-blue-600">
                                Asignada a: {assigneeLabel}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {showSubmitButton(task) && (
                                <button
                                  onClick={() => setSubmitModalTask(task)}
                                  className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  Enviar a revisión
                                </button>
                              )}

                              {showReviewActions(task) && (
                                <>
                                  <button
                                    onClick={() => {
                                      setReviewModalTask(task);
                                      setReviewDecision('approve');
                                    }}
                                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                  >
                                    Aprobar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReviewModalTask(task);
                                      setReviewDecision('reject');
                                    }}
                                    className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                                  >
                                    Rechazar
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500">Sin tareas en esta columna.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(submitModalTask || reviewModalTask) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 text-white shadow-2xl">
            <h3 className="text-xl font-bold">
              {submitModalTask
                ? 'Enviar a revisión'
                : reviewDecision === 'approve'
                ? 'Aprobar tarea'
                : 'Rechazar tarea'}
            </h3>
            <p className="mt-2 text-sm text-slate-200">
              {submitModalTask
                ? 'Añade notas para el revisor (opcional).'
                : 'Añade notas para el desarrollador (opcional).'}
            </p>

            <textarea
              value={submitModalTask ? submitNotes : reviewNotes}
              onChange={(e) =>
                submitModalTask ? setSubmitNotes(e.target.value) : setReviewNotes(e.target.value)
              }
              className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none focus:border-blue-500"
              rows={4}
              placeholder="Notas adicionales"
            />

            {(submitError || reviewError) && (
              <p className="mt-2 text-sm text-red-400">{submitError || reviewError}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setSubmitModalTask(null);
                  setReviewModalTask(null);
                  setSubmitNotes('');
                  setReviewNotes('');
                  setReviewDecision(null);
                  setSubmitError(null);
                  setReviewError(null);
                }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Cancelar
              </button>

              {submitModalTask ? (
                <button
                  onClick={handleSubmitTask}
                  disabled={submitLoading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitLoading ? 'Enviando…' : 'Enviar a revisión'}
                </button>
              ) : (
                <button
                  onClick={handleReviewTask}
                  disabled={reviewLoading}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                    reviewDecision === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {reviewLoading
                    ? 'Guardando…'
                    : reviewDecision === 'approve'
                    ? 'Aprobar'
                    : 'Rechazar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
