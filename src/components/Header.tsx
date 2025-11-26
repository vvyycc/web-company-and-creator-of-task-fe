// src/components/Header.tsx
export default function Header() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        {/* Nombre de la empresa */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            DA
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">
              Digital Automation Studio
            </div>
            <div className="text-xs text-slate-500">
              Automatización · Web3 · Backend
            </div>
          </div>
        </div>

        {/* Menú */}
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#services" className="hover:text-blue-600">
            Servicios
          </a>
          <a href="#how-we-work" className="hover:text-blue-600">
            Cómo trabajamos
          </a>
          <a href="#tools" className="hover:text-blue-600">
            Herramientas
          </a>
          <a
            href="#contact"
            className="rounded-full bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Contacto
          </a>
        </nav>
      </div>
    </header>
  );
}
