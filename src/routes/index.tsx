import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LS_SEEN } from "@/lib/constants";
import { useEffect } from "react";
import { useStudio } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Splash });

function Splash() {
  const ready = useStudio((s) => s.ready);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(LS_SEEN) === "1") {
        void navigate({ to: "/atelier" });
      }
    } catch {
      /* ignore */
    }
  }, [navigate]);

  function enter() {
    try {
      sessionStorage.setItem(LS_SEEN, "1");
    } catch {
      /* ignore */
    }
    void navigate({ to: "/atelier" });
  }

  return (
    <section className="splash-bg mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center px-7 py-10 text-center text-cream lg:max-w-[820px]">
      <Mark className="mb-3 size-[150px] text-accent" />
      <h1 className="font-display text-[46px] font-semibold">
        Story<em className="not-italic text-accent">Forge</em>
      </h1>
      <div className="mt-1 text-[11px] tracking-[0.4em] text-muted">HISTOIRES EN CONSTRUCTION</div>
      <div className="mx-auto my-7 h-0.5 w-11 bg-accent" />
      <h2 className="mb-4 font-display text-[30px] leading-tight font-semibold">
        Donnez forme
        <br />
        à vos mondes.
      </h2>
      <p className="mb-8 text-sm leading-relaxed text-muted">
        Organisez. Imaginez. Dessinez.
        <br />
        Vos histoires prennent vie.
      </p>
      <Button size="lg" className="min-w-[240px]" onClick={enter} disabled={!ready}>
        Entrer dans le studio
        <span aria-hidden>→</span>
      </Button>
      <div className="mt-11 text-[10px] tracking-[0.3em] text-subtle">DES IDÉES AUX PLANCHES</div>
    </section>
  );
}
