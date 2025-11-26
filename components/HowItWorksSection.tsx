const steps = [
  {
    title: '1. Descubrimiento y plan',
    description: 'Entendemos tus procesos, definimos objetivos y elegimos la tecnología adecuada para crear un plan de entrega ágil.',
  },
  {
    title: '2. Prototipo y validación',
    description: 'Desarrollamos un MVP funcional con integraciones y smart contracts listos para probar con usuarios reales.',
  },
  {
    title: '3. Lanzamiento y acompañamiento',
    description: 'Puesta en producción segura, monitoreo y evolución continua con mejoras iterativas orientadas al negocio.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-16 lg:py-24">
      <div className="section-container space-y-12">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">Cómo trabajamos</p>
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Proyectos claros en 3 pasos</h2>
          <p className="text-lg text-slate-600">Transparencia, entregas rápidas y comunicación constante para que siempre sepas qué ocurre.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="card relative h-full">
              <span className="absolute -top-4 left-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-base font-semibold text-white shadow-lg shadow-primary-600/30">
                {index + 1}
              </span>
              <div className="mt-6 space-y-3">
                <h3 className="text-xl font-semibold text-slate-900">{step.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
