import Link from 'next/link';

export default function Hero() {
  return (
    <header className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-white to-white">
      <div className="absolute inset-x-0 -top-48 -z-10 h-80 bg-primary-100/40 blur-3xl" aria-hidden />
      <div className="section-container flex flex-col gap-12 py-16 lg:flex-row lg:items-center lg:py-24">
        <div className="flex-1 space-y-6">
          <span className="inline-flex items-center rounded-full bg-primary-100 px-4 py-2 text-sm font-medium text-primary-700">
            B-Chain Automation Studio
          </span>
          <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Soluciones digitales que combinan automatización, Web3 y backend a medida.
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            Diseñamos, construimos e integramos productos que aceleran tu negocio: bots, flujos automatizados, smart contracts y aplicaciones modernas listas para escalar.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="#contact" className="btn-primary">
              Contactar
            </Link>
            <Link
              href="#services"
              className="inline-flex items-center rounded-full border border-slate-200 px-6 py-3 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:text-primary-700"
            >
              Ver servicios
            </Link>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary-500" />
              Entregas ágiles y acompañamiento cercano
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary-500" />
              Tecnologías Web2, Web3 y RPA
            </div>
          </div>
        </div>
        <div className="flex-1">
          <div className="relative">
            <div className="absolute -left-10 -top-10 h-24 w-24 rounded-full bg-primary-100/70 blur-3xl" />
            <div className="absolute -right-6 -bottom-10 h-28 w-28 rounded-full bg-primary-200/60 blur-3xl" />
            <div className="card relative overflow-hidden">
              <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
                <span>Toolkit digital</span>
                <span className="flex items-center gap-2 text-primary-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Activo
                </span>
              </div>
              <div className="space-y-4 text-slate-700">
                <div className="rounded-xl bg-primary-50/80 p-4">
                  <p className="text-xs uppercase tracking-wide text-primary-700">Automatización</p>
                  <p className="mt-2 text-base font-semibold text-primary-800">
                    Bots, integraciones y RPA listos para liberar horas repetitivas.
                  </p>
                </div>
                <div className="rounded-xl bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-primary-700">Web3</p>
                  <p className="mt-2 text-base font-semibold text-primary-800">
                    Smart contracts auditables y dApps con UX moderna.
                  </p>
                </div>
                <div className="rounded-xl bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-primary-700">Backend</p>
                  <p className="mt-2 text-base font-semibold text-primary-800">
                    APIs seguras, paneles operativos y métricas en tiempo real.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
