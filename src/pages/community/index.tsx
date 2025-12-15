// src/pages/community/index.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { io as ioClient, Socket } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface CommunityListItem {
  id: string;
  title: string;
  description: string;
  ownerEmail: string;
  totalTasksPrice: number;
  platformFeePercent: number;
  tasksCount: number;
  publishedAt?: string;
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);

const formatDate = (value?: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
};

let socket: Socket | null = null;

export default function CommunityIndexPage() {
  const { data: session } = useSession();

  const [projects, setProjects] = useState<CommunityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [projectToDelete, setProjectToDelete] = useState<CommunityListItem | null>(null);

  // ✅ banner de eventos en tiempo real
  const [realtimeBanner, setRealtimeBanner] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/community/projects`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudieron cargar los proyectos de comunidad");
        }

        const data = (await res.json()) as CommunityListItem[];
        setProjects(data);
      } catch (err: any) {
        console.error("[community-index] Error cargando proyectos", err);
        setError(err.message || "No se pudieron cargar los proyectos de comunidad");
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  // ✅ SOCKET: escuchar create/delete de proyectos (lista)
  useEffect(() => {
    if (!socket) {
      socket = ioClient(API_BASE, {
        withCredentials: true,
        transports: ["websocket"],
        reconnection: true,
      });

      socket.on("connect", () => console.log("[socket] connected", socket?.id));
      socket.on("disconnect", (r) => console.log("[socket] disconnected", r));
      socket.on("connect_error", (e) => console.log("[socket] connect_error", e.message));
    }

    // entrar al room global
    socket.emit("community:list:join");

    const onCreated = (p: CommunityListItem) => {
      setProjects((prev) => {
        // evita duplicados si ya lo tenías
        if (prev.some((x) => x.id === p.id)) return prev;
        // lo ponemos arriba
        return [p, ...prev];
      });
      setRealtimeBanner(`✅ Nuevo proyecto publicado: "${p.title}"`);
      setTimeout(() => setRealtimeBanner(null), 4000);
    };

    const onDeleted = ({ id }: { id: string }) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setRealtimeBanner("🗑️ Un proyecto fue eliminado");
      setTimeout(() => setRealtimeBanner(null), 4000);
    };

    socket.on("community:projectCreated", onCreated);
    socket.on("community:projectDeleted", onDeleted);

    return () => {
      socket?.off("community:projectCreated", onCreated);
      socket?.off("community:projectDeleted", onDeleted);
      socket?.emit("community:list:leave");
    };
  }, []);

  const handleDeleteProject = async (project: CommunityListItem) => {
    const currentEmail = session?.user?.email || "";

    setDeleteErrors((prev) => {
      const next = { ...prev };
      delete next[project.id];
      return next;
    });

    if (!currentEmail) {
      setDeleteErrors((prev) => ({
        ...prev,
        [project.id]: "Debes iniciar sesión para borrar proyectos.",
      }));
      return;
    }

    const isOwner = currentEmail.toLowerCase() === (project.ownerEmail || "").toLowerCase();
    if (!isOwner) {
      setDeleteErrors((prev) => ({
        ...prev,
        [project.id]: "No autorizado: solo el owner puede borrar este proyecto.",
      }));
      return;
    }

    setProjectToDelete(project);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    const currentEmail = session?.user?.email || "";
    if (!currentEmail) {
      setDeleteErrors((prev) => ({
        ...prev,
        [projectToDelete.id]: "Debes iniciar sesión para borrar proyectos.",
      }));
      setProjectToDelete(null);
      return;
    }

    try {
      setDeletingId(projectToDelete.id);

      // ✅ IMPORTANTE: el delete es /community/projects/:id (no /projects/:id)
      const res = await fetch(`${API_BASE}/community/projects/${projectToDelete.id}`, {
        method: "DELETE",
        headers: {
          "x-user-email": currentEmail,
        },
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setDeleteErrors((prev) => ({
          ...prev,
          [projectToDelete.id]: data?.error || "No se pudo borrar el proyecto.",
        }));
        return;
      }

      // ✅ No hace falta quitarlo aquí si el socket lo va a quitar,
      // pero lo dejamos por UX inmediata:
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
    } catch (err) {
      console.error("[community-index] Error deleting project", err);
      setDeleteErrors((prev) => ({
        ...prev,
        [projectToDelete.id]: "Error de red al borrar el proyecto.",
      }));
    } finally {
      setProjectToDelete(null);
      setDeletingId(null);
    }
  };

  const currentEmail = session?.user?.email || "";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-lg font-semibold text-slate-700">Cargando proyectos de la comunidad…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="mb-2 text-xl font-bold text-slate-900">No se pudieron cargar los proyectos</h1>
          <p className="mb-4 text-slate-600">{error}</p>
          <Link
            href="/dashboard"
            className="inline-flex justify-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Volver al dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {!!realtimeBanner && (
          <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200">
            {realtimeBanner}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Comunidad</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Proyectos publicados</h1>
            <p className="mt-2 text-sm text-slate-600">
              Explora proyectos de otros usuarios y elige tareas en las que colaborar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Volver al dashboard
            </Link>
            <Link
              href="/tools/generator"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Crear nuevo proyecto
            </Link>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-600">Todavía no hay proyectos publicados en la comunidad.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const isOwner =
                !!currentEmail &&
                currentEmail.toLowerCase() === (project.ownerEmail || "").toLowerCase();

              const deleteErrorMsg = deleteErrors[project.id] || null;
              const isDeleting = deletingId === project.id;

              return (
                <Link
                  key={project.id}
                  href={`/community/${project.id}`}
                  className="relative flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:-translate-y-1 hover:shadow-md hover:ring-blue-400 transition"
                >
                  {isOwner && (
                    <button
                      type="button"
                      aria-label="Eliminar proyecto"
                      disabled={isDeleting}
                      className="absolute right-3 top-3 rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDeleteProject(project);
                      }}
                    >
                      <span className="sr-only">Eliminar proyecto</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="h-4 w-4"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  )}

                  <h2 className="mb-1 line-clamp-2 text-sm font-semibold text-slate-900">{project.title}</h2>

                  <p className="mb-3 line-clamp-3 text-xs text-slate-600">{project.description}</p>

                  <p className="mb-2 text-[11px] text-slate-500">
                    Publicado por <span className="font-medium">{project.ownerEmail}</span>
                    {project.publishedAt && <>{" · "}{formatDate(project.publishedAt)}</>}
                  </p>

                  <div className="mt-auto flex items-center justify-between text-xs text-slate-600">
                    <span>
                      Tareas: <span className="font-semibold">{project.tasksCount}</span>
                    </span>
                    <span>
                      Presupuesto: <span className="font-semibold">{formatPrice(project.totalTasksPrice || 0)}</span>
                    </span>
                  </div>

                  {isDeleting && <p className="mt-3 text-xs text-slate-400">Borrando…</p>}
                  {deleteErrorMsg && <p className="mt-3 text-xs text-red-600">{deleteErrorMsg}</p>}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ MODAL CONFIRMACIÓN */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">¿Estás segur@ de borrar el proyecto?</h2>

            <p className="mt-2 text-sm text-slate-600">
              <strong>{projectToDelete.title}</strong> se eliminará permanentemente. Esta acción no se puede deshacer.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setProjectToDelete(null)}
                disabled={deletingId === projectToDelete.id}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                onClick={confirmDeleteProject}
                disabled={deletingId === projectToDelete.id}
              >
                {deletingId === projectToDelete.id ? "Borrando…" : "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
