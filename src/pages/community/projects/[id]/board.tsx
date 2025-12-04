import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import CommunityProjectError from '@/components/CommunityProjectError';

type BoardTask = {
  id?: string;
  title: string;
  description?: string;
};

type BoardColumn = {
  id?: string;
  title: string;
  tasks?: BoardTask[];
};

export default function CommunityProjectBoardPage() {
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const router = useRouter();
  const { id } = router.query;

  const [board, setBoard] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (typeof id !== 'string') return;

    const fetchBoard = async () => {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);

        const res = await fetch(`${API_BASE}/community/projects/${id}/board`);

        if (res.status === 404) {
          setNotFound(true);
          return;
        }

        if (!res.ok) {
          throw new Error('No se pudo cargar el tablero de este proyecto.');
        }

        const data = await res.json();
        const columns: BoardColumn[] = Array.isArray(data?.columns)
          ? data.columns
          : Array.isArray(data)
          ? data
          : [];

        setBoard(columns);
      } catch (err: any) {
        console.error('[community] Error fetching board', err);
        setError(err.message || 'No se pudo cargar el tablero.');
      } finally {
        setLoading(false);
      }
    };

    fetchBoard();
  }, [API_BASE, id, router.isReady]);

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

        {board.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
            El tablero todavía no está disponible para este proyecto.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {board.map((column) => (
              <div key={column.id ?? column.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-900">{column.title}</h2>
                <div className="mt-3 space-y-3">
                  {column.tasks && column.tasks.length > 0 ? (
                    column.tasks.map((task) => (
                      <div key={task.id ?? task.title} className="rounded-lg bg-white p-3 shadow-sm">
                        <p className="font-semibold text-slate-900">{task.title}</p>
                        <p className="text-sm text-slate-600">{task.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Sin tareas en esta columna.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
