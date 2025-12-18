// src/pages/community/[id].tsx
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { io as ioClient, Socket } from "socket.io-client";

type ColumnId = 'todo' | 'doing' | 'review' | 'done'; // ✅ incluye review
type TaskCategory =
  | 'ARCHITECTURE'
  | 'MODEL'
  | 'SERVICE'
  | 'VIEW'
  | 'INFRA'
  | 'QA';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'REJECTED';
type VerificationStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type GithubCheckStatus = 'PENDING' | 'PASSED' | 'FAILED';

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

  // ✅ Día 10 (si backend los envía)
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
  projectRepo?: string | null;
  repoJoined?: boolean | null;
}

interface BoardResponse {
  project: BoardProject;
  columns: BoardColumn[];
  tasks: BoardTask[];
  repoJoined?: boolean | null;
}

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

let socket: Socket | null = null;

const formatPrice = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);

const isPriorityOne = (task: BoardTask) => task.priority === 1;

const isMostPrioritaryAssigned = (tasks: BoardTask[], userEmail: string | null) => {
  if (!userEmail)
    return () => false;
  const assigned = tasks.filter(
    (t) => t.assigneeEmail === userEmail && typeof t.priority === 'number'
  );
  if (!assigned.length) return () => false;
  const minPriority = Math.min(...assigned.map((t) => t.priority || Number.MAX_SAFE_INTEGER));
  return (task: BoardTask) => task.priority === minPriority;
};

function useGithubIntegration(userEmail: string | null) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const router = useRouter();

useEffect(() => {
  if (!router.isReady) return;

  const github = router.query.github;

  if (github === "connected") {
    // refresca estado y limpia query conservando /community/[id]
    fetchStatus();

    const nextQuery = { ...router.query };
    delete (nextQuery as any).github;
    delete (nextQuery as any).githubLogin;

    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }

  if (github === "error") {
    fetchStatus();
    const nextQuery = { ...router.query };
    delete (nextQuery as any).github;
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

// ✅ Helpers UI día 10
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

  // ✅ Modal/verificación (Día 10) — lo reutilizamos para submit/approve/reject
  const [modalOpen, setModalOpen] = useState<null | 'submit' | 'approve' | 'reject'>(null);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [modalNotes, setModalNotes] = useState<string>('');
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [repoInputs, setRepoInputs] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentEmail = session?.user?.email ?? null;
  const currentAvatar = (session?.user as any)?.image ?? null;

  const githubIntegration = useGithubIntegration(currentEmail);

  const isOwner = useMemo(
    () =>
      !!project &&
      !!session?.user?.email &&
      session.user.email === project.ownerEmail,
    [project, session?.user?.email]
  );

  const repoAvailable = useMemo(() => !!project?.projectRepo, [project?.projectRepo]);

  const canCollaborate = useMemo(() => {
    if (!session?.user?.email || !project) return false;
    if (isOwner) return true;
    return repoAvailable && !!repoJoined;
  }, [session?.user?.email, project, isOwner, repoAvailable, repoJoined]);

  useEffect(() => {
    if (isOwner && !repoJoined) {
      setRepoJoined(true);
    }
  }, [isOwner, repoJoined]);

  const mostPrioritaryAssigned = useMemo(
    () => isMostPrioritaryAssigned(tasks, currentEmail),
    [tasks, currentEmail]
  );

  // --------- Cargar tablero desde backend ---------
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
          throw new Error(
            data.error || 'No se pudo cargar el proyecto de la comunidad'
          );
        }

        const data = (await res.json()) as BoardResponse;

        // ✅ Garantizar columna review aunque backend aún no la devuelva
        const cols = Array.isArray(data.columns) ? [...data.columns] : [];
        if (!cols.find((c) => c.id === 'review')) {
          // Insertamos review entre doing y done si existe, si no al final
          const doingIdx = cols.findIndex((c) => c.id === 'doing');
          const insertAt = doingIdx >= 0 ? doingIdx + 1 : cols.length;
          cols.splice(insertAt, 0, { id: 'review', title: 'Revisión', order: 3 } as BoardColumn);
          // Ajuste suave de order si quieres (opcional)
          cols.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        const ownerMatch =
          !!session?.user?.email && session.user.email === data.project.ownerEmail;
        const initialRepoJoined = ownerMatch
          ? true
          : Boolean(
              (data as any).repoJoined ??
              (data.project as any)?.repoJoined ??
              false
            );

        setProject(data.project);
        setColumns(cols);
        setTasks(data.tasks);
        setRepoJoined(initialRepoJoined);
      } catch (err: any) {
        console.error('[community-board] Error cargando tablero', err);
        setError(err.message || 'No se pudo cargar el proyecto de la comunidad');
      } finally {
        setLoading(false);
      }
    };

    loadBoard();
  }, [router.isReady, id, router, session?.user?.email]);

  // --------- WebSocket boardUpdated ---------
  useEffect(() => {
    if (!project?.id) return;

    if (!socket) {
      socket = ioClient(API_BASE, {
        withCredentials: true,
        transports: ["websocket"],
        reconnection: true,
      });

      socket.on("connect", () => console.log("[socket] connected", socket?.id));
      socket.on("disconnect", (r) => console.log("[socket] disconnected", r));
      socket.on("connect_error", (e) => console.log("[socket] connect_error", e.message));
    }

    const joinRoom = () => {
      socket?.emit("community:join", { projectId: project.id });
    };

    socket.on("connect", joinRoom);
    joinRoom();

    const handleBoardUpdated = (payload: { projectId: string; tasks: BoardTask[] }) => {
      if (payload.projectId !== project.id) return;
      setTasks(payload.tasks);
    };

    const handleUserInvited = (payload: { projectId: string; userEmail?: string }) => {
      if (payload.projectId !== project.id) return;
      if (payload.userEmail && currentEmail && payload.userEmail !== currentEmail) return;
      setRepoInvitationBanner(true);
    };

    socket.on("community:boardUpdated", handleBoardUpdated);
    socket.on("community:userInvitedToRepo", handleUserInvited);

    return () => {
      socket?.off("connect", joinRoom);
      socket?.off("community:boardUpdated", handleBoardUpdated);
      socket?.off("community:userInvitedToRepo", handleUserInvited);
      socket?.emit("community:leave", { projectId: project.id });
    };
  }, [project?.id, currentEmail]);

  // --------- Drag & drop ---------
  const handleDragStart = (taskId: string, columnId: ColumnId) => {
    if (!session?.user?.email) return;
    if (!canCollaborate) return;
    if (columnId === 'done') return; // done congelado (no se arrastra)
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  // ✅ Modal helpers
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
      // ✅ doing -> review => abrir modal (submit-review)
      if (sourceColumn === 'doing' && targetColumn === 'review') {
        // Solo el assigned puede mandar a review
        if (!currentEmail || task.assigneeEmail !== currentEmail) {
          setDraggedTaskId(null);
          return;
        }
        openModalFor('submit', task.id);
        setDraggedTaskId(null);
        return;
      }

      // ✅ review -> done => owner aprueba (approve-review)
      if (sourceColumn === 'review' && targetColumn === 'done') {
        if (!isOwner || !currentEmail) {
          setDraggedTaskId(null);
          return;
        }
        openModalFor('approve', task.id);
        setDraggedTaskId(null);
        return;
      }

      // ✅ review -> todo => owner rechaza (reject-review)
      if (sourceColumn === 'review' && targetColumn === 'todo') {
        if (!isOwner || !currentEmail) {
          setDraggedTaskId(null);
          return;
        }
        openModalFor('reject', task.id);
        setDraggedTaskId(null);
        return;
      }

      // ⚠️ Bloqueo si no tiene repo (o no ha aceptado invitación)
      if (!canCollaborate) {
        setActionMessage(null);
        setActionError('Necesitas acceso al repositorio para mover tareas.');
        setDraggedTaskId(null);
        return;
      }

      // todo -> doing  => assign (asigna avatar)
      if (sourceColumn === 'todo' && targetColumn === 'doing') {
        setMutatingTaskId(task.id);

        const res = await fetch(
          `${API_BASE}/community/projects/${project.id}/tasks/${task.id}/assign`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userEmail: currentEmail,
              userAvatar: currentAvatar,
            }),
          }
        );

        const data = await res.json().catch(() => ({} as any));
        if (!res.ok)
          throw new Error(
            mapRepoError((data as any).error) ||
              (data as any).error ||
              'No se pudo asignar la tarea'
          );

        setTasks(data.tasks as BoardTask[]);
      }

      // doing -> done => complete (mantiene avatar)
      // ✅ Si quieres que DONE sea SOLO por approve desde review:
      // elimina este bloque.
      else if (sourceColumn === 'doing' && targetColumn === 'done') {
        setMutatingTaskId(task.id);

        const res = await fetch(
          `${API_BASE}/community/projects/${project.id}/tasks/${task.id}/complete`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: currentEmail }),
          }
        );

        const data = await res.json().catch(() => ({} as any));
        if (!res.ok)
          throw new Error(
            mapRepoError((data as any).error) ||
              (data as any).error ||
              'No se pudo marcar la tarea como hecha'
          );

        setTasks(data.tasks as BoardTask[]);
      }

      // doing -> todo => unassign (borra avatar)
      else if (sourceColumn === 'doing' && targetColumn === 'todo') {
        setMutatingTaskId(task.id);

        const res = await fetch(
          `${API_BASE}/community/projects/${project.id}/tasks/${task.id}/unassign`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userEmail: currentEmail }),
          }
        );

        const data = await res.json().catch(() => ({} as any));
        if (!res.ok)
          throw new Error(
            mapRepoError((data as any).error) ||
              (data as any).error ||
              'No se pudo desasignar la tarea'
          );

        setTasks(data.tasks as BoardTask[]);
      }

      // Extra opcional: permitir review -> doing (dev continúa) si backend lo soporta
      // else if (sourceColumn === 'review' && targetColumn === 'doing') { ... }

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
    const map: Record<ColumnId, BoardTask[]> = {
      todo: [],
      doing: [],
      review: [],
      done: [],
    };

    for (const task of tasks) {
      const col = (task.columnId || 'todo') as ColumnId;
      // Si por cualquier bug llega algo fuera de enum, cae en todo
      const safeCol: ColumnId = (['todo', 'doing', 'review', 'done'].includes(col) ? col : 'todo') as ColumnId;
      map[safeCol].push(task);
    }

    (Object.keys(map) as ColumnId[]).forEach((col) => {
      map[col].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    });

    return map;
  }, [tasks]);

  // --------- Día 10: acciones verificación (ahora via endpoints community) ---------
  const submitForReview = async () => {
    if (!modalTaskId || !project?.id) return;
    try {
      setModalLoading(true);
      setModalErr(null);

      const res = await fetch(
        `${API_BASE}/community/projects/${project.id}/tasks/${modalTaskId}/submit-review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: currentEmail,
            notes: modalNotes,
          }),
        }
      );

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar a revisión');

      if (Array.isArray(data.tasks)) setTasks(data.tasks as BoardTask[]);
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

      const res = await fetch(
        `${API_BASE}/community/projects/${project.id}/tasks/${modalTaskId}/${endpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewerEmail: currentEmail,
            notes: modalNotes,
          }),
        }
      );

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data.error || 'No se pudo revisar la tarea');

      if (Array.isArray(data.tasks)) setTasks(data.tasks as BoardTask[]);
      closeModal();
    } catch (e: any) {
      setModalErr(e.message || 'Error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleLinkRepo = async (task: BoardTask) => {
    if (!project?.id || !currentEmail || !githubIntegration.connected) return;
    const repo = (repoInputs[task.id] ?? task.repoFullName ?? '').trim();
    if (!repo) {
      setActionError('Indica el repositorio como owner/repo.');
      return;
    }

    try {
      setLinkingTaskId(task.id);
      setActionError(null);
      setActionMessage(null);

      const res = await fetch(
        `${API_BASE}/community/projects/${project.id}/tasks/${task.id}/link-repo`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: currentEmail, repoFullName: repo }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error((data as any).error || 'No se pudo vincular el repositorio');

      if (Array.isArray((data as any).tasks)) {
        setTasks((data as any).tasks as BoardTask[]);
      }
      setActionMessage('Repositorio vinculado correctamente.');
    } catch (err: any) {
      console.error('[github] link repo error', err);
      setActionError(err?.message || 'Error al vincular el repositorio');
    } finally {
      setLinkingTaskId(null);
    }
  };

  const handleRunVerification = async (task: BoardTask) => {
    if (!project?.id || !currentEmail) return;

    try {
      setVerifyingTaskId(task.id);
      setActionError(null);
      setActionMessage(null);

      const res = await fetch(
        `${API_BASE}/community/projects/${project.id}/tasks/${task.id}/run-verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: currentEmail }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error((data as any).error || 'No se pudo ejecutar la verificación');

      if (Array.isArray((data as any).tasks)) {
        setTasks((data as any).tasks as BoardTask[]);
      }
      setActionMessage('Verificación solicitada.');
    } catch (err: any) {
      console.error('[github] verify error', err);
      setActionError(err?.message || 'Error al ejecutar la verificación');
    } finally {
      setVerifyingTaskId(null);
    }
  };

  const handleJoinRepo = async () => {
    if (!project?.id) return;
    try {
      setJoiningRepo(true);
      setRepoStatusError(null);
      setRepoStatusMessage(null);

      const res = await fetch(`${API_BASE}/community/projects/${project.id}/repo/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: currentEmail,
        }),
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
    } catch (err: any) {
      setRepoStatusError(err?.message || 'No se pudo unir al repositorio');
    } finally {
      setJoiningRepo(false);
    }
  };

  // --------- Render de estados especiales ---------
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
          <h1 className="mb-2 text-xl font-bold text-slate-900">
            Proyecto de comunidad no disponible
          </h1>
          <p className="mb-4 text-slate-600">
            {error || 'No se pudo cargar el proyecto de la comunidad'}
          </p>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Comunidad
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {project.title}
              </h1>
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
            Publicado por <span className="font-medium">{project.ownerEmail}</span>.
            Los desarrolladores pueden arrastrar tareas entre columnas para colaborar.
          </p>

          {repoInvitationBanner && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
              <p className="font-semibold">Has sido invitado al repositorio.</p>
              {project.projectRepo && (
                <Link
                  href={`https://github.com/${project.projectRepo}`}
                  target="_blank"
                  className="rounded-md bg-blue-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800"
                >
                  Abrir repositorio
                </Link>
              )}
            </div>
          )}

          {!session?.user?.email && (
            <p className="mt-3 text-xs text-amber-600">
              Inicia sesión para poder interactuar con las tareas.
            </p>
          )}

          {isOwner && (
            <p className="mt-3 text-xs text-slate-500">
              Estás viendo tu propio proyecto. Puedes aprobar o rechazar tareas en revisión y
              gestionar el tablero sin unirte al repositorio.
            </p>
          )}

          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {project.projectRepo ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Repositorio</p>
                  <p className="text-xs text-slate-600">{project.projectRepo}</p>
                </div>
                <Link
                  href={`https://github.com/${project.projectRepo}`}
                  target="_blank"
                  className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Abrir en GitHub
                </Link>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-amber-700">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="text-sm font-semibold">Repositorio no disponible.</p>
                  <p className="text-xs">
                    Repositorio no disponible. El proyecto no se publicó correctamente.
                  </p>
                </div>
              </div>
            )}

            {!isOwner && project.projectRepo && !repoJoined && (
              <div className="space-y-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <p className="font-semibold">Antes de colaborar debes unirte al repositorio.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleJoinRepo}
                    disabled={joiningRepo || !session?.user?.email}
                    className="rounded-lg bg-amber-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                  >
                    {joiningRepo ? 'Solicitando acceso…' : 'Unirme al repo'}
                  </button>
                  {project.projectRepo && (
                    <Link
                      href={`https://github.com/${project.projectRepo}`}
                      target="_blank"
                      className="rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                    >
                      Abrir repositorio
                    </Link>
                  )}
                </div>
                {repoStatusError && <p className="text-[11px] text-red-700">{repoStatusError}</p>}
                {repoStatusMessage && (
                  <p className="text-[11px] text-emerald-700">{repoStatusMessage}</p>
                )}
              </div>
            )}

            {!isOwner && project.projectRepo && repoJoined && (
              <div className="flex items-start gap-2 text-emerald-700">
                <span className="text-lg">✅</span>
                <div>
                  <p className="text-sm font-semibold">Acceso al repositorio confirmado.</p>
                  <p className="text-xs text-slate-700">
                    Ya puedes mover tareas en el tablero.
                  </p>
                  <div className="mt-2">
                    <Link
                      href={`https://github.com/${project.projectRepo}`}
                      target="_blank"
                      className="inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-800"
                    >
                      Abrir repositorio
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {(actionMessage || actionError) && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-xs ${actionMessage
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
                }`}
            >
              {actionMessage || actionError}
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
                  // Owners también interactúan para review->done/todo
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
                  <h2 className="text-sm font-semibold text-slate-800">
                    {column.title}
                  </h2>
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
                      const isAssignedToMe =
                        currentEmail && task.assigneeEmail === currentEmail;

                      const isMutating = mutatingTaskId === task.id;

                      const canShowGithubSection =
                        isAssignedToMe &&
                        task.columnId === 'doing' &&
                        (isPriorityOne(task) || mostPrioritaryAssigned(task));

                      const repoValue = repoInputs[task.id] ?? task.repoFullName ?? '';

                      const showVerificationActions =
                        task.columnId === 'review' && (isAssignedToMe || isOwner);

                      // Mensaje solo en DOING
                      const showAssignmentMessage =
                        isAssignedToMe && task.columnId === 'doing';

                      const badge = getTaskBadge(task);

                      return (
                        <article
                          key={task.id}
                          className="relative cursor-default rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200"
                          draggable={
                            // ✅ devs pueden arrastrar excepto done
                            // ✅ owner también puede arrastrar desde review a done/todo (y lo usamos en handleDrop)
                            session?.user?.email && canCollaborate && task.columnId !== 'done'
                              ? true
                              : undefined
                          }
                          onDragStart={() => handleDragStart(task.id, task.columnId)}
                          onDragEnd={handleDragEnd}
                        >
                          {/* Badge estado/verificación */}
                          <div className="absolute right-3 top-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                              {badge.label}
                            </span>
                          </div>

                          <header className="mb-2 flex items-start justify-between gap-2 pr-16">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {task.title}
                            </h3>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              {task.layer}
                            </span>
                          </header>

                          {/* Avatar centrado */}
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

                          <p className="mb-3 text-xs text-slate-600">
                            {task.description}
                          </p>

                          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                            <span>Prioridad: {task.priority}</span>
                            <span className="font-semibold text-slate-900">
                              {formatPrice(task.price)}
                            </span>
                          </div>

                          {showAssignmentMessage && (
                            <p className="mt-1 text-[11px] text-emerald-600">
                              Esta tarea está asignada a ti.
                            </p>
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
                                <p className="text-[11px] text-red-600">
                                  {githubIntegration.error}
                                </p>
                              )}

                              {!githubIntegration.connected ? (
                                <button
                                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-800"
                                  onClick={() => {
                                    if (!currentEmail) return;
                                    window.location.href =
                                      `${API_BASE}/integrations/github/login` +
                                      `?userEmail=${encodeURIComponent(currentEmail)}` +
                                      `&returnTo=${encodeURIComponent(`/community/${project.id}`)}`;

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
                                  <label className="text-[11px] font-semibold text-slate-700">
                                    Vincula tu repo
                                  </label>
                                  <input
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] outline-none focus:border-blue-500"
                                    placeholder="owner/repo"
                                    value={repoValue}
                                    onChange={(e) =>
                                      setRepoInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                                    }
                                    disabled={linkingTaskId === task.id}
                                  />
                                  <button
                                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                    disabled={linkingTaskId === task.id}
                                    onClick={() => handleLinkRepo(task)}
                                  >
                                    {linkingTaskId === task.id ? 'Vinculando…' : 'Vincular repo'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {showVerificationActions && (
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

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                  onClick={() => handleRunVerification(task)}
                                  disabled={verifyingTaskId === task.id}
                                >
                                  {verifyingTaskId === task.id ? 'Ejecutando…' : 'Ejecutar verificación'}
                                </button>

                                {task.lastRunUrl && (
                                  <Link
                                    href={task.lastRunUrl}
                                    target="_blank"
                                    className="text-[11px] font-semibold text-indigo-700 underline"
                                  >
                                    Última ejecución
                                  </Link>
                                )}
                              </div>

                              {task.checkStatus === 'FAILED' && (
                                <p className="text-[11px] text-red-600">
                                  Corrige y vuelve a enviar.
                                </p>
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

                          {isMutating && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              Actualizando…
                            </p>
                          )}
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
              <button
                className="text-slate-500 hover:text-slate-700"
                onClick={closeModal}
                disabled={modalLoading}
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-600">
              Añade notas (opcional). Quedarán guardadas en la verificación.
            </p>

            <textarea
              className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-sm"
              rows={5}
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="Notas..."
              disabled={modalLoading}
            />

            {modalErr && (
              <p className="mt-2 text-xs font-semibold text-red-600">{modalErr}</p>
            )}

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
