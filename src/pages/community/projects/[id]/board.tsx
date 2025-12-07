import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function CommunityProjectBoardPage() {
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const router = useRouter();
  const { id } = router.query;

  const projectId = typeof id === 'string' ? id : undefined;

  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

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

  const handleSocketEvent = useCallback(
    (event: any) => {
      const updatedTask: BoardTask | undefined = event?.task ?? event;
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
                            {assigneeLabel && (
                              <p className="mt-2 text-xs font-semibold text-blue-600">
                                Asignada a: {assigneeLabel}
                              </p>
                            )}
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
    </main>
  );
}
