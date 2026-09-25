import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useStudio } from "@/lib/store";
import { computeVisualPages } from "@/lib/visual-layout";

export function StudioProvider({ children }: { children: ReactNode }) {
  const ready = useStudio((s) => s.ready);
  const boot = useStudio((s) => s.boot);
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
      if (pathname !== "/projet") return;
      const pages = computeVisualPages(useStudio.getState().seed);
      if (!pages.length) return;
      const index = useStudio.getState().visualPageIndex;
      const next = e.key === "j" ? index + 1 : index - 1;
      if (next < 0 || next >= pages.length) return;
      useStudio.getState().setVisualPageIndex(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname]);

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
