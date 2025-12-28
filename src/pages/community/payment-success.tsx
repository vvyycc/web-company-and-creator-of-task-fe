// src/pages/community/payment-success.tsx
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

export default function ProjectPaymentSuccessPage() {
  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  const [error, setError] = useState<string | null>(null);

  // ✅ evita dobles ejecuciones (StrictMode / re-render)
  const didPublish = useRef(false);

  useEffect(() => {
    if (!router.isReady) return;

    const sessionId = router.query.session_id;
    if (!sessionId || typeof sessionId !== "string") return;

    if (typeof window === "undefined") return;

    if (didPublish.current) return;
    didPublish.current = true;

    const publish = async () => {
      try {
        const raw = window.localStorage.getItem("lastGeneratedProject");
        if (!raw) {
          setError("No se encontró el proyecto a publicar.");
          return;
        }

        const parsed = JSON.parse(raw) as {
          ownerEmail: string;
          estimation: any;
        };

        const res = await fetch(`${API_BASE}/community/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerEmail: parsed.ownerEmail,
            projectTitle: parsed.estimation?.projectTitle,
            projectDescription: parsed.estimation?.projectDescription,
            estimation: parsed.estimation,
            paidViaStripe: true,
            // opcional por trazabilidad:
            stripeSessionId: sessionId,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error("[payment-success] Error publicando", res.status, data);
          setError(data?.error || "No se pudo publicar el proyecto tras el pago");
          return;
        }

        window.localStorage.removeItem("lastGeneratedProject");

        // ✅ navega a la página deseada
        router.replace("/tools/generator?projectPublished=1");
      } catch (err) {
        console.error("[payment-success] Error publicando proyecto", err);
        setError("Error inesperado publicando el proyecto");
      }
    };

    publish();
  }, [router.isReady, router.query.session_id]); // ✅ deps mínimas (evita re-ejecuciones)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-3xl font-bold text-green-600 text-center">
        ✅ Pago completado
      </h1>
      <p className="text-lg text-center max-w-xl">
        Estamos publicando tu proyecto en la comunidad…
      </p>

      {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
    </main>
  );
}
