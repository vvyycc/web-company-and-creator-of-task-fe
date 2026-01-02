import { useMemo } from 'react';

export type RecommendedStack = Record<string, string[]>;

const normalizeStringArray = (input: unknown): string[] => {
  if (Array.isArray(input)) {
    return input
      .map((v) => (typeof v === 'string' ? v : String(v ?? '')))
      .map((v) => v.trim())
      .filter(Boolean);
  }

  if (typeof input === 'string') {
    return input
      .split(/\n|,/)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
};

export const normalizeRecommendedStack = (
  value?: RecommendedStack | Record<string, unknown> | string[] | string | null
): RecommendedStack => {
  if (!value) return {};

  if (Array.isArray(value) || typeof value === 'string') {
    return { stack: normalizeStringArray(value) };
  }

  if (typeof value === 'object') {
    const result: RecommendedStack = {};

    Object.entries(value).forEach(([key, raw]) => {
      result[key] = normalizeStringArray(raw);
    });

    return result;
  }

  return {};
};

interface RecommendedStackPanelProps {
  title?: string;
  subtitle?: string;
  value?: RecommendedStack | Record<string, unknown> | string[] | string | null;
  onChange?: (next: RecommendedStack) => void;
  readOnly?: boolean;
  reasons?: string[];
}

const formatKey = (key: string) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

const defaultTitle = 'Stack sugerido';

export default function RecommendedStackPanel({
  title = defaultTitle,
  subtitle,
  value,
  onChange,
  readOnly,
  reasons,
}: RecommendedStackPanelProps) {
  const normalizedValue = useMemo(() => normalizeRecommendedStack(value), [value]);

  const normalizedReasons = useMemo(
    () =>
      Array.isArray(reasons)
        ? reasons
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        : [],
    [reasons]
  );

  const entries = Object.entries(normalizedValue);
  const sectionsToRender =
    readOnly || entries.length > 0
      ? entries
      : [
          [
            'stack',
            [],
          ],
        ];

  const handleChange = (key: string, text: string) => {
    if (readOnly || !onChange) return;

    const updated = { ...normalizedValue, [key]: normalizeStringArray(text) };
    onChange(updated);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{title}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-600">{subtitle}</p>}
        </div>
        {!readOnly && (
          <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold uppercase text-blue-700">
            Editable
          </span>
        )}
      </div>

      {normalizedReasons.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-800">Razones</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
            {normalizedReasons.map((reason, idx) => (
              <li key={`${reason}-${idx}`}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {sectionsToRender.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No hay stack disponible.</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {sectionsToRender.map(([key, items]) => (
            <div key={key} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">{formatKey(key)}</p>
                {!readOnly && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    Edita la lista
                  </span>
                )}
              </div>

              <textarea
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                rows={4}
                disabled={readOnly}
                value={(items as string[]).join('\n')}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder="React\nNext.js\nPostgreSQL"
              />

              {readOnly && (items as string[]).length > 0 && (
                <p className="text-[11px] text-slate-500">
                  {items.length} {items.length === 1 ? 'elemento' : 'elementos'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
