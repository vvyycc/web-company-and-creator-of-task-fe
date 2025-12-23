// src/pages/community/[id].tsx
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { io as ioClient, Socket } from 'socket.io-client';

type ColumnId = 'todo' | 'doing' | 'review' | 'done';
type TaskCategory = 'ARCHITECTURE' | 'MODEL' | 'SERVICE' | 'VIEW' | 'INFRA' | 'QA';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'REJECTED';
type VerificationStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type GithubCheckStatus = 'PENDING' | 'PASSED' | 'FAILED';
type ChecklistStatus = 'PENDING' | 'PASSED' | 'FAILED';

interface ChecklistItem {
  key: string;
  text: string;
  status: ChecklistStatus;
  details?: string | null;
}

interface RepoChecksInfo {
  status?: GithubCheckStatus | null;
  lastRunUrl?: string | null;
  lastRunConclusion?: string | null;
}

interface RepoInfo {
  provider?: string;
  repoFullName?: string | null;
  branch?: string | null;
  checks?: RepoChecksInfo;
  prNumber?: number | null;
}

interface BoardColumn {
  id: ColumnId;
  title: string;
  order: number;
}

interface BoardTask {
  id: string;
  title: string;
  description: string;
  price: number;
  priority: number;
  layer: TaskCategory;
  columnId: ColumnId;
  assigneeEmail?: string | null;
  assigneeAvatar?: string | null;

  repoFullName?: string | null;
  checkStatus?: GithubCheckStatus | null;
  lastRunUrl?: string | null;
  checklist?: ChecklistItem[];
  repo?: RepoInfo;

  status?: TaskStatus;
  verificationStatus?: VerificationStatus;
  acceptanceCriteria?: string;
  verificationNotes?: string;
}

interface BoardProject {
  id: string;
  title: string;
  description: string;
  ownerEmail: string;
  published: boolean;
  projectRepo?: string | null; // puede venir string u object según tu backend (lo tratamos como unknown en helpers)
  repoJoined?: boolean | null;
}

interface BoardResponse {
  project: BoardProject;
  columns: BoardColumn[];
  tasks: BoardTask[];
  repoJoined?: boolean | null;
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

let socket: Socket | null = null;

const formatPrice = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const isPriorityOne = (task: BoardTask) => task.priority === 1;

const isMostPrioritaryAssigned = (tasks: BoardTask[], userEmail: string | null) => {
  if (!userEmail) return () => false;
  const assigned = tasks.filter((t) => t.assigneeEmail === userEmail && typeof t.priority === 'number');
  if (!assigned.length) return () => false;
  const minPriority = Math.min(...assigned.map((t) => t.priority || Number.MAX_SAFE_INTEGER));
  return (task: BoardTask) => task.priority === minPriority;
};

// ✅ evitar crash si intentas renderizar objetos
const toText = (v: unknown) => {
  if (typeof v === 'string') return v;
  if (!v) return '';
  if (typeof v === 'object') {
    const anyV = v as any;
    return anyV?.message || anyV?.error || JSON.stringify(v);
  }
  return String(v);
};

// ✅ helpers robustos para repo (puede ser string u object)
const getRepoFullName = (repo: unknown): string | null => {
  if (!repo) return null;
  if (typeof repo === 'string') return repo;
  if (typeof repo === 'object') {
    const r = repo as any;
    if (typeof r.fullName === 'string') return r.fullName;
    if (typeof r.repoFullName === 'string') return r.repoFullName;
  }
  return null;
};

const getRepoHtmlUrl = (repo: unknown): string | null => {
  const fullName = getRepoFullName(repo);
  if (!fullName) return null;
  return `https://github.com/${fullName}`;
};

const normalizeChecklist = (raw: unknown): ChecklistItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const it = item as any;
      const text = toText(it.text || it.label || it.title || '');
      const key = typeof it.key === 'string' && it.key.trim().length > 0 ? it.key : `item-${idx}`;
      if (!text) return null;

      const status: ChecklistStatus =
        it.status === 'PASSED' || it.status === 'FAILED' ? it.status : 'PENDING';

      const details = typeof it.details === 'string' ? it.details : null;

      return { key, text, status, details } as ChecklistItem;
    })
    .filter(Boolean) as ChecklistItem[];
};

const normalizeRepo = (raw: unknown): RepoInfo | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const repo = raw as any;
  const checks = repo.checks || {};
  return {
    provider: repo.provider,
    repoFullName: getRepoFullName(repo) || undefined,
    branch: typeof repo.branch === 'string' ? repo.branch : undefined,
    prNumber: typeof repo.prNumber === 'number' ? repo.prNumber : undefined,
    checks: {
      status: checks.status,
      lastRunUrl: checks.lastRunUrl,
      lastRunConclusion: checks.lastRunConclusion,
    },
  } as RepoInfo;
};

const mapColumnId = (raw: any): ColumnId => {
  if (raw?.columnId === 'todo' || raw?.columnId === 'doing' || raw?.columnId === 'review' || raw?.columnId === 'done') {
    return raw.columnId;
  }

  const status = raw?.status as TaskStatus | undefined;
  if (status === 'IN_PROGRESS') return 'doing';
  if (status === 'IN_REVIEW') return 'review';
  if (status === 'DONE') return 'done';
  return 'todo';
};

const normalizeTask = (raw: any): BoardTask => {
  const repoInfo = normalizeRepo(raw?.repo);
  const repoFullName = getRepoFullName(raw?.repo) || raw?.repoFullName || null;
  const checkStatus =
    (raw?.repo?.checks?.status as GithubCheckStatus) || (raw?.checkStatus as GithubCheckStatus) || null;
  const lastRunUrl = raw?.repo?.checks?.lastRunUrl || raw?.lastRunUrl || null;

  return {
    id: raw?.id ?? raw?._id ?? '',
    title: raw?.title || '',
    description: raw?.description || '',
    price: raw?.price ?? 0,
    priority: raw?.priority ?? 0,
    layer: raw?.layer || raw?.category || 'QA',
    columnId: mapColumnId(raw),
    assigneeEmail: raw?.assigneeEmail ?? null,
    assigneeAvatar: raw?.assigneeAvatar ?? null,
    repoFullName,
    checkStatus,
    lastRunUrl,
    status: raw?.status,
    verificationStatus: raw?.verificationStatus,
    acceptanceCriteria: raw?.acceptanceCriteria,
    verificationNotes: raw?.verificationNotes,
    checklist: normalizeChecklist(raw?.checklist),
    repo: repoInfo,
  } as BoardTask;
};

const normalizeTasks = (raw: unknown): BoardTask[] => {
  if (!Array.isArray(raw)) return [];
  return (raw as any[]).map(normalizeTask);
};

// ✅ URL login GitHub con returnTo a esta página
const buildGithubLoginUrl = (userEmail: string, projectId: string) => {
  return (
    `${API_BASE}/integrations/github/login` +
    `?userEmail=${encodeURIComponent(userEmail)}` +
    `&returnTo=${encodeURIComponent(`/community/${projectId}`)}`
  );
};

function useGithubIntegration(userEmail: string | null) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const fetchStatus = async () => {
    if (!userEmail) {
      setConnected(false);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API_BASE}/integrations/github/status?userEmail=${encodeURIComponent(userEmail)}`
      );

      if (!res.ok) throw new Error('No se pudo comprobar la integración de GitHub');

      const data = await res.json().catch(() => ({}));
      const statusValue = Boolean(
        (data as any).connected ?? (data as any).isConnected ?? (data as any).status
      );
      setConnected(statusValue);
    } catch (err: any) {
      console.error('[github] status error', err);
      setConnected(false);
      setError(err?.message || 'Error al comprobar GitHub');
    } finally {
      setLoading(false);
    }
  };

  // ✅ si volvemos del callback con ?github=connected|error -> refrescar status y limpiar query
  useEffect(() => {
    if (!router.isReady) return;

    const github = router.query.github;

    if (github === 'connected' || github === 'error') {
      fetchStatus();

      const nextQuery = { ...router.query };
      delete (nextQuery as any).github;
      delete (nextQuery as any).githubLogin;

      if (!(nextQuery as any).id && router.query.id) {
        (nextQuery as any).id = router.query.id;
      }

      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.github]);

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  return { connected, loading, error, reload: fetchStatus };
}

// ✅ badge
function getTaskBadge(task: BoardTask) {
  const status =
    task.status ??
    (task.columnId === 'done'
      ? 'DONE'
      : task.columnId === 'doing'
        ? 'IN_PROGRESS'
        : task.columnId === 'review'
          ? 'IN_REVIEW'
          : 'TODO');

  const v = task.verificationStatus ?? 'NOT_SUBMITTED';

  if (status === 'IN_REVIEW' || v === 'SUBMITTED') {
    return { label: 'En revisión', className: 'bg-yellow-100 text-yellow-800' };
  }
  if (v === 'APPROVED' || status === 'DONE') {
    return { label: 'Aprobada', className: 'bg-green-100 text-green-800' };
  }
  if (v === 'REJECTED' || status === 'REJECTED') {
    return { label: 'Rechazada', className: 'bg-red-100 text-red-800' };
  }
  if (status === 'IN_PROGRESS') {
    return { label: 'En progreso', className: 'bg-blue-100 text-blue-800' };
  }
  return { label: 'Por hacer', className: 'bg-slate-100 text-slate-800' };
}

const mapRepoError = (code?: string) => {
  switch (code) {
    case 'github_not_connected_user':
      return 'Conecta tu cuenta de GitHub para unirte al repositorio.';
    case 'github_not_connected_owner':
      return 'El owner debe conectar GitHub para que el repositorio esté disponible.';
    case 'repo_access_required':
      return 'Necesitas aceptar la invitación del repositorio para colaborar.';
    case 'github_permissions_missing':
      return 'Faltan permisos de GitHub para colaborar en el repositorio.';
    case 'repo_not_created':
      return 'El repositorio todavía no está disponible. Contacta con el owner.';
    default:
      return null;
  }
};

export default function CommunityProjectBoard() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();

  const [project, setProject] = useState<BoardProject | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [mutatingTaskId, setMutatingTaskId] = useState<string | null>(null);

  const [repoJoined, setRepoJoined] = useState<boolean>(false);
  const [joiningRepo, setJoiningRepo] = useState<boolean>(false);
  const [repoStatusMessage, setRepoStatusMessage] = useState<string | null>(null);
  const [repoStatusError, setRepoStatusError] = useState<string | null>(null);
  const [repoInvitationBanner, setRepoInvitationBanner] = useState<boolean>(false);

  const [modalOpen, setModalOpen] = useState<null | 'submit' | 'approve' | 'reject'>(null);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [modalNotes, setModalNotes] = useState<string>('');
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [repoInputs, setRepoInputs] = useState<Record<string, string>>({});

  const [actionMessage, setActionMessage] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const currentEmail = session?.user?.email ?? null;
  const currentAvatar = (session?.user as any)?.image ?? null;

  const githubIntegration = useGithubIntegration(currentEmail);

  const isOwner = useMemo(() => {
    return !!project && !!session?.user?.email && session.user.email === project.ownerEmail;
  }, [project, session?.user?.email]);

  const repoFullName = useMemo(() => getRepoFullName(project?.projectRepo), [project?.projectRepo]);
  const repoUrl = useMemo(() => getRepoHtmlUrl(project?.projectRepo), [project?.projectRepo]);
  const repoAvailable = useMemo(() => !!repoFullName, [repoFullName]);

  const canCollaborate = useMemo(() => {
    if (!session?.user?.email || !project) return false;
    if (isOwner) return true;
    return repoAvailable && !!repoJoined;
  }, [session?.user?.email, project, isOwner, repoAvailable, repoJoined]);

  useEffect(() => {
    if (isOwner && !repoJoined) setRepoJoined(true);
  }, [isOwner, repoJoined]);

  const mostPrioritaryAssigned = useMemo(
    () => isMostPrioritaryAssigned(tasks, currentEmail),
    [tasks, currentEmail]
  );

  // ✅ Refrescar estado real del repo (para que al refrescar NO vuelva a pedir "Unirme")
  const refreshRepoStatus = async (projectId: string) => {
    if (!currentEmail) return;

    // Owner: siempre joined
    if (project?.ownerEmail && String(project.ownerEmail).toLowerCase() === String(currentEmail).toLowerCase()) {
      setRepoJoined(true);
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/community/projects/${projectId}/repo/status?userEmail=${encodeURIComponent(currentEmail)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;

      setRepoJoined(Boolean((data as any).joined));
    } catch {
      // no rompas la UI si falla
    }
  };

  // --------- Cargar tablero ---------
  useEffect(() => {
    if (!router.isReady || typeof id !== 'string') return;

    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    if (!isValidObjectId) {
      router.replace('/community');
      return;
    }

    const loadBoard = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/community/projects/${id}/board`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as any).error || 'No se pudo cargar el proyecto de la comunidad');
        }

        const data = (await res.json()) as BoardResponse;

        const cols = Array.isArray(data.columns) ? [...data.columns] : [];
        if (!cols.find((c) => c.id === 'review')) {
          const doingIdx = cols.findIndex((c) => c.id === 'doing');
          const insertAt = doingIdx >= 0 ? doingIdx + 1 : cols.length;
          cols.splice(insertAt, 0, { id: 'review', title: 'Revisión', order: 3 } as BoardColumn);
          cols.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        const ownerMatch = !!session?.user?.email && session.user.email === data.project.ownerEmail;
        const initialRepoJoined = ownerMatch
          ? true
          : Boolean((data as any).repoJoined ?? (data.project as any)?.repoJoined ?? false);

        setProject(data.project);
        setColumns(cols);
        setTasks(normalizeTasks((data as any).tasks));
        setRepoJoined(initialRepoJoined);

        // ✅ IMPORTANTE: tras cargar, confirma estado real (persistencia tras refresh)
        setTimeout(() => {
          refreshRepoStatus(data.project.id);
        }, 0);
      } catch (err: any) {
        console.error('[community-board] Error cargando tablero', err);
        setError(err.message || 'No se pudo cargar el proyecto de la comunidad');
      } finally {
        setLoading(false);
      }
    };

    loadBoard();
  }, [router.isReady, id, router, session?.user?.email]);

  // ✅ También refresca si cambia el usuario o el proyecto
  useEffect(() => {
    if (!project?.id) return;
    if (!currentEmail) return;
    refreshRepoStatus(project.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, currentEmail]);

  // --------- WebSocket ---------
  useEffect(() => {
    if (!project?.id) return;

    if (!socket) {
      socket = ioClient(API_BASE, {
        withCredentials: true,
        transports: ['websocket'],
        reconnection: true,
      });

      socket.on('connect', () => console.log('[socket] connected', socket?.id));
      socket.on('disconnect', (r) => console.log('[socket] disconnected', r));
      socket.on('connect_error', (e) => console.log('[socket] connect_error', e.message));
    }

    const joinRoom = () => socket?.emit('community:join', { projectId: project.id });
    socket.on('connect', joinRoom);
    joinRoom();

    const handleBoardUpdated = (payload: { projectId: string; tasks: BoardTask[] }) => {
      if (payload.projectId !== project.id) return;
      setTasks(normalizeTasks(payload.tasks));
    };

    const handleUserInvited = (payload: { projectId: string; userEmail?: string }) => {
      if (payload.projectId !== project.id) return;
      if (payload.userEmail && currentEmail && payload.userEmail !== currentEmail) return;
      setRepoInvitationBanner(true);
    };

    socket.on('community:boardUpdated', handleBoardUpdated);
    socket.on('community:userInvitedToRepo', handleUserInvited);

    return () => {
      socket?.off('connect', joinRoom);
      socket?.off('community:boardUpdated', handleBoardUpdated);
      socket?.off('community:userInvitedToRepo', handleUserInvited);
      socket?.emit('community:leave', { projectId: project.id });
    };
  }, [project?.id, currentEmail]);

  // --------- Drag & drop ---------
  const handleDragStart = (taskId: string, columnId: ColumnId) => {
    if (!session?.user?.email) return;
    if (!canCollaborate) return;
    if (columnId === 'done') return;
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => setDraggedTaskId(null);

  // --------- Modal helpers ---------
  const openModalFor = (mode: 'submit' | 'approve' | 'reject', taskId: string) => {
    setModalErr(null);
    setModalNotes('');
    setModalTaskId(taskId);
    setModalOpen(mode);
  };

  const closeModal = () => {
    if (modalLoading) return;
    setModalOpen(null);
    setModalTaskId(null);
    setModalNotes('');
    setModalErr(null);
  };

  // --------- Drop ---------
  const handleDropOnColumn = async (targetColumn: ColumnId) => {
    if (!draggedTaskId || !project) return;

    const task = tasks.find((t) => t.id === draggedTaskId);
    if (!task) {
      setDraggedTaskId(null);
      return;
    }

    const sourceColumn = task.columnId;
    if (sourceColumn === targetColumn) {
      setDraggedTaskId(null);
      return;
    }

    try {
      setActionError(null);
      setActionMessage(null);

      if (sourceColumn === 'doing' && targetColumn === 'review') {
        if (!currentEmail || task.assigneeEmail !== currentEmail) {
          setDraggedTaskId(null);
          return;
        }
        openModalFor('submit', task.id);
        setDraggedTaskId(null);
        return;
      }

      if (sourceColumn === 'review' && targetColumn === 'done') {
        if (!isOwner || !currentEmail) {
          setDraggedTaskId(null);
          return;
        }
        openModalFor('approve', task.id);
        setDraggedTaskId(null);
        return;
      }

      if (sourceColumn === 'review' && targetColumn === 'todo') {
        if (!isOwner || !currentEmail) {
          setDraggedTaskId(null);
          return;
        }
        openModalFor('reject', task.id);
        setDraggedTaskId(null);
        return;
      }

      if (!canCollaborate) {
        setActionMessage(null);
        setActionError('Necesitas acceso al repositorio para mover tareas.');
        setDraggedTaskId(null);
        return;
      }

      if (sourceColumn === 'todo' && targetColumn === 'doing') {
        setMutatingTaskId(task.id);

        const res = await fetch(`${API_BASE}/community/projects/${project.id}/tasks/${task.id}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: currentEmail, userAvatar: currentAvatar }),
        });

        const data = await res.json().catch(() => ({} as any));
        if (!res.ok)
          throw new Error(
            mapRepoError((data as any).error) || (data as any).error || 'No se pudo asignar la tarea'
          );

        setTasks(normalizeTasks((data as any).tasks));
      } else if (sourceColumn === 'doing' && targetColumn === 'done') {
        setMutatingTaskId(task.id);

        const res = await fetch(`${API_BASE}/community/projects/${project.id}/tasks/${task.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: currentEmail }),
        });

        const data = await res.json().catch(() => ({} as any));
        if (!res.ok)
          throw new Error(
            mapRepoError((data as any).error) ||
              (data as any).error ||
              'No se pudo marcar la tarea como hecha'
          );

        setTasks(normalizeTasks((data as any).tasks));
      } else if (sourceColumn === 'doing' && targetColumn === 'todo') {
        setMutatingTaskId(task.id);

        const res = await fetch(`${API_BASE}/community/projects/${project.id}/tasks/${task.id}/unassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: currentEmail }),
        });

        const data = await res.json().catch(() => ({} as any));
        if (!res.ok)
          throw new Error(
            mapRepoError((data as any).error) || (data as any).error || 'No se pudo desasignar la tarea'
          );

        setTasks(normalizeTasks((data as any).tasks));
      }
    } catch (err: any) {
      console.error('[community-board] Error moviendo tarea', err);
      setActionMessage(null);
      setActionError(err?.message || 'No se pudo mover la tarea');
      if (err?.message === 'Necesitas aceptar la invitación del repositorio para colaborar.') {
        setRepoJoined(false);
      }
    } finally {
      setMutatingTaskId(null);
      setDraggedTaskId(null);
    }
  };

  const tasksByColumn = useMemo(() => {
    const map: Record<ColumnId, BoardTask[]> = { todo: [], doing: [], review: [], done: [] };

    for (const task of tasks) {
      const col = (task.columnId || 'todo') as ColumnId;
      const safeCol: ColumnId = (['todo', 'doing', 'review', 'done'].includes(col) ? col : 'todo') as ColumnId;
      map[safeCol].push(task);
    }

    (Object.keys(map) as ColumnId[]).forEach((col) => {
      map[col].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    });

    return map;
  }, [tasks]);

  // --------- Día 10: acciones verificación ---------
  const submitForReview = async () => {
    if (!modalTaskId || !project?.id) return;
    try {
      setModalLoading(true);
      setModalErr(null);

      const res = await fetch(`${API_BASE}/community/projects/${project.id}/tasks/${modalTaskId}/submit-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: currentEmail, notes: modalNotes }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error((data as any).error || 'No se pudo enviar a revisión');

      if (Array.isArray((data as any).tasks)) setTasks(normalizeTasks((data as any).tasks));
      closeModal();
    } catch (e: any) {
      setModalErr(e.message || 'Error');
    } finally {
      setModalLoading(false);
    }
  };

  const reviewTask = async (approved: boolean) => {
    if (!modalTaskId || !project?.id) return;
    try {
      setModalLoading(true);
      setModalErr(null);

      const endpoint = approved ? 'approve-review' : 'reject-review';

      const res = await fetch(`${API_BASE}/community/projects/${project.id}/tasks/${modalTaskId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerEmail: currentEmail, notes: modalNotes }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error((data as any).error || 'No se pudo revisar la tarea');

      if (Array.isArray((data as any).tasks)) setTasks(normalizeTasks((data as any).tasks));
      closeModal();
    } catch (e: any) {
      setModalErr(e.message || 'Error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRunVerification = async (task: BoardTask) => {
    if (!project?.id || !currentEmail) return;

    try {
      setVerifyingTaskId(task.id);
      setActionError(null);
      setActionMessage(null);

      const res = await fetch(`${API_BASE}/community/projects/${project.id}/tasks/${task.id}/run-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: currentEmail }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).error || 'No se pudo ejecutar la verificación');

      if (Array.isArray((data as any).tasks)) setTasks(normalizeTasks((data as any).tasks));
      setActionMessage('Verificación solicitada.');
    } catch (err: any) {
      console.error('[github] verify error', err);
      setActionError(err?.message || 'Error al ejecutar la verificación');
    } finally {
      setVerifyingTaskId(null);
    }
  };

  // ✅ JOIN: si no tiene github conectado -> redirige a OAuth antes de llamar al backend
  const handleJoinRepo = async () => {
    if (!project?.id) return;

    if (!currentEmail) {
      setRepoStatusError('Debes iniciar sesión para unirte al repo.');
      return;
    }

    if (!githubIntegration.connected) {
      window.location.href = buildGithubLoginUrl(currentEmail, project.id);
      return;
    }

    try {
      setJoiningRepo(true);
      setRepoStatusError(null);
      setRepoStatusMessage(null);

      const res = await fetch(`${API_BASE}/community/projects/${project.id}/repo/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentEmail,
        },
        body: JSON.stringify({ userEmail: currentEmail }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          mapRepoError((data as any).error) ||
          (data as any).message ||
          (data as any).error ||
          'No se pudo unir al repositorio';

        if ((data as any).error === 'repo_access_required') {
          setRepoJoined(false);
        }

        throw new Error(message);
      }

      setRepoJoined(true);
      setRepoInvitationBanner(false);
      setRepoStatusMessage('Acceso al repositorio confirmado.');

      // ✅ una vez unido, refresca status real por si GitHub tarda en reflejar
      await refreshRepoStatus(project.id);
    } catch (err: any) {
      setRepoStatusError(err?.message || 'No se pudo unir al repositorio');
    } finally {
      setJoiningRepo(false);
    }
  };

  // --------- Render estados especiales ---------
  if (loading || status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-lg font-semibold text-slate-700">Cargando…</p>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="mb-2 text-xl font-bold text-slate-900">Proyecto de comunidad no disponible</h1>
          <p className="mb-4 text-slate-600">{error || 'No se pudo cargar el proyecto de la comunidad'}</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/dashboard"
              className="inline-flex justify-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Volver al dashboard
            </Link>
            <Link
              href="/tools/generator"
              className="inline-flex justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Volver al generador
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Cabecera */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Comunidad</p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">{project.title}</h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Volver al dashboard
              </Link>
              <Link
                href="/tools/generator"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Volver al generador
              </Link>
            </div>
          </div>

          <p className="mt-1 text-sm text-slate-700">{project.description}</p>
          <p className="mt-3 text-xs text-slate-500">
            Publicado por <span className="font-medium">{project.ownerEmail}</span>. Los desarrolladores pueden arrastrar
            tareas entre columnas para colaborar.
          </p>

          {repoInvitationBanner && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
              <p className="font-semibold">Has sido invitado al repositorio.</p>
              {repoUrl && (
                <Link
                  href={repoUrl}
                  target="_blank"
                  className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Abrir repositorio
                </Link>
              )}
            </div>
          )}

          {!session?.user?.email && (
            <p className="mt-3 text-xs text-amber-600">Inicia sesión para poder interactuar con las tareas.</p>
          )}

          {isOwner && (
            <p className="mt-3 text-xs text-slate-500">
              Estás viendo tu propio proyecto. Puedes aprobar o rechazar tareas en revisión y gestionar el tablero sin
              unirte al repositorio.
            </p>
          )}

          {/* Bloque repo */}
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {repoAvailable ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Repositorio</p>
                  <p className="text-xs text-slate-600">{repoFullName ?? '—'}</p>
                </div>

                {repoUrl && (
                  <Link
                    href={repoUrl}
                    target="_blank"
                    className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Abrir en GitHub
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 text-amber-700">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="text-sm font-semibold">Repositorio no disponible.</p>
                  <p className="text-xs">Repositorio no disponible. El proyecto no se publicó correctamente.</p>
                </div>
              </div>
            )}

            {/* ✅ Banner para dev no owner */}
            {!isOwner && repoAvailable && !repoJoined && (
              <div className="space-y-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <p className="font-semibold">Antes de colaborar debes unirte al repositorio.</p>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleJoinRepo}
                    disabled={joiningRepo || !session?.user?.email}
                    className="rounded-lg bg-amber-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                  >
                    {joiningRepo
                      ? 'Solicitando acceso…'
                      : githubIntegration.connected
                        ? 'Unirme al repo'
                        : 'Conectar GitHub para unirme'}
                  </button>

                  {repoUrl && (
                    <Link
                      href={repoUrl}
                      target="_blank"
                      className="rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                    >
                      Abrir repositorio
                    </Link>
                  )}
                </div>

                {!githubIntegration.connected && (
                  <p className="text-[11px] text-amber-800">
                    Primero conecta GitHub para poder aceptar/recibir invitación al repositorio.
                  </p>
                )}

                {repoStatusError && <p className="text-[11px] text-red-700">{repoStatusError}</p>}
                {repoStatusMessage && <p className="text-[11px] text-emerald-700">{repoStatusMessage}</p>}
              </div>
            )}

            {!isOwner && repoAvailable && repoJoined && (
              <div className="flex items-start gap-2 text-emerald-700">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-sm font-semibold">Acceso al repositorio confirmado.</p>
                  <p className="text-xs text-slate-700">Ya puedes mover tareas en el tablero.</p>
                  {repoUrl && (
                    <div className="mt-2">
                      <Link
                        href={repoUrl}
                        target="_blank"
                        className="inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-800"
                      >
                        Abrir repositorio
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {(actionMessage != null || actionError != null) && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-xs ${
                actionMessage
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {toText(actionMessage ?? actionError)}
            </div>
          )}
        </div>

        {/* Tablero */}
        <div className="grid gap-4 md:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = tasksByColumn[column.id as ColumnId] ?? [];

            return (
              <div
                key={column.id}
                className="flex min-h-[320px] flex-col rounded-2xl bg-slate-50 p-4"
                onDragOver={(e) => {
                  if (!session?.user?.email || !canCollaborate) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!canCollaborate) return;
                  handleDropOnColumn(column.id as ColumnId);
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">{column.title}</h2>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {columnTasks.length}
                  </span>
                </div>

                {columnTasks.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-100/50 p-4 text-center text-xs text-slate-500">
                    No hay tareas en esta columna todavía.
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-3">
                    {columnTasks.map((task) => {
                      const isAssignedToMe = !!currentEmail && task.assigneeEmail === currentEmail;
                      const isMutating = mutatingTaskId === task.id;

                      // ✅ NO mostrar botón de verificación al owner
                    const canRunVerification =
  task.columnId === 'review' &&
  !!task.assigneeEmail &&
  currentEmail === task.assigneeEmail &&
  !isOwner &&
  !!repoFullName;

                      const canShowGithubSection =
                        isAssignedToMe &&
                        task.columnId === 'doing' &&
                        (isPriorityOne(task) || mostPrioritaryAssigned(task));

                      // const repoValue = repoInputs[task.id] ?? task.repoFullName ?? '';
                      const showAssignmentMessage = isAssignedToMe && task.columnId === 'doing';
                      const badge = getTaskBadge(task);

                      // ✅ Mostrar el panel "Verificación" en review para todos,
                      // pero el botón solo para el asignado (no owner)
                      const showVerificationPanel = task.columnId === 'review';

                      return (
                        <article
                          key={task.id}
                          className="relative cursor-default rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200"
                          draggable={session?.user?.email && canCollaborate && task.columnId !== 'done' ? true : undefined}
                          onDragStart={() => handleDragStart(task.id, task.columnId)}
                          onDragEnd={handleDragEnd}
                        >
                          <div className="absolute right-3 top-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                              {badge.label}
                            </span>
                          </div>

                          <header className="mb-2 flex items-start justify-between gap-2 pr-16">
                            <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              {task.layer}
                            </span>
                          </header>

                          {task.assigneeEmail && task.columnId !== 'todo' && (
                            <div className="mb-2 flex justify-center">
                              {task.assigneeAvatar ? (
                                <img
                                  src={task.assigneeAvatar}
                                  alt={task.assigneeEmail}
                                  className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700">
                                  {task.assigneeEmail.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}

                          <p className="mb-3 text-xs text-slate-600">{task.description}</p>

                          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                            <span>Prioridad: {task.priority}</span>
                            <span className="font-semibold text-slate-900">{formatPrice(task.price)}</span>
                          </div>

                          {showAssignmentMessage && (
                            <p className="mt-1 text-[11px] text-emerald-600">Esta tarea está asignada a ti.</p>
                          )}

                          {canShowGithubSection && (
                            <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
                              <div className="flex items-center justify-between text-[12px] font-semibold text-slate-800">
                                <span>GitHub</span>
                                {githubIntegration.loading ? (
                                  <span className="text-slate-500">Comprobando…</span>
                                ) : githubIntegration.connected ? (
                                  <span className="text-emerald-600">Conectado</span>
                                ) : (
                                  <span className="text-amber-600">No conectado</span>
                                )}
                              </div>

                              {githubIntegration.error && (
                                <p className="text-[11px] text-red-600">{githubIntegration.error}</p>
                              )}

                              {!githubIntegration.connected ? (
                                <button
                                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-800"
                                  onClick={() => {
                                    if (!currentEmail || !project?.id) return;
                                    window.location.href = buildGithubLoginUrl(currentEmail, project.id);
                                  }}
                                >
                                  Conectar GitHub
                                </button>
                              ) : task.repoFullName ? (
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-[11px] font-semibold text-emerald-700">
                                  <span className="truncate">Repo: {task.repoFullName}</span>
                                  <Link
                                    href={`https://github.com/${task.repoFullName}`}
                                    target="_blank"
                                    className="text-emerald-700 underline"
                                  >
                                    Ver
                                  </Link>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {/* Si quieres volver a habilitar "Vincular repo" aquí,
                                      añade input + botón y endpoint /link-repo en backend */}
                                  <p className="text-[11px] text-slate-500">
                                    Repo de tarea no vinculado.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {showVerificationPanel && (
                            <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">
                              <div className="flex items-center justify-between text-[12px] font-semibold text-slate-800">
                                <span>Verificación</span>
                                {(() => {
                                  const check = (task.checkStatus || 'PENDING') as GithubCheckStatus;
                                  const badgeClasses =
                                    check === 'PASSED'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : check === 'FAILED'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-yellow-100 text-yellow-800';
                                  return (
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClasses}`}>
                                      {check}
                                    </span>
                                  );
                                })()}
                              </div>

                              {canRunVerification && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                    onClick={() => handleRunVerification(task)}
                                    disabled={verifyingTaskId === task.id}
                                  >
                                    {verifyingTaskId === task.id ? 'Ejecutando…' : 'Ejecutar verificación'}
                                  </button>
                                </div>
                              )}

                              <div className="space-y-1">
                                <div className="text-[11px] font-semibold text-slate-700">Checklist</div>
                                {task.checklist && task.checklist.length > 0 ? (
                                  <ul className="space-y-2">
                                    {task.checklist.map((item) => {
                                      const status = (item.status || 'PENDING') as ChecklistStatus;
                                      const badgeClasses =
                                        status === 'PASSED'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : status === 'FAILED'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-yellow-100 text-yellow-800';

                                      return (
                                        <li key={item.key} className="rounded-lg border border-slate-200 bg-white p-2">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                              <div className="text-[11px] font-semibold text-slate-800">{item.text}</div>
                                              {item.details && (
                                                <div className="mt-1 text-[10px] text-slate-600 whitespace-pre-wrap">{item.details}</div>
                                              )}
                                            </div>
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClasses}`}>
                                              {status}
                                            </span>
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-[11px] text-slate-500">Checklist pendiente de generación.</p>
                                )}
                              </div>

                              {task.checkStatus === 'FAILED' && (
                                <p className="text-[11px] text-red-600">Corrige y vuelve a enviar.</p>
                              )}

                              {task.lastRunUrl && (
                                <div className="text-[11px]">
                                  Última ejecución:{' '}
                                  <Link href={task.lastRunUrl} target="_blank" className="text-indigo-600 underline">
                                    Ver reporte
                                  </Link>
                                </div>
                              )}
                            </div>
                          )}

                          {(task.acceptanceCriteria || task.verificationNotes) && (
                            <div className="mt-3 space-y-2 text-[11px] text-slate-600">
                              {task.acceptanceCriteria && (
                                <div>
                                  <div className="font-semibold text-slate-700">Criterios</div>
                                  <div className="whitespace-pre-wrap">{task.acceptanceCriteria}</div>
                                </div>
                              )}
                              {task.verificationNotes && (
                                <div>
                                  <div className="font-semibold text-slate-700">Notas</div>
                                  <div className="whitespace-pre-wrap">{task.verificationNotes}</div>
                                </div>
                              )}
                            </div>
                          )}

                          {isMutating && <p className="mt-1 text-[11px] text-slate-400">Actualizando…</p>}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Día 10 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {modalOpen === 'submit' && 'Enviar tarea a revisión'}
                {modalOpen === 'approve' && 'Aprobar tarea'}
                {modalOpen === 'reject' && 'Rechazar tarea'}
              </h3>
              <button className="text-slate-500 hover:text-slate-700" onClick={closeModal} disabled={modalLoading}>
                ✕
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-600">Añade notas (opcional). Quedarán guardadas en la verificación.</p>

            <textarea
              className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-sm"
              rows={5}
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="Notas..."
              disabled={modalLoading}
            />

            {modalErr && <p className="mt-2 text-xs font-semibold text-red-600">{modalErr}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={closeModal}
                disabled={modalLoading}
              >
                Cancelar
              </button>

              {modalOpen === 'submit' && (
                <button
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={submitForReview}
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Enviando…' : 'Enviar'}
                </button>
              )}

              {modalOpen === 'approve' && (
                <button
                  className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  onClick={() => reviewTask(true)}
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Aprobando…' : 'Aprobar'}
                </button>
              )}

              {modalOpen === 'reject' && (
                <button
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  onClick={() => reviewTask(false)}
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Rechazando…' : 'Rechazar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
