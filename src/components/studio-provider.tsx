import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useStudio } from "@/lib/store";
import { computeVisualPages } from "@/lib/visual-layout";

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
    function flush() {
      if (useStudio.getState().saveState === "saving") useStudio.getState().persistNow();
    }
    function onVisibility() { if (document.visibilityState === "hidden") flush(); }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement | null)?.isContentEditable || document.querySelector('[role="dialog"]')) return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        useStudio.getState().setSearchOpen(true);
        return;
      }
      if (e.key !== "j" && e.key !== "k") return;
      if (!pathname.startsWith("/planche/")) return;
      const id = pathname.split("/planche/")[1];
      const pages = computeVisualPages(seed);
      const i = Number(id) - 1;
      const next = i + (e.key === "j" ? 1 : -1);
      if (next >= 0 && next < pages.length) void navigate({ to: "/planche/$plancheId", params: { plancheId: String(next + 1) } });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, pathname, seed]);

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
