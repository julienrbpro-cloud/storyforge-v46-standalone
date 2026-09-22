import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useStudio } from "@/lib/store";

export function StudioProvider({ children }: { children: ReactNode }) {
  const ready = useStudio((s) => s.ready);
  const boot = useStudio((s) => s.boot);
  const seed = useStudio((s) => s.seed);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useLayoutEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        useStudio.getState().setSearchOpen(true);
        return;
      }
      if (e.key !== "j" && e.key !== "k") return;
      if (!pathname.startsWith("/planche/")) return;
      const id = pathname.split("/planche/")[1];
      const i = seed.planches.findIndex((p) => p.id === id);
      if (i < 0) return;
      const next = e.key === "j" ? seed.planches[i + 1] : seed.planches[i - 1];
      if (next) void navigate({ to: "/planche/$plancheId", params: { plancheId: next.id } });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, pathname, seed.planches]);

  if (!ready && pathname !== "/") {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink text-cream">
        <p className="font-display text-2xl">
          Story<em className="not-italic text-accent">Forge</em>
        </p>
      </div>
    );
  }
  return <>{children}</>;
}