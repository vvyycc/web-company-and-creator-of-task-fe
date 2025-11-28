import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';

export default function DashboardPage() {
  const { data: session, status } = useSession();

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
          <h1 className="mb-4 text-2xl font-bold text-slate-900">
            Necesitas iniciar sesión con Google para acceder al dashboard
          </h1>
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
      <div className="mx-auto max-w-4xl space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-slate-500">Dashboard</p>
            <h1 className="text-3xl font-bold text-slate-900">Hola, {session.user?.name}</h1>
            <p className="text-sm text-slate-600">Email: {session.user?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/tools/generator"
            className="block rounded-xl border border-slate-200 p-6 transition hover:-translate-y-1 hover:shadow-lg"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Herramienta</p>
            <h2 className="text-xl font-bold text-slate-900">Generador de tareas y presupuesto</h2>
            <p className="mt-2 text-sm text-slate-600">
              Divide tu proyecto en tareas priorizadas con un coste estimado.
            </p>
          </Link>

          <Link
            href="/tools/post-project"
            className="block rounded-xl border border-slate-200 p-6 transition hover:-translate-y-1 hover:shadow-lg"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Herramienta</p>
            <h2 className="text-xl font-bold text-slate-900">Publicar proyecto en la comunidad</h2>
            <p className="mt-2 text-sm text-slate-600">
              Marca tu proyecto como publicado para compartirlo con la comunidad.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
