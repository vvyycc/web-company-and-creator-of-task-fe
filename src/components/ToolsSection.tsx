// src/components/ToolsSection.tsx
export default function ToolsSection() {
  return (
    <section>
      <div className="mx-auto max-w-6xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          Herramientas
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">
          Herramientas que usamos para gestionar tu proyecto
        </h2>
        <p className="mt-3 text-sm text-slate-600 md:text-base">
          Organizamos tu proyecto como un tablero tipo Trello: tareas, columnas
          <span className="font-semibold"> “Por hacer · En progreso · Hecho”</span>,
          presupuestos por tarea y visibilidad total del avance.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl gap-6 px-2 md:grid-cols-3 md:px-0">
        <div className="rounded-2xl bg-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Tablero de tareas
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Desglosamos tu proyecto en tareas claras con esfuerzo estimado y
            precio asociado por tarea.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Automatización de estimaciones
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            El sistema suma automáticamente todas las tareas para mostrarte el
            presupuesto total del proyecto.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            Seguimiento en tiempo real
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Ves cómo las tareas se mueven entre columnas y qué parte del
            presupuesto ya está completada.
          </p>
        </div>
      </div>
    </section>
  );
}
