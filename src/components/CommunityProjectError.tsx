import Link from 'next/link';

export default function CommunityProjectError() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl bg-white p-8 text-center shadow-md">
      <h2 className="text-2xl font-bold text-slate-900">Proyecto de comunidad no disponible</h2>
      <p className="mt-2 text-slate-600">
        No se pudo cargar el proyecto de la comunidad
      </p>
      <Link
        href="/tools/generator"
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Volver al generador
      </Link>
    </div>
  );
}
