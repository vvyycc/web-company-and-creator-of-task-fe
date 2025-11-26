const services = [
  {
    id: 'automation',
    title: 'Automatización de procesos',
    description:
      'Bots, integraciones, RPA y scraping que conectan tus sistemas y eliminan tareas repetitivas con flujos auditables.',
    items: ['Integraciones API/No-Code', 'Workflows y orquestación', 'RPA y asistentes inteligentes'],
  },
  {
    id: 'web3',
    title: 'Blockchain & Web3',
    description: 'Diseño y desarrollo de smart contracts, tokens, NFTs, dApps y componentes DeFi listos para producción.',
    items: ['Smart contracts auditables', 'Tokens, NFTs y marketplaces', 'Integración con wallets y on/off ramps'],
  },
  {
    id: 'web2',
    title: 'Web2 + Backend',
    description: 'Aplicaciones web modernas con API segura, paneles de administración y métricas en tiempo real.',
    items: ['APIs REST y GraphQL', 'Paneles operativos y dashboards', 'Integraciones con CRM/ERP/BI'],
  },
];

export default function ServicesSection() {
  return (
    <section id="services" className="bg-slate-50 py-16 lg:py-24">
      <div className="section-container space-y-12">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">Servicios</p>
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Tecnología que se adapta a tu negocio
          </h2>
          <p className="text-lg text-slate-600">
            Equipos expertos que te acompañan desde la idea hasta el lanzamiento. Trabajamos contigo, no solo para ti.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article key={service.id} className="card flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">{service.title}</h3>
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                  {service.id === 'automation' && 'RPA & AI'}
                  {service.id === 'web3' && 'Smart contracts'}
                  {service.id === 'web2' && 'APIs & Apps'}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{service.description}</p>
              <ul className="space-y-2 text-sm text-slate-700">
                {service.items.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
