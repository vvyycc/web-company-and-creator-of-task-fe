import { useEffect, useMemo, useState } from 'react';
import { RecommendedStack, StackSource } from '../types/projects';

type Props = {
  value?: RecommendedStack | null;
  source?: StackSource | null;
  confidence?: number | null;
  onChange?: (stack: RecommendedStack) => void;
};

const CATEGORIES: { key: keyof RecommendedStack; label: string; placeholder: string }[] = [
  { key: 'frontend', label: 'Frontend', placeholder: 'Next.js, Tailwind, React Query…' },
  { key: 'backend', label: 'Backend', placeholder: 'Node.js, NestJS, Express…' },
  { key: 'smartContracts', label: 'Smart Contracts', placeholder: 'Solidity, Foundry…' },
  { key: 'database', label: 'DB', placeholder: 'PostgreSQL, MySQL, DynamoDB…' },
  { key: 'infra', label: 'Infra', placeholder: 'AWS, GCP, Kubernetes…' },
  { key: 'testing', label: 'Testing', placeholder: 'Jest, Playwright…' },
  { key: 'devops', label: 'DevOps', placeholder: 'GitHub Actions, Terraform…' },
];

const formatConfidence = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value.toFixed(2);
};

const sourceLabel = (source?: StackSource | null) => {
  if (!source) return null;
  if (source === 'OPENAI') return 'Origen: IA';
  if (source === 'HEURISTIC') return 'Origen: Heurístico';
  return null;
};

function toLines(value?: string[] | null) {
  if (!Array.isArray(value) || value.length === 0) return '';
  return value.join('\n');
}

function toArray(value: string): string[] {
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function RecommendedStackPanel({ value, source, confidence, onChange }: Props) {
  const [local, setLocal] = useState<RecommendedStack>(value ?? {});

  // Sync when parent changes (e.g., regenerate)
  useEffect(() => {
    setLocal(value ?? {});
  }, [value]);

  const handleChange = (key: keyof RecommendedStack, next: string) => {
    const updated: RecommendedStack = { ...local, [key]: toArray(next) };
    setLocal(updated);
    onChange?.(updated);
  };

  const chipSections = useMemo(() => {
    if (!local || Object.keys(local).length === 0) return [];
    return CATEGORIES.map((c) => {
      const items = Array.isArray(local[c.key]) ? (local[c.key] as string[]) : [];
      return { ...c, items };
    });
  }, [local]);

  const copyText = useMemo(() => {
    const lines: string[] = [];
    CATEGORIES.forEach((c) => {
      const items = Array.isArray(local[c.key]) ? (local[c.key] as string[]) : [];
      const label = c.label === 'DB' ? 'DB' : c.label;
      lines.push(`${label}: ${items.length ? items.join(', ') : 'No disponible'}`);
    });
    return lines.join('\n');
  }, [local]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
    } catch (err) {
      console.error('No se pudo copiar el stack', err);
    }
  };

  const hasData = chipSections.some((s) => s.items.length > 0);

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Stack sugerido</p>
          <p className="text-sm text-slate-700">Ajusta el stack antes de publicar.</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          {sourceLabel(source) && <span>{sourceLabel(source)}</span>}
          {formatConfidence(confidence) && (
            <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">Conf: {formatConfidence(confidence)}</span>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Copiar stack
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {CATEGORIES.map((cat) => (
          <div key={cat.key} className="space-y-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
              <span>{cat.label}</span>
              <span className="text-xs font-normal text-slate-500">Editable</span>
            </div>

            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              rows={3}
              placeholder={cat.placeholder}
              value={toLines(local[cat.key])}
              onChange={(e) => handleChange(cat.key, e.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              {Array.isArray(local[cat.key]) && local[cat.key]?.length ? (
                (local[cat.key] as string[]).map((item, idx) => (
                  <span
                    key={`${cat.key}-${idx}-${item}`}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800"
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">Sin datos</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {!hasData && <p className="text-sm text-slate-500">No disponible.</p>}
    </div>
  );
}
