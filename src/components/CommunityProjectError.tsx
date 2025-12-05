import Link from 'next/link';

export default function CommunityProjectError() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl bg-white p-8 text-center shadow-md">
      <h2 className="text-2xl font-bold text-slate-900">Proyecto de comunidad no disponible</h2>
      <p className="mt-2 text-slate-600">Proyecto de comunidad no encontrado</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
        >
          Volver al dashboard
        </Link>
        <Link
          href="/tools/generator"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Volver al generador
        </Link>
      </div>
    </div>
  );
}
