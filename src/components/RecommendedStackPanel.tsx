import { useMemo } from 'react';

export type StackCategory = 'frontend' | 'backend' | 'smartContracts' | 'database' | 'testing';

export type RecommendedStack = Partial<Record<StackCategory, string[]>>;

interface RecommendedStackPanelProps {
  stack: RecommendedStack;
  onChange: (nextStack: RecommendedStack) => void;
}

const STACK_FIELDS: { key: StackCategory; label: string; placeholder: string }[] = [
  { key: 'frontend', label: 'Frontend', placeholder: 'Frameworks, librerías, UI kits…' },
  { key: 'backend', label: 'Backend', placeholder: 'Lenguajes, frameworks, servicios…' },
  { key: 'smartContracts', label: 'Smart Contracts', placeholder: 'Chains, toolings, auditorías…' },
  { key: 'database', label: 'Base de datos', placeholder: 'Motores, ORMs, caches…' },
  { key: 'testing', label: 'Testing', placeholder: 'Suites, frameworks, coverage…' },
];

export function RecommendedStackPanel({ stack, onChange }: RecommendedStackPanelProps) {
  const resolvedStack = useMemo<RecommendedStack>(() => {
    return STACK_FIELDS.reduce<RecommendedStack>((acc, field) => {
      const current = stack?.[field.key];
      acc[field.key] = Array.isArray(current) ? current : [];
      return acc;
    }, {});
  }, [stack]);

  const handleUpdate = (key: StackCategory, value: string) => {
    const lines = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    onChange({
      ...resolvedStack,
      [key]: lines,
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Stack sugerido</p>
        <p className="text-sm text-slate-700">
          Edita cada categoría antes de publicar. El contenido proviene del backend y se mantiene en local.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {STACK_FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">{field.label}</span>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                {resolvedStack[field.key]?.length ?? 0} ítems
              </span>
            </div>
            <textarea
              className="h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              value={(resolvedStack[field.key] ?? []).join('\n')}
              onChange={(event) => handleUpdate(field.key, event.target.value)}
              placeholder={field.placeholder}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export default RecommendedStackPanel;
