// src/pages/community/[id].tsx
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type ColumnId = 'todo' | 'doing' | 'done';
type TaskCategory =
  | 'ARCHITECTURE'
  | 'MODEL'
  | 'SERVICE'
  | 'VIEW'
  | 'INFRA'
  | 'QA';

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
}

interface BoardProject {
  id: string;
  title: string;
  description: string;
  ownerEmail: string;
  published: boolean;
}

interface BoardResponse {
  project: BoardProject;
  columns: BoardColumn[];
  tasks: BoardTask[];
}

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

const formatPrice = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);

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

  const currentEmail = session?.user?.email ?? null;
  const currentAvatar = (session?.user as any)?.image ?? null;

  const isOwner = useMemo(
    () =>
      !!project &&
      !!session?.user?.email &&
      session.user.email === project.ownerEmail,
    [project, session?.user?.email]
  );

  const canInteract = useMemo(
    () => !!session?.user?.email && !!project && !isOwner,
    [session?.user?.email, project, isOwner]
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

        // ⚠️ si el backend devolviera ids duplicados, el drag & drop se rompe.
        // Con el backend corregido ya no debería pasar.
        setProject(data.project);
        setColumns(data.columns);
        setTasks(data.tasks);
      } catch (err: any) {
        console.error('[community-board] Error cargando tablero', err);
        setError(err.message || 'No se pudo cargar el proyecto de la comunidad');
      } finally {
        setLoading(false);
      }
    };

    loadBoard();
  }, [router.isReady, id, router]);

  // --------- Drag & drop ---------
  const handleDragStart = (taskId: string, columnId: ColumnId) => {
    if (!canInteract) return;
    if (columnId === 'done') return; // done congelado (no se arrastra)
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const handleDropOnColumn = async (targetColumn: ColumnId) => {
    if (!canInteract || !draggedTaskId || !project) return;

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
        if (!res.ok) throw new Error(data.error || 'No se pudo asignar la tarea');

        setTasks(data.tasks as BoardTask[]);
      }

      // doing -> done => complete (mantiene avatar)
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
          throw new Error(data.error || 'No se pudo marcar la tarea como hecha');

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
          throw new Error(data.error || 'No se pudo desasignar la tarea');

        setTasks(data.tasks as BoardTask[]);
      }

      // Bloqueamos:
      // - todo -> done (no permitido)
      // - done -> cualquier cosa (done congelado)
    } catch (err) {
      console.error('[community-board] Error moviendo tarea', err);
    } finally {
      setMutatingTaskId(null);
      setDraggedTaskId(null);
    }
  };

  const tasksByColumn = useMemo(() => {
    const map: Record<ColumnId, BoardTask[]> = {
      todo: [],
      doing: [],
      done: [],
    };

    for (const task of tasks) {
      const col = (task.columnId || 'todo') as ColumnId;
      map[col].push(task);
    }

    (Object.keys(map) as ColumnId[]).forEach((col) => {
      map[col].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    });

    return map;
  }, [tasks]);

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

          {!session?.user?.email && (
            <p className="mt-3 text-xs text-amber-600">
              Inicia sesión para poder interactuar con las tareas.
            </p>
          )}

          {isOwner && (
            <p className="mt-3 text-xs text-slate-500">
              Estás viendo tu propio proyecto. Este tablero es de solo lectura para el creador.
            </p>
          )}
        </div>

        {/* Tablero */}
        <div className="grid gap-4 md:grid-cols-3">
          {columns.map((column) => {
            const columnTasks = tasksByColumn[column.id as ColumnId] ?? [];

            return (
              <div
                key={column.id}
                className="flex min-h-[320px] flex-col rounded-2xl bg-slate-50 p-4"
                onDragOver={(e) => {
                  if (!canInteract) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
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

                      // Mensaje solo en DOING
                      const showAssignmentMessage =
                        isAssignedToMe && task.columnId === 'doing';

                      return (
                        <article
                          key={task.id}
                          className="cursor-default rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200"
                          draggable={
                            canInteract && task.columnId !== 'done'
                              ? true
                              : undefined
                          }
                          onDragStart={() => handleDragStart(task.id, task.columnId)}
                          onDragEnd={handleDragEnd}
                        >
                          <header className="mb-2 flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {task.title}
                            </h3>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              {task.layer}
                            </span>
                          </header>

                          {/* ✅ Avatar centrado: se mantiene también en DONE */}
                          {task.assigneeEmail && task.columnId !== 'todo' && (
                            <div className="mb-2 flex justify-center">
                              {task.assigneeAvatar ? (
                                <img
                                  src={task.assigneeAvatar}
                                  alt={task.assigneeEmail}
                                  className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    // fallback si Google bloquea la URL
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
    </main>
  );
}
