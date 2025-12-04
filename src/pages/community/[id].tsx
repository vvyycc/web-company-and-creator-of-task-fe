// src/pages/community/[id].tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

type ColumnId = 'todo' | 'doing' | 'done';

type BoardColumn = {
  id: ColumnId;
  title: string;
  order: number;
};

type BoardTask = {
  id: string;
  title: string;
  description: string;
  priority: number;
  layer: string;
  columnId: ColumnId;
  price: number;
};

type BoardResponse = {
  project: {
    id: string;
    title: string;
    description: string;
    ownerEmail: string;
    published: boolean;
  };
  columns: BoardColumn[];
  tasks: BoardTask[];
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

export default function CommunityProjectBoardPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardResponse | null>(null);

  useEffect(() => {
    if (!router.isReady || !id || typeof id !== 'string') return;

    const loadBoard = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/community/projects/${id}/board`);

        if (!res.ok) {
          console.error('[community-board] HTTP error', res.status);
          setError('No se pudo cargar el proyecto de la comunidad');
          setLoading(false);
          return;
        }

        const data: BoardResponse = await res.json();
        setBoard(data);
      } catch (err) {
        console.error('[community-board] Error fetching board', err);
        setError('No se pudo cargar el proyecto de la comunidad');
      } finally {
        setLoading(false);
      }
    };

    loadBoard();
  }, [router.isReady, id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-lg font-semibold text-slate-700">Cargando proyecto de la comunidad…</p>
      </main>
    );
  }

  if (error || !board) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            Proyecto de comunidad no disponible
          </h1>
          <p className="mb-6 text-slate-600">{error ?? 'No se pudo cargar el proyecto de la comunidad'}</p>
          <button
            onClick={() => router.push('/tools/generator')}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Volver al generador
          </button>
        </div>
      </main>
    );
  }

  const columnsWithTasks = board.columns
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((column) => ({
      ...column,
      tasks: board.tasks
        .filter((t) => t.columnId === column.id)
        .sort((a, b) => a.priority - b.priority),
    }));

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Comunidad</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">{board.project.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{board.project.description}</p>
          <p className="mt-3 text-xs text-slate-500">
            Publicado por <span className="font-medium">{board.project.ownerEmail}</span>. Los
            desarrolladores pueden elegir tareas de este tablero para colaboraciones.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {columnsWithTasks.map((column) => (
            <div key={column.id} className="flex flex-col rounded-xl bg-slate-100 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">{column.title}</h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                  {column.tasks.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                {column.tasks.map((task) => (
                  <article
                    key={task.id}
                    className="rounded-lg bg-white p-3 text-sm shadow-sm transition hover:shadow-md"
                  >
                    <header className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        {task.layer}
                      </span>
                    </header>
                    <p className="mt-1 line-clamp-3 text-xs text-slate-600">{task.description}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                      <span>Prioridad: {task.priority}</span>
                      <span className="font-semibold text-slate-900">
                        {formatPrice(task.price ?? 0)}
                      </span>
                    </div>
                  </article>
                ))}

                {column.tasks.length === 0 && (
                  <p className="mt-4 text-center text-xs text-slate-500">
                    No hay tareas en esta columna todavía.
                  </p>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
