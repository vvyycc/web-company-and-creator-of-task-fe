import React from 'react';

export type RecommendedStack = Record<string, string[]>;

export interface StackSection {
  key: string;
  label: string;
  placeholder?: string;
}

export const DEFAULT_STACK_SECTIONS: StackSection[] = [
  { key: 'languages', label: 'Lenguajes', placeholder: 'TypeScript, Python, Go' },
  { key: 'frontend', label: 'Frontend', placeholder: 'Next.js, Tailwind, React Query' },
  { key: 'backend', label: 'Backend', placeholder: 'Node.js, NestJS, tRPC' },
  { key: 'database', label: 'Base de datos', placeholder: 'PostgreSQL, Redis' },
  { key: 'infrastructure', label: 'Infra/Hosting', placeholder: 'Vercel, AWS, Render' },
  { key: 'devops', label: 'DevOps', placeholder: 'CI/CD, GitHub Actions, Docker' },
  { key: 'ai', label: 'AI/LLM', placeholder: 'OpenAI, LangChain, Pinecone' },
  { key: 'testing', label: 'Testing/QA', placeholder: 'Jest, Playwright' },
  { key: 'observability', label: 'Observabilidad', placeholder: 'Sentry, Datadog' },
  { key: 'mobile', label: 'Mobile/Cross', placeholder: 'React Native, Expo' },
  { key: 'security', label: 'Security/Auth', placeholder: 'JWT, Clerk, Auth0' },
  { key: 'other', label: 'Otras herramientas', placeholder: 'Stripe, Segment' },
];

interface RecommendedStackPanelProps {
  stack: RecommendedStack;
  onChange: (stack: RecommendedStack) => void;
  sections?: StackSection[];
  title?: string;
  subtitle?: string;
}

const toArray = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const RecommendedStackPanel: React.FC<RecommendedStackPanelProps> = ({
  stack,
  onChange,
  sections = DEFAULT_STACK_SECTIONS,
  title = 'Stack sugerido',
  subtitle,
}) => {
  const handleChange = (key: string, value: string) => {
    onChange({
      ...stack,
      [key]: toArray(value),
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{title}</p>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Editable</span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const items = stack[section.key] || [];
          return (
            <div key={section.key} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{section.label}</p>
                <span className="text-xs text-slate-500">{items.length} techs</span>
              </div>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={3}
                placeholder={section.placeholder}
                value={items.join(', ')}
                onChange={(e) => handleChange(section.key, e.target.value)}
              />

              <div className="flex flex-wrap gap-2">
                {items.length === 0 && (
                  <span className="text-xs text-slate-500">Añade tecnologías separadas por comas.</span>
                )}
                {items.map((tech) => (
                  <span
                    key={`${section.key}-${tech}`}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecommendedStackPanel;
