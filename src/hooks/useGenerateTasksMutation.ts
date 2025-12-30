import { useCallback, useState } from 'react';
import { ProjectEstimation } from '../types/projects';

type GenerateTasksPayload = {
  ownerEmail: string;
  projectTitle?: string;
  title?: string;
  projectDescription?: string;
  description?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export function useGenerateTasksMutation() {
  const [data, setData] = useState<ProjectEstimation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (payload: GenerateTasksPayload) => {
    try {
      setLoading(true);
      setError(null);
      setData(null);

      const res = await fetch(`${API_BASE}/generate-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || 'No se pudo generar el troceado de tareas');
      }

      const json = (await res.json()) as { project: ProjectEstimation };
      const estimation = json.project;
      setData(estimation);
      return estimation;
    } catch (err: any) {
      console.error('[useGenerateTasksMutation] error', err);
      setError(err?.message || 'No se pudo generar el troceado de tareas');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, mutate } as const;
}
