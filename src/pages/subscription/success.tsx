// src/pages/subscription/success.tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const { session_id } = router.query;
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session_id) return;

    const confirm = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/billing/confirm-subscription?session_id=${encodeURIComponent(
            String(session_id)
          )}`
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'No se pudo confirmar la suscripción');
          return;
        }

        const data = await res.json();

        if (typeof window !== 'undefined' && data.subscription?.email) {
          window.localStorage.setItem(
            `subscription:${data.subscription.email}`,
            'active'
          );
        }

        router.replace('/tools/generator?autoGenerate=1');
      } catch (err) {
        console.error('[success] Error confirmando suscripción', err);
        setError('Error inesperado confirmando la suscripción');
      }
    };

    confirm();
  }, [API_BASE, router, session_id]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-3xl font-bold text-green-600 text-center">
        ✅ Suscripción completada
      </h1>
      <p className="text-lg text-center max-w-xl">
        Estamos confirmando tu suscripción y preparando tu proyecto troceado…
      </p>
      {error && (
        <p className="mt-4 text-sm text-red-600 text-center">
          {error}
        </p>
      )}
    </main>
  );
}
