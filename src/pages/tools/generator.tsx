// src/pages/tools/generator.tsx
import RecommendedStackPanel, {
  DEFAULT_STACK_SECTIONS,
  RecommendedStack,
  StackSection,
} from '@/components/RecommendedStackPanel';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

type TaskComplexity = 'SIMPLE' | 'MEDIUM' | 'HIGH';

type TaskCategory = 'ARCHITECTURE' | 'MODEL' | 'SERVICE' | 'VIEW' | 'INFRA' | 'QA';

type ColumnId = 'todo' | 'doing' | 'done';

export interface GeneratedTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  complexity: TaskComplexity;
  priority: number;
  estimatedHours: number; // puede venir vacío en la práctica
  hourlyRate: number;
  taskPrice: number;
  // alias legacy
  layer?: TaskCategory;
  price?: number;
  developerNetPrice?: number;
  // board
  columnId?: ColumnId;
  assigneeEmail?: string | null;
  assigneeAvatar?: string | null;
}

export type StackInference = {
  inferred?: RecommendedStack | null;
  suggested?: RecommendedStack | null;
  reasons?: string;
  confidence?: number | null;
};

export interface ProjectEstimation {
  id?: string;
  projectTitle: string;
  projectDescription: string;
  ownerEmail: string;
  tasks: GeneratedTask[];
  totalHours?: number;
  totalTasksPrice: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  generatorServiceFee?: number;
  generatorFee?: number;
  grandTotalClientCost: number;
  published?: boolean;
  recommendedStack?: RecommendedStack;
  stackInference?: StackInference | null;
  stackSource?: string | null;
  stackConfidence?: number | null;
  openaiMeta?: unknown;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);

const safeNumber = (v: unknown): number =>
  typeof v === 'number' && !Number.isNaN(v) ? v : 0;

// 🔹 Calcula las horas de una tarea usando estimatedHours o (precio/tarifa)
const getTaskHours = (task: GeneratedTask): number => {
  const explicit =
    typeof task.estimatedHours === 'number' && !Number.isNaN(task.estimatedHours)
      ? task.estimatedHours
      : undefined;

  if (explicit !== undefined) return explicit;

  const rate =
    typeof task.hourlyRate === 'number' &&
    !Number.isNaN(task.hourlyRate) &&
    task.hourlyRate > 0
      ? task.hourlyRate
      : 30;

  const rawPrice =
    typeof task.taskPrice === 'number' && !Number.isNaN(task.taskPrice)
      ? task.taskPrice
      : typeof task.price === 'number' && !Number.isNaN(task.price)
      ? task.price
      : 0;

  return rawPrice / rate;
};

// ============================
// ✅ Draft persistence (Option A)
// ============================
const DRAFT_KEY = 'generator:draft:v1';

type GeneratorDraft = {
  projectTitle: string;
  projectDescription: string;
  ownerEmail: string;
  estimation: ProjectEstimation | null;
  stackDraft?: RecommendedStack;
  stackInference?: StackInference | null;
  ts: number;
};

const saveDraft = (draft: GeneratorDraft) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
};

const loadDraft = (): GeneratorDraft | null => {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const clearDraft = () => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
};

// ============================
// ✅ OAuth popup helper (evita navegar a :4000)
// ============================
function openCenteredPopup(url: string) {
  const w = 600;
  const h = 720;
  const dualScreenLeft = (window as any).screenLeft ?? window.screenX ?? 0;
  const dualScreenTop = (window as any).screenTop ?? window.screenY ?? 0;
  const width = window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
  const height = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;

  const left = width / 2 - w / 2 + dualScreenLeft;
  const top = height / 2 - h / 2 + dualScreenTop;

  const popup = window.open(
    url,
    'github_oauth',
    `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`
  );

  if (popup && popup.focus) popup.focus();
  return popup;
}

const STACK_SECTIONS: StackSection[] = DEFAULT_STACK_SECTIONS;

const ensureStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeRecommendedStack = (stack?: RecommendedStack | null): RecommendedStack => {
  const base = STACK_SECTIONS.reduce((acc, section) => {
    acc[section.key] = [];
    return acc;
  }, {} as RecommendedStack);

  if (!stack) return base;

  const normalized: RecommendedStack = { ...base };

  Object.entries(stack).forEach(([key, value]) => {
    normalized[key] = ensureStringArray(value);
  });

  return normalized;
};

const normalizeStackInference = (inference?: StackInference | null): StackInference | null => {
  if (!inference) return null;
  return {
    ...inference,
    inferred: normalizeRecommendedStack(inference.inferred ?? undefined),
    suggested: normalizeRecommendedStack(inference.suggested ?? undefined),
    confidence:
      typeof inference.confidence === 'number'
        ? inference.confidence
        : Number(inference.confidence) || null,
  };
};

const mergeSectionsWithStack = (stack: RecommendedStack, baseSections: StackSection[]) => {
  const knownKeys = new Set(baseSections.map((s) => s.key));
  const dynamicSections = Object.keys(stack || {})
    .filter((key) => !knownKeys.has(key))
    .map((key) => ({ key, label: key }));

  return [...baseSections, ...dynamicSections];
};

const hasStackItems = (stack?: RecommendedStack | null) =>
  !!stack && Object.values(stack).some((items) => Array.isArray(items) && items.length > 0);

const formatConfidence = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(0)}%`;
};

const GENERATE_PATHS = [
  process.env.NEXT_PUBLIC_GENERATE_TASKS_PATH,
  '/projects/generate-tasks',
  '/generate-tasks',
].filter(Boolean) as string[];

function StackSummaryCard({
  title,
  description,
  stack,
  sections,
  source,
  confidence,
}: {
  title: string;
  description?: string;
  stack: RecommendedStack;
  sections: StackSection[];
  source?: string | null;
  confidence?: number | null;
}) {
  const hasContent = hasStackItems(stack);
  const confidenceLabel = formatConfidence(confidence);

  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{title}</p>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-slate-100 px-2 py-1">
              Origen: {source || 'OPENAI/HEURISTIC'}
            </span>
            {confidenceLabel && (
              <span className="rounded-full bg-slate-100 px-2 py-1">
                Confianza: {confidenceLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {hasContent ? (
          sections.map((section) => {
            const items = stack[section.key] || [];
            if (!items.length) return null;

            return (
              <div key={section.key} className="space-y-2 rounded-lg bg-slate-50/80 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {section.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((tech) => (
                    <span
                      key={`${section.key}-${tech}`}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-600">
            No se pudo inferir el stack. Comprueba la descripción o prueba de nuevo (el backend también aporta un stack sugerido).
          </p>
        )}
      </div>
    </div>
  );
}

export default function GeneratorPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [estimation, setEstimation] = useState<ProjectEstimation | null>(null);
  const [stackDraft, setStackDraft] = useState<RecommendedStack>(normalizeRecommendedStack());
  const [stackInference, setStackInference] = useState<StackInference | null>(null);
  const [openAiMeta, setOpenAiMeta] = useState<unknown>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  const githubStatusEmail = useMemo(
    () => ownerEmail || session?.user?.email || null,
    [ownerEmail, session?.user?.email]
  );

  useEffect(() => {
    if (session?.user?.email) {
      setOwnerEmail(session.user.email);
    }
  }, [session?.user?.email]);

  // ✅ Restore draft once on mount (so OAuth refresh doesn't lose data)
  useEffect(() => {
    if (!router.isReady) return;

    const draft = loadDraft();
    if (!draft) return;

    const isEmpty =
      (!projectTitle || projectTitle.trim() === '') &&
      (!projectDescription || projectDescription.trim() === '') &&
      (!ownerEmail || ownerEmail.trim() === '') &&
      !estimation;

    if (isEmpty) {
      setProjectTitle(draft.projectTitle || '');
      setProjectDescription(draft.projectDescription || '');
      setOwnerEmail(draft.ownerEmail || session?.user?.email || '');
      setEstimation(draft.estimation || null);
      if (draft.stackDraft) setStackDraft(normalizeRecommendedStack(draft.stackDraft));
      if (draft.stackInference) setStackInference(normalizeStackInference(draft.stackInference));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // ✅ Auto-save draft when user types / estimation changes
  useEffect(() => {
    const hasSomething =
      (projectTitle && projectTitle.trim() !== '') ||
      (projectDescription && projectDescription.trim() !== '') ||
      (ownerEmail && ownerEmail.trim() !== '') ||
      !!estimation;

    if (!hasSomething) return;

    saveDraft({
      projectTitle,
      projectDescription,
      ownerEmail,
      estimation,
      stackDraft,
      stackInference,
      ts: Date.now(),
    });
  }, [projectTitle, projectDescription, ownerEmail, estimation, stackDraft, stackInference]);

  const fetchGithubStatus = async () => {
    if (!githubStatusEmail) {
      setGithubConnected(false);
      setGithubError(null);
      return;
    }

    try {
      setGithubLoading(true);
      setGithubError(null);

      const res = await fetch(
        `${API_BASE}/integrations/github/status?userEmail=${encodeURIComponent(githubStatusEmail)}`
      );

      if (!res.ok) throw new Error('No se pudo comprobar la integración de GitHub.');

      const data = await res.json().catch(() => ({}));
      const statusValue = Boolean(
        (data as any).connected ?? (data as any).isConnected ?? (data as any).status
      );
      setGithubConnected(statusValue);
    } catch (err: any) {
      console.error('[generator] Error comprobando GitHub', err);
      setGithubConnected(false);
      setGithubError(err?.message || 'No se pudo comprobar GitHub.');
    } finally {
      setGithubLoading(false);
    }
  };

  useEffect(() => {
    fetchGithubStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubStatusEmail]);

  // ✅ Por si tu backend hace redirect al FE con ?github=connected|error
  useEffect(() => {
    if (!router.isReady) return;

    const github = router.query.github;
    if (github === 'connected' || github === 'error') {
      fetchGithubStatus();
      const nextQuery = { ...router.query };
      delete (nextQuery as any).github;
      delete (nextQuery as any).githubLogin;
      delete (nextQuery as any).reason;

      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, {
        shallow: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.github]);

  // ✅ Conectar GitHub sin abandonar el frontend (:3000)
  const connectGithubWithPopup = () => {
    if (!githubStatusEmail) return;

    // guarda draft antes de OAuth
    saveDraft({
      projectTitle,
      projectDescription,
      ownerEmail,
      estimation,
      ts: Date.now(),
    });

    const url =
      `${API_BASE}/integrations/github/login` +
      `?userEmail=${encodeURIComponent(githubStatusEmail)}` +
  `&returnTo=${encodeURIComponent('/tools/generator')}` +
  `&popup=1`;

    const popup = openCenteredPopup(url);

    // Popup bloqueado -> fallback a navegación normal (mejor que "no hacer nada")
    if (!popup) {
      window.location.href = url;
      return;
    }

    // cuando se cierre -> refresca estado
    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        fetchGithubStatus();
      }
    }, 600);
  };

  // ✅ Total horas
  const totalHours = useMemo(() => {
    if (!estimation) return 0;

    const total = safeNumber(estimation.totalHours);
    if (total > 0) return total;

    if (!Array.isArray(estimation.tasks)) return 0;

    return estimation.tasks.reduce((sum, t) => sum + getTaskHours(t), 0);
  }, [estimation]);

  // ✅ Total tareas
  const totalTasksPrice = useMemo(() => {
    if (!estimation) return 0;

    const backendTotal = safeNumber(estimation.totalTasksPrice);
    if (backendTotal > 0) return backendTotal;

    if (!Array.isArray(estimation.tasks)) return 0;

    return estimation.tasks.reduce((sum, t) => sum + safeNumber(t.taskPrice ?? t.price ?? 0), 0);
  }, [estimation]);

  // ✅ Fuerza 1% si viene vacío/0
  const platformFeePercent = useMemo(() => {
    if (!estimation) return 1;
    const pf = safeNumber(estimation.platformFeePercent);
    return pf > 0 ? pf : 1;
  }, [estimation]);

  // ✅ Comisión
  const platformFeeAmount = useMemo(() => {
    const amount = (totalTasksPrice * platformFeePercent) / 100;
    return +amount.toFixed(2);
  }, [totalTasksPrice, platformFeePercent]);

  // ✅ Total cliente
  const grandTotalClientCost = useMemo(() => {
    const backend = safeNumber(estimation?.grandTotalClientCost);
    if (backend > 0) return backend;
    return +(totalTasksPrice + platformFeeAmount).toFixed(2);
  }, [estimation?.grandTotalClientCost, totalTasksPrice, platformFeeAmount]);

  const handleGenerateTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      setPublishError(null);
      setEstimation(null);
      setStackDraft(normalizeRecommendedStack());
      setStackInference(null);
      setOpenAiMeta(null);

      let finalResponse: Response | null = null;

      for (const path of GENERATE_PATHS) {
        const url = `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerEmail,
            projectTitle,
            projectDescription,
          }),
        });

        if (res.ok) {
          finalResponse = res;
          break;
        }

        if (res.status === 404) {
          continue;
        }

        finalResponse = res;
        break;
      }

      if (!finalResponse) {
        throw new Error('No se pudo contactar con el generador de tareas.');
      }

      if (!finalResponse.ok) {
        const data = await finalResponse.json().catch(() => ({}));
        console.error('[generator] Error HTTP generando tareas', finalResponse.status, data);

        if (finalResponse.status === 402 && (data as any)?.error === 'subscription_required') {
          setError(
            (data as any).message ??
              'Necesitas una suscripción activa de 30 €/mes para usar el generador.'
          );
          return;
        }

        throw new Error((data as any).error || 'No se pudo generar el troceado de tareas');
      }

      const data = (await finalResponse.json()) as { project: ProjectEstimation };

      const proj = data.project;
      const normalizedInference = normalizeStackInference(proj.stackInference);
      const normalizedRecommendedStack = normalizeRecommendedStack(
        proj.recommendedStack ?? normalizedInference?.suggested ?? null
      );

      const fixed: ProjectEstimation = {
        ...proj,
        tasks: Array.isArray(proj.tasks) ? proj.tasks : [],
        platformFeePercent: safeNumber(proj.platformFeePercent) > 0 ? proj.platformFeePercent : 1,
        recommendedStack: normalizedRecommendedStack,
        stackInference: normalizedInference,
      };

      setStackDraft(normalizedRecommendedStack);
      setStackInference(normalizedInference);
      setOpenAiMeta((proj as any)?.openaiMeta ?? null);
      setEstimation(fixed);
    } catch (err: any) {
      console.error('[generator] Error generando tareas', err);
      setError(err.message || 'No se pudo generar el troceado de tareas. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishToCommunity = async () => {
    if (!estimation) return;

    if (!githubConnected) {
      setPublishError('Para publicar en la comunidad debes conectar tu cuenta de GitHub.');
      return;
    }

    try {
      setPublishing(true);
      setPublishError(null);

      const ownerEmailResolved = (estimation as any).ownerEmail || session?.user?.email || null;

      const projectTitleResolved = (estimation as any).projectTitle || (estimation as any).title || null;

      const projectDescriptionResolved =
        (estimation as any).projectDescription || (estimation as any).description || null;

      if (!ownerEmailResolved || !projectTitleResolved || !projectDescriptionResolved) {
        setPublishError('Faltan datos para publicar (email/título/descripción).');
        return;
      }

      const estimationPayload = {
        ...estimation,
        ownerEmail: ownerEmailResolved,
        projectTitle: projectTitleResolved,
        projectDescription: projectDescriptionResolved,
        recommendedStack: stackDraft,
        stackInference,
        platformFeePercent,
        totalTasksPrice,
        platformFeeAmount,
        grandTotalClientCost,
      };

      const res = await fetch(`${API_BASE}/community/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail: ownerEmailResolved,
          projectTitle: projectTitleResolved,
          projectDescription: projectDescriptionResolved,
          estimation: estimationPayload,
        }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        console.error('[generator] Error HTTP publicando proyecto', res.status, data);
        const code = (data as any)?.error;

        if (code === 'github_not_connected_owner') {
          setGithubConnected(false);
          throw new Error('Debes conectar tu GitHub para que podamos crear el repositorio automáticamente.');
        }

        if (code === 'github_permissions_missing') {
          throw new Error(
            'Faltan permisos en tu cuenta de GitHub para crear el repositorio automático. Revisa la integración e inténtalo de nuevo.'
          );
        }

        if (code === 'repo_not_created') {
          throw new Error('No pudimos crear el repositorio automático. Revisa tu conexión de GitHub e inténtalo de nuevo.');
        }

        throw new Error(code || 'No se pudo publicar el proyecto en la comunidad');
      }

      clearDraft();
      router.push((data as any).publicUrl || `/community/${(data as any).id}`);
    } catch (err: any) {
      console.error('[generator] Error publishing project', err);
      setPublishError(err.message || 'No se pudo publicar el proyecto en la comunidad');
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    if (!estimation) return;

    if (estimation.recommendedStack || estimation.stackInference?.suggested) {
      setStackDraft(
        normalizeRecommendedStack(
          estimation.recommendedStack ?? estimation.stackInference?.suggested ?? null
        )
      );
    }

    if (estimation.stackInference) {
      setStackInference(normalizeStackInference(estimation.stackInference));
    }

    if ((estimation as any)?.openaiMeta) {
      setOpenAiMeta((estimation as any).openaiMeta);
    }
  }, [estimation]);

  const stackSource = estimation?.stackSource || 'OPENAI/HEURISTIC';
  const stackConfidence = estimation?.stackConfidence ?? stackInference?.confidence;

  const inferenceStack = normalizeRecommendedStack(stackInference?.inferred ?? undefined);
  const suggestedSections = useMemo(
    () => mergeSectionsWithStack(stackDraft, STACK_SECTIONS),
    [stackDraft]
  );
  const inferenceSections = useMemo(
    () => mergeSectionsWithStack(inferenceStack, STACK_SECTIONS),
    [inferenceStack]
  );

  const tasksToRender = Array.isArray(estimation?.tasks) ? estimation.tasks : [];

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Cabecera + volver al dashboard */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Generador de tareas y presupuesto</h1>
            <p className="mt-1 text-sm text-slate-600">
              Divide tu proyecto en tareas con prioridad, capa técnica y precio estimado. La tarifa base de trabajo es de
              30 €/h y la plataforma aplica un 1% de comisión sobre el presupuesto de las tareas.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
          >
            Volver al dashboard
          </Link>
        </div>

        {/* Formulario */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800">Título del proyecto</label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Ej: Automatización de correos con diccionario"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">Descripción del proyecto</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={5}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Describe qué quieres automatizar, qué actores intervienen, qué flujos hay, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">Email del propietario</label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="tu-email@empresa.com"
              />
              <p className="mt-1 text-xs text-slate-500">Usaremos este email para asociar el proyecto generado.</p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              Este servicio está disponible mediante una suscripción de <span className="font-semibold">30 €/mes</span> para convertir tu idea en un plan detallado de trabajo. La tarifa técnica base es de{' '}
              <span className="font-semibold">30 €/h</span> y la plataforma aplicará un <span className="font-semibold">1%</span> de comisión sobre el presupuesto de tareas generado.
            </div>

            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerateTasks}
                disabled={loading || !projectTitle || !projectDescription || !ownerEmail}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Generando tareas…' : estimation ? 'Regenerar tareas' : 'Generar tareas'}
              </button>
            </div>
          </div>
        </section>

        {/* Resultado */}
        {estimation && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-600">Resultado</h2>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{estimation.projectTitle}</h3>
            <p className="mt-1 text-sm text-slate-700">{estimation.projectDescription}</p>
            <p className="mt-3 text-xs text-slate-500">
              La plataforma actúa como intermediaria entre el cliente y los programadores. El presupuesto mostrado incluye un 1% de comisión de plataforma. El generador se paga mediante suscripción mensual, no se añade fee extra por proyecto.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <StackSummaryCard
                title="Stack inferido"
                description="Tecnologías detectadas explícitamente en la descripción y el paradigma."
                stack={inferenceStack}
                sections={inferenceSections}
                source={stackSource}
                confidence={stackConfidence}
              />

              <RecommendedStackPanel
                title="Stack sugerido"
                subtitle="Stack completo recomendado para el MVP (puedes ajustar las tecnologías)."
                stack={stackDraft}
                onChange={setStackDraft}
                sections={suggestedSections}
              />
            </div>

            {process.env.NODE_ENV !== 'production' && (stackInference || openAiMeta) && (
              <details className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-700">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  Ver detalle de stack (solo dev)
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-tight">
                  {JSON.stringify(
                    {
                      stackInference,
                      recommendedStack: stackDraft,
                      openAiMeta,
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            )}

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                    <th className="px-4 py-2">Título</th>
                    <th className="px-4 py-2">Descripción</th>
                    <th className="px-4 py-2">Categoría</th>
                    <th className="px-4 py-2">Complejidad</th>
                    <th className="px-4 py-2">Prioridad</th>
                    <th className="px-4 py-2">Horas</th>
                    <th className="px-4 py-2">Tarifa</th>
                    <th className="px-4 py-2">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {tasksToRender.map((task, index) => (
                    <tr key={task.id ?? index} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-2 font-semibold text-slate-900">{task.title}</td>
                      <td className="px-4 py-2 text-slate-700">{task.description}</td>
                      <td className="px-4 py-2 text-slate-700">{task.category}</td>
                      <td className="px-4 py-2 text-slate-700">{task.complexity}</td>
                      <td className="px-4 py-2 text-slate-700">{task.priority}</td>
                      <td className="px-4 py-2 text-slate-700">{getTaskHours(task).toFixed(2)}</td>
                      <td className="px-4 py-2 text-slate-700">{Number(task.hourlyRate ?? 30).toFixed(2)} € / h</td>
                      <td className="px-4 py-2 text-slate-900">{formatPrice(Number(task.taskPrice ?? task.price ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
              <p>
                Horas totales estimadas: <span className="font-semibold">{totalHours.toFixed(2)}</span>
              </p>
              <p>
                Presupuesto tareas: <span className="font-semibold">{formatPrice(totalTasksPrice)}</span>
              </p>
              <p>
                Comisión plataforma ({platformFeePercent}%): <span className="font-semibold">{formatPrice(platformFeeAmount)}</span>
              </p>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Coste total estimado para el cliente: <span className="font-semibold">{formatPrice(grandTotalClientCost)}</span>
            </p>

            <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              {!githubConnected ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-amber-700">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="font-semibold">Para publicar este proyecto debes conectar tu cuenta de GitHub.</p>
                      <p className="text-slate-600">Crearemos un repositorio privado automáticamente al publicar.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={connectGithubWithPopup}
                    disabled={!githubStatusEmail || githubLoading}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {githubLoading ? 'Comprobando GitHub…' : 'Conectar GitHub'}
                  </button>

                  {githubError && (
                    <p className="text-xs text-red-600">
                      {githubError} {githubStatusEmail ? '' : 'Añade un email para continuar.'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2 text-emerald-700">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="font-semibold">GitHub conectado</p>
                    <p className="text-slate-700">Se creará un repositorio privado automáticamente al publicar.</p>
                  </div>
                </div>
              )}
            </div>

            {publishError && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{publishError}</div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handlePublishToCommunity}
                disabled={publishing || !githubConnected || githubLoading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 md:w-auto"
              >
                {publishing ? 'Publicando proyecto…' : 'Publicar este proyecto en la comunidad'}
              </button>
            </div>

            {!githubConnected && (
              <p className="mt-2 text-xs text-amber-700">Conecta GitHub para habilitar la publicación.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
