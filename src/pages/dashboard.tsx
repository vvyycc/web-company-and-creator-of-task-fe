import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

type SubscriptionInfo = {
  hasActiveSubscription: boolean;
  status?: string;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const email = (session?.user?.email as string) || '';

  // Llamada al backend para saber si el usuario tiene suscripción activa
  const fetchSubscription = async (targetEmail: string) => {
    try {
      setLoadingSub(true);
      setSubError(null);

      const res = await fetch(
        `${API_BASE}/billing/me-subscription?email=${encodeURIComponent(targetEmail)}`
      );

      if (!res.ok) {
        console.error('[dashboard] Error HTTP comprobando suscripción', res.status);
        setSubInfo({ hasActiveSubscription: false });
        return;
      }

      const data = await res.json();
      console.log('[dashboard] subscription info', data);
      setSubInfo({
        hasActiveSubscription: !!data.hasActiveSubscription,
        status: data.status,
      });
    } catch (err) {
      console.error('[dashboard] Error comprobando suscripción', err);
      setSubError('No se pudo comprobar el estado de tu suscripción.');
      setSubInfo({ hasActiveSubscription: false });
    } finally {
      setLoadingSub(false);
    }
  };

  // Al cargar el dashboard, si hay usuario, comprobamos la suscripción
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!email) return;

    fetchSubscription(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, email]);

  // Si volvemos desde Stripe con ?status=subscription_success refrescamos la suscripción
  useEffect(() => {
    if (!router.isReady) return;
    if (status !== 'authenticated') return;
    if (!email) return;

    const { status: qsStatus } = router.query;
    if (qsStatus === 'subscription_success') {
      fetchSubscription(email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query, status, email]);

  // Crear sesión de checkout (Stripe) desde el dashboard
  const handleCreateCheckoutSession = async () => {
    if (!email) return;
    try {
      setCheckoutLoading(true);
      setCheckoutError(null);

      const res = await fetch(`${API_BASE}/billing/create-subscription-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        console.error('[dashboard] Error HTTP creando sesión de suscripción', res.status);
        throw new Error('No se pudo iniciar la suscripción');
      }

      const data = await res.json();
      if (!data.url) {
        throw new Error('La respuesta de Stripe no contiene una URL de checkout');
      }

      window.location.href = data.url;
    } catch (err) {
      console.error('[dashboard] Error creando sesión de pago', err);
      setCheckoutError('No se pudo iniciar la suscripción. Inténtalo de nuevo.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Estado de auth
  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-lg font-semibold text-slate-700">Cargando tu panel…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-4 text-2xl font-bold text-slate-900">Inicia sesión para continuar</h1>
          <p className="mb-4 text-slate-600">
            Necesitas iniciar sesión con Google para acceder al panel, al generador y a la comunidad.
          </p>
          <button
            onClick={() => signIn('google')}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Iniciar sesión con Google
          </button>
        </div>
      </main>
    );
  }

  const hasActiveSub = subInfo?.hasActiveSubscription === true;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Cabecera */}
        <header className="rounded-2xl bg-white p-6 shadow">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Panel de control
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Hola, {session.user?.name ?? session.user?.email}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Desde aquí puedes ver tu suscripción, acceder al generador de proyectos troceados y a
            la comunidad donde los proyectos se publican como tableros tipo Trello.
          </p>
        </header>

        {/* Bloque de suscripción */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Estado de suscripción</h2>

            {loadingSub ? (
              <p className="text-sm text-slate-600">Comprobando tu suscripción…</p>
            ) : hasActiveSub ? (
              <>
                <p className="text-sm text-emerald-700">
                  ✅ Tienes una suscripción activa al generador de tareas.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Puedes trocear proyectos en tareas tantas veces como quieras y publicar tableros
                  en la comunidad.
                </p>
                {subInfo?.status && (
                  <p className="mt-2 text-xs text-slate-500">
                    Estado Stripe: <span className="font-medium">{subInfo.status}</span>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-slate-700">
                  🔒 No tienes una suscripción activa. El generador de tareas y la publicación en la
                  comunidad están bloqueados.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  El plan cuesta <strong>30 €/mes</strong>. Podrás generar y regenerar el troceado de
                  tareas sin límite y publicar tus proyectos como tableros para que desarrolladores
                  puedan aplicar a las tareas.
                </p>

                <div className="mt-4 space-y-2">
                  {checkoutError && (
                    <p className="text-xs text-red-600">{checkoutError}</p>
                  )}
                  <button
                    onClick={handleCreateCheckoutSession}
                    disabled={checkoutLoading}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {checkoutLoading ? 'Redirigiendo a Stripe…' : 'Suscribirme por 30 €/mes'}
                  </button>
                </div>
              </>
            )}

            {subError && !loadingSub && (
              <p className="mt-3 text-xs text-red-600">{subError}</p>
            )}
          </div>

          {/* Accesos rápidos */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="mb-2 text-lg font-semibold text-slate-900">Herramientas</h2>
              <p className="text-sm text-slate-600">
                Accede al generador de tareas y presupuesto, y publica tus proyectos como tableros
                en la comunidad.
              </p>

              <div className="mt-4 space-y-3">
                <Link
                  href="/tools/generator"
                  className={`block w-full rounded-lg px-4 py-2 text-center text-sm font-semibold ${
                    hasActiveSub
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {hasActiveSub
                    ? 'Ir al generador de tareas'
                    : 'Generador de tareas (requiere suscripción)'}
                </Link>

                <Link
                  href="/community/explore"
                  className="block w-full rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Explorar proyectos de la comunidad
                </Link>
              </div>

              {!hasActiveSub && (
                <p className="mt-3 text-xs text-slate-500">
                  Aunque no tengas suscripción, puedes ver proyectos publicados por otros usuarios
                  para hacerte una idea de cómo funciona la plataforma.
                </p>
              )}
            </div>

            {/* Pequeño resumen / futuro stats */}
            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="mb-2 text-lg font-semibold text-slate-900">Resumen rápido</h2>
              <p className="text-sm text-slate-600">
                Próximamente aquí verás estadísticas: número de proyectos generados, horas totales
                estimadas, ingresos potenciales, etc.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
