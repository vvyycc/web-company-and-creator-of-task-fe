import { FormEvent, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';

interface PublishResponse {
  project: {
    id: string;
    title: string;
    description: string;
    tasks: { id?: string; title: string; price: number }[];
    totalTasksPrice: number;
    generatorFee: number;
    platformFeePercent: number;
    published: boolean;
  };
  pricing: {
    taskGeneratorFixedPriceEur: number;
    platformFeePercent: number;
  };
}

export default function PostProjectPage() {
  const { data: session, status } = useSession();
  const [projectId, setProjectId] = useState('');
  const [responseData, setResponseData] = useState<PublishResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResponseData(null);

    try {
      const response = await fetch(`http://localhost:4000/projects/${projectId}/publish`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('No se pudo publicar el proyecto.');
      }

      const data = (await response.json()) as PublishResponse;
      setResponseData(data);
    } catch (err: any) {
      setError(err.message || 'Error al publicar el proyecto.');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-lg font-semibold text-slate-700">Cargando…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-4 text-2xl font-bold text-slate-900">Acceso restringido</h1>
          <p className="mb-4 text-slate-600">
            Necesitas iniciar sesión con Google para publicar tus proyectos en la comunidad.
          </p>
          <button
            onClick={() => signIn('google')}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Iniciar sesión con Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-8 rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Herramienta</p>
          <h1 className="text-3xl font-bold text-slate-900">Publicar proyecto en la comunidad</h1>
          <p className="text-slate-600">
            Usa el identificador del proyecto generado para publicarlo y hacerlo visible en la comunidad.
          </p>
        </div>

        <form onSubmit={handlePublish} className="grid gap-6 rounded-xl border border-slate-200 p-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800" htmlFor="projectId">
              ID del proyecto generado
            </label>
            <input
              id="projectId"
              name="projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Ej. proj_123"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={isLoading}
          >
            {isLoading ? 'Publicando proyecto…' : 'Publicar proyecto en la comunidad'}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {responseData && (
          <div className="space-y-4 rounded-xl border border-slate-200 p-6">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Proyecto publicado</p>
              <h2 className="text-2xl font-bold text-slate-900">{responseData.project.title}</h2>
              <p className="text-slate-700">{responseData.project.description}</p>
            </div>

            <div className="grid gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
              <p>
                <span className="font-semibold text-slate-900">Total de tareas:</span> {responseData.project.tasks.length}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Precio total:</span> € {responseData.project.totalTasksPrice}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Fee de la plataforma:</span> 1%
              </p>
              <p>
                <span className="font-semibold text-slate-900">Estado:</span> {responseData.project.published ? 'Publicado' : 'Pendiente'}
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-700">
              <p className="mb-2 font-semibold text-slate-900">Respuesta completa</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-700">
{JSON.stringify(responseData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
