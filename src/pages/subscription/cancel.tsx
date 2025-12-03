// src/pages/subscription/cancel.tsx
import { useRouter } from 'next/router';

export default function SubscriptionCancelPage() {
  const router = useRouter();

  const handleGoBack = () => {
    // Cambia la ruta si quieres que vuelva a otra página
    router.push('/tools/generator');
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-3xl font-bold text-red-600 text-center">
        ❌ Suscripción cancelada
      </h1>

      <p className="text-lg text-center max-w-xl">
        El pago se canceló o no se pudo completar.
        Si ha sido un error, puedes volver a intentarlo desde el generador de tareas.
      </p>

      <button
        onClick={handleGoBack}
        className="mt-4 px-4 py-2 rounded bg-black text-white hover:bg-gray-800 transition"
      >
        Volver al generador
      </button>
    </main>
  );
}
