import { FormEvent, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';

interface GeneratedTask {
  id?: string;
  title: string;
  description: string;
  priority: string;
  layer: string;
  price: number;
}

interface GeneratedProjectResponse {
  project: {
    id: string;
    title: string;
    description: string;
    tasks: GeneratedTask[];
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

export default function GeneratorPage() {
  const { data: session, status } = useSession();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [result, setResult] = useState<GeneratedProjectResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('http://localhost:4000/projects/generate-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerEmail: ownerEmail || session?.user?.email,
          title,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo generar el proyecto. Inténtalo de nuevo.');
      }

      const data = (await response.json()) as GeneratedProjectResponse;
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error al generar tareas.');
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
            Necesitas iniciar sesión con Google para usar el generador de tareas.
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
      <div className="mx-auto max-w-5xl space-y-8 rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Herramienta</p>
          <h1 className="text-3xl font-bold text-slate-900">Generador de tareas y presupuesto</h1>
          <p className="text-slate-600">
            Divide tu proyecto en tareas con prioridad, capa técnica y precio estimado. Este servicio tiene un
            precio fijo de 30 € por generar el proyecto en tareas con prioridad y precio.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 rounded-xl border border-slate-200 p-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800" htmlFor="title">
              Título del proyecto
            </label>
            <input
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Ej. Automatización de flujos Web3"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800" htmlFor="description">
              Descripción del proyecto
            </label>
            <textarea
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Describe las necesidades, el stack o los objetivos principales"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800" htmlFor="ownerEmail">
              Email del propietario
            </label>
            <input
              id="ownerEmail"
              name="ownerEmail"
              type="email"
              value={ownerEmail || session.user?.email || ''}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
              disabled={Boolean(session.user?.email && !ownerEmail)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-slate-700 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder="tu@email.com"
            />
            <p className="text-xs text-slate-500">Usaremos este email para asociar el proyecto generado.</p>
          </div>

          <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              Este servicio tiene un precio fijo de <strong>30 €</strong> por generar el proyecto en tareas con prioridad y
              precio.
            </p>
            <p>La plataforma aplicará una comisión del 1% cuando el proyecto se ejecute.</p>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            disabled={isLoading}
          >
            {isLoading ? 'Generando tareas…' : 'Generar tareas'}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {result && (
          <div className="space-y-4 rounded-xl border border-slate-200 p-6">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Resultado</p>
              <h2 className="text-2xl font-bold text-slate-900">{result.project.title}</h2>
              <p className="text-slate-700">{result.project.description}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-slate-700">Título</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Descripción</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Prioridad</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Capa</th>
                    <th className="px-4 py-2 font-semibold text-slate-700">Precio (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.project.tasks.map((task, index) => (
                    <tr key={task.id || index} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-semibold text-slate-900">{task.title}</td>
                      <td className="px-4 py-2 text-slate-700">{task.description}</td>
                      <td className="px-4 py-2 text-slate-700">{task.priority}</td>
                      <td className="px-4 py-2 text-slate-700">{task.layer}</td>
                      <td className="px-4 py-2 text-slate-900">€ {task.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
              <p>
                <span className="font-semibold text-slate-900">Precio total de tareas:</span> € {result.project.totalTasksPrice}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Precio fijo del generador:</span> € {result.pricing.taskGeneratorFixedPriceEur}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Fee de la plataforma:</span> {result.pricing.platformFeePercent}%
              </p>
              <p>
                <span className="font-semibold text-slate-900">Estado de publicación:</span>{' '}
                {result.project.published ? 'Publicado' : 'Pendiente de publicar'}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
