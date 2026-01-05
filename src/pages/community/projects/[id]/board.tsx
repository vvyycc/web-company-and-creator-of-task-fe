import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import CommunityProjectError from '@/components/CommunityProjectError';
import { useProjectSocket } from '@/hooks/useProjectSocket';

type ColumnId = string;

type RepoType = 'backend' | 'frontend' | 'contracts' | 'mono';

type RepoStatusState = 'NONE' | 'INVITED' | 'ACTIVE';

type ProjectRepo = {
  type: RepoType;
  fullName: string;
  htmlUrl: string;
};

type RepoStatus = {
  type: RepoType;
  repoFullName?: string;
  repoUrl?: string;
  state: RepoStatusState;
};

type BoardTask = {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  layer?: string;
  columnId?: ColumnId;
  status?: ColumnId;
  priority?: number;
  repoType?: RepoType;
  repo?: { repoFullName?: string; repoUrl?: string; type?: RepoType };
  assigneeName?: string;
  assigneeEmail?: string;
  assignedToEmail?: string;
  column?: { _id?: string; id?: string; title?: string } | string;
  verificationStatus?: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
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
  project?: CommunityProject;
  projectRepos?: ProjectRepo[];
};

type CommunityProject = {
  id: string;
  title: string;
  ownerEmail?: string;
  projectRepos?: ProjectRepo[];
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
            <p className="mt-1 text-sm text-slate-300">Comparte notas para el revisor.</p>
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
            placeholder="Detalles relevantes, cambios hechos, pruebas realizadas…"
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
              confirmClassName || 'bg-blue-600 hover:bg-blue-700'
            } ${loading ? 'opacity-70' : ''}`}
          >
            {loading ? 'Enviando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function CommunityProjectBoardPage() {
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const router = useRouter();
  const { id } = router.query;

  const projectId = typeof id === 'string' ? id : undefined;
  const { data: session } = useSession();

  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [project, setProject] = useState<CommunityProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [submitModalTask, setSubmitModalTask] = useState<BoardTask | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    task: BoardTask;
    approved: boolean;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [projectRepos, setProjectRepos] = useState<ProjectRepo[]>([]);
  const [repoStatusByType, setRepoStatusByType] = useState<Partial<Record<RepoType, RepoStatus>>>(
    {}
  );
  const [joiningRepoType, setJoiningRepoType] = useState<RepoType | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

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

  const repoTypeLabels: Record<RepoType, string> = useMemo(
    () => ({
      backend: 'Backend',
      frontend: 'Frontend',
      contracts: 'Contracts',
      mono: 'Monorepo',
    }),
    []
  );

  const resolveRepoType = useCallback((task: BoardTask): RepoType | undefined => {
    if (!task) return undefined;
    const explicit = task.repoType || task.repo?.type;
    if (explicit) return explicit;

    const repoFullName = task.repo?.repoFullName;
    if (repoFullName && repoFullName.includes('-contracts')) {
      return 'contracts';
    }

    if (task.layer?.toUpperCase() === 'VIEW') {
      return 'frontend';
    }

    return 'backend';
  }, []);

  const canWorkOnTask = useCallback(
    (task: BoardTask) => {
      const repoType = resolveRepoType(task);
      if (!repoType) return true;
      return repoStatusByType[repoType]?.state === 'ACTIVE';
    },
    [repoStatusByType, resolveRepoType]
  );

  const handleRepoAccessError = useCallback(
    (payload?: { repoType?: RepoType; state?: RepoStatusState; repoFullName?: string; repoUrl?: string }) => {
      const repoType = payload?.repoType;

      if (repoType && payload?.state) {
        setRepoStatusByType((prev) => ({
          ...prev,
          [repoType]: {
            type: repoType,
            state: payload.state,
            repoFullName: payload.repoFullName,
            repoUrl: payload.repoUrl,
          },
        }));
      }

      const label = repoType ? repoTypeLabels[repoType] || repoType : 'del proyecto';
      showToast(`Debes unirte al repositorio ${label} para mover esta tarea`);
    },
    [repoTypeLabels, showToast]
  );

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

  const orderedProjectRepos = useMemo(
    () => {
      const types: RepoType[] = ['backend', 'frontend', 'contracts'];
      return types
        .map((type) => projectRepos.find((repo) => repo.type === type))
        .filter(Boolean) as ProjectRepo[];
    },
    [projectRepos]
  );

  useEffect(() => {
    if (!router.isReady || !projectId) return;

    const fetchBoard = async () => {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);

        const res = await fetch(`${API_BASE}/community/projects/${projectId}/board`);

        if (res.status === 404) {
          setNotFound(true);
          return;
        }

        if (!res.ok) {
          throw new Error('No se pudo cargar el tablero de este proyecto.');
        }

        const data: BoardResponse | BoardColumn[] = await res.json();

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

        const boardProject = (data as BoardResponse).project || null;
        const reposFromBoard =
          (data as BoardResponse).projectRepos ||
          boardProject?.projectRepos ||
          [];

        if (boardProject) {
          setProject({ ...boardProject, projectRepos: reposFromBoard });
        } else if (reposFromBoard?.length) {
          setProject((prev) => (prev ? { ...prev, projectRepos: reposFromBoard } : prev));
        }

        setProjectRepos(Array.isArray(reposFromBoard) ? reposFromBoard : []);

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

  useEffect(() => {
    if (!router.isReady || !projectId || project?.ownerEmail) return;

    const fetchProject = async () => {
      try {
        const res = await fetch(`${API_BASE}/community/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          const nextProject = data.project ?? data ?? null;
          const reposFromProject = nextProject?.projectRepos;
          if (reposFromProject?.length) {
            setProjectRepos(reposFromProject);
          }
          setProject(nextProject);
        }
      } catch (err) {
        console.error('[community] Error fetching project metadata', err);
      }
    };

    fetchProject();
  }, [API_BASE, project?.ownerEmail, projectId, router.isReady]);

  useEffect(() => {
    if (!router.isReady || !projectId || !session?.user?.email) return;

    const fetchRepoStatus = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/community/projects/${projectId}/repos/status?userEmail=${encodeURIComponent(
            session.user.email || ''
          )}`
        );
        if (!res.ok) return;
        const data: { repos?: RepoStatus[] } = await res.json();
        if (Array.isArray(data.repos)) {
          setRepoStatusByType(
            data.repos.reduce<Partial<Record<RepoType, RepoStatus>>>((acc, repo) => {
              acc[repo.type] = repo;
              return acc;
            }, {})
          );
        }
      } catch (err) {
        console.error('[community] Error fetching repo status', err);
      }
    };

    fetchRepoStatus();
  }, [API_BASE, projectId, router.isReady, session?.user?.email]);

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
    async (taskId: string, targetColumnId: string, previousColumnId?: string) => {
      try {
        const res = await fetch(`${API_BASE}/community/tasks/${taskId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ columnId: targetColumnId, status: targetColumnId }),
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          if (res.status === 403 && payload?.error === 'repo_access_required') {
            handleRepoAccessError(payload);
          }
          throw new Error(payload?.message || 'No se pudo mover la tarea.');
        }
      } catch (err) {
        console.error('[community] Error actualizando tarea', err);
        if (previousColumnId) {
          moveTaskLocally(taskId, previousColumnId);
        }
      }
    },
    [API_BASE, handleRepoAccessError, moveTaskLocally]
  );

  const handleDropOnColumn = useCallback(
    (columnId: string) => {
      if (!draggedTaskId) return;
      const originalTask = tasks.find((task) => resolveTaskId(task) === draggedTaskId);
      const previousColumnId = originalTask ? resolveColumnId(originalTask) : undefined;

      moveTaskLocally(draggedTaskId, columnId);
      persistTaskMove(draggedTaskId, columnId, previousColumnId);
      setDraggedTaskId(null);
    },
    [draggedTaskId, moveTaskLocally, persistTaskMove, resolveColumnId, resolveTaskId, tasks]
  );

  const handleSocketEvent = useCallback(
    (updatedTask: BoardTask) => {
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

  useProjectSocket(projectId, handleSocketEvent);

  const handleJoinRepo = useCallback(
    async (type: RepoType) => {
      if (!projectId || !session?.user?.email) {
        showToast('Inicia sesión para unirte al repositorio.');
        return;
      }

      try {
        setJoiningRepoType(type);
        const res = await fetch(`${API_BASE}/community/projects/${projectId}/repos/${type}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: session.user.email }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const message = data?.message || 'No se pudo enviar la solicitud.';
          showToast(message);
          return;
        }

        const nextState: RepoStatusState = data?.state || 'INVITED';
        setRepoStatusByType((prev) => ({
          ...prev,
          [type]: {
            ...(prev[type] || { type }),
            state: nextState,
            repoFullName: data?.repoFullName || prev[type]?.repoFullName,
            repoUrl: data?.repoUrl || prev[type]?.repoUrl,
          },
        }));

        showToast(nextState === 'ACTIVE' ? 'Ya estás unido a este repositorio.' : 'Solicitud enviada.');
      } catch (err) {
        console.error('[community] Error joining repo', err);
        showToast('No se pudo enviar la solicitud.');
      } finally {
        setJoiningRepoType(null);
      }
    },
    [API_BASE, projectId, session?.user?.email, showToast]
  );

  const statusBadgeClasses: Record<string, string> = {
    TODO: 'bg-slate-200 text-slate-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    IN_REVIEW: 'bg-amber-100 text-amber-800',
    DONE: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  const verificationBadgeLabel: Record<string, string> = {
    SUBMITTED: 'En revisión',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
  };

  const verificationBadgeClasses: Record<string, string> = {
    SUBMITTED: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  const handleSubmitForReview = async (task: BoardTask, notes: string) => {
    const taskId = resolveTaskId(task);
    if (!taskId || !session?.user?.email) return;

    try {
      setActionLoading(true);
      setActionError(null);

      const res = await fetch(`${API_BASE}/verification/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devEmail: session.user.email, notes }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || 'No se pudo enviar a revisión.');
      }

      setSubmitModalTask(null);
    } catch (err: any) {
      setActionError(err.message || 'No se pudo enviar a revisión.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewAction = async (task: BoardTask, approved: boolean, notes: string) => {
    const taskId = resolveTaskId(task);
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
        throw new Error(payload?.message || 'No se pudo actualizar la revisión.');
      }

      setReviewModal(null);
    } catch (err: any) {
      setActionError(err.message || 'No se pudo actualizar la revisión.');
    } finally {
      setActionLoading(false);
    }
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
          <Link
            href={`/community/projects/${id}`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Volver a la ficha
          </Link>
          {session?.user?.email && project?.ownerEmail === session.user.email && (
            <Link
              href={`/community/projects/${id}/review`}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
            >
              Revisión
            </Link>
          )}
        </div>

        {orderedProjectRepos.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Repositorios del proyecto</h3>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {orderedProjectRepos.map((repo) => {
                const status: RepoStatusState = repoStatusByType[repo.type]?.state || 'NONE';
                const statusClass =
                  status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : status === 'INVITED'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-800';

                const buttonLabel =
                  status === 'NONE' ? 'Unirse' : status === 'INVITED' ? 'Invitado' : 'Unido';

                const isJoinDisabled = status !== 'NONE' || !!joiningRepoType;

                return (
                  <div key={repo.type} className="rounded-lg bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-blue-600">
                          {repoTypeLabels[repo.type] || repo.type}
                        </p>
                        <Link
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-slate-900 hover:underline"
                        >
                          {repo.fullName}
                        </Link>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
                        {status}
                      </span>
                    </div>
                    <button
                      disabled={isJoinDisabled}
                      onClick={() => handleJoinRepo(repo.type)}
                      className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        status === 'NONE'
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-slate-200 text-slate-600'
                      } ${isJoinDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      {joiningRepoType === repo.type ? 'Enviando…' : buttonLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                        const taskRepoType = resolveRepoType(task);
                        const repoBadgeLabel = taskRepoType ? repoTypeLabels[taskRepoType] || taskRepoType : null;
                        const taskIsEditable = canWorkOnTask(task);

                        return (
                          <div
                            key={taskId}
                            className="rounded-lg bg-white p-3 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md"
                            draggable={taskIsEditable}
                            onDragStart={(e) => {
                              if (!taskIsEditable) {
                                e.preventDefault();
                                showToast(
                                  `Debes unirte al repositorio ${repoBadgeLabel || 'asignado'} para mover esta tarea`
                                );
                                return;
                              }
                              setDraggedTaskId(taskId);
                            }}
                            onDragEnd={() => setDraggedTaskId(null)}
                          >
                            <p className="font-semibold text-slate-900">{task.title}</p>
                            {task.description && (
                              <p className="text-sm text-slate-600">{task.description}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                              {task.status && (
                                <span
                                  className={`rounded-full px-2 py-1 ${
                                    statusBadgeClasses[task.status] || 'bg-slate-200 text-slate-800'
                                  }`}
                                >
                                  {task.status.replace('_', ' ')}
                                </span>
                              )}
                                  {task.verificationStatus && (
                                    <span
                                      className={`rounded-full px-2 py-1 ${
                                        verificationBadgeClasses[task.verificationStatus] || 'bg-slate-200 text-slate-800'
                                      }`}
                                >
                                  {verificationBadgeLabel[task.verificationStatus] || task.verificationStatus}
                                </span>
                              )}
                            </div>
                            {assigneeLabel && (
                              <p className="mt-2 text-xs font-semibold text-blue-600">
                                Asignada a: {assigneeLabel}
                              </p>
                            )}
                            {repoBadgeLabel && (
                              <p className="mt-2 text-xs font-semibold text-slate-600">
                                Repo: <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-800">{repoBadgeLabel}</span>
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {session?.user?.email &&
                                (task.assignedToEmail || task.assigneeEmail) === session.user.email &&
                                (task.status === 'IN_PROGRESS' || task.status === 'REJECTED') && (
                                  <button
                                    onClick={() => setSubmitModalTask(task)}
                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                                  >
                                    Enviar a revisión
                                  </button>
                                )}

                              {session?.user?.email &&
                                project?.ownerEmail === session.user.email &&
                                task.status === 'IN_REVIEW' &&
                                task.verificationStatus === 'SUBMITTED' && (
                                  <>
                                    <button
                                      onClick={() => setReviewModal({ task, approved: true })}
                                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                                    >
                                      Aprobar
                                    </button>
                                    <button
                                      onClick={() => setReviewModal({ task, approved: false })}
                                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
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

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      )}

      {submitModalTask && (
        <NoteModal
          title="Enviar a revisión"
          confirmLabel="Enviar"
          loading={actionLoading}
          error={actionError}
          onClose={() => {
            if (actionLoading) return;
            setActionError(null);
            setSubmitModalTask(null);
          }}
          onConfirm={(notes) => handleSubmitForReview(submitModalTask, notes)}
        />
      )}

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
