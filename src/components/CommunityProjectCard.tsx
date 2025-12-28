import { useMemo } from "react";

type ChecklistItem = {
  id: string;
  title: string;
  layer?: string;
  priority?: number;
  acceptanceCriteria?: string;
};

type ChecklistSection = {
  title: string;
  items: ChecklistItem[];
};

type CommunityListItem = {
  id: string;
  title: string;
  description: string;
  ownerEmail: string;
  totalTasksPrice: number;
  tasksCount: number;
  publishedAt?: string;

  // lo dejo en el tipo por compatibilidad, pero ya NO lo renderizamos aquí
  technicalChecklist?: ChecklistSection[];
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);

function shortText(text: string, max = 180) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max).trim()}…` : s;
}

export function CommunityProjectCard({ item }: { item: CommunityListItem }) {
  // ya no lo usamos, pero si prefieres puedes borrarlo
  useMemo(() => item.technicalChecklist ?? [], [item.technicalChecklist]);

  const descriptionPreview = shortText(item.description, 200);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-slate-900">{item.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Owner: <span className="font-medium">{item.ownerEmail}</span>
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-sm font-bold text-slate-900">{formatPrice(item.totalTasksPrice)}</div>
          <div className="text-xs text-slate-500">{item.tasksCount} tareas</div>
        </div>
      </div>

      {descriptionPreview ? (
        <p className="mt-3 text-sm text-slate-700">{descriptionPreview}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Sin descripción.</p>
      )}

      <div className="mt-4 flex justify-end">
        <a
          href={`/community/${item.id}`}
          className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Ver tablero
        </a>
      </div>
    </div>
  );
}
