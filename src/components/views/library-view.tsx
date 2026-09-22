import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PaperSheet, TabsBar } from "@/components/paper-sheet";
import { OFFICIAL_REFS } from "@/lib/constants";
import { allIssues } from "@/lib/coherence";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS = [
  ["personnages", "Personnages"],
  ["regles", "Règles"],
  ["coherence", "Cohérence"],
] as const;

export function LibraryView() {
  const seed = useStudio((s) => s.seed);
  const revision = useStudio((s) => s.revision);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("personnages");
  void revision;

  const people = [
    ...(seed.personnages || []).map((x) => ({
      id: x.id,
      title: x.nom || x.id,
      role: x.role,
      text: x.note || "",
    })),
    ...(seed.gardiens || []).map((x) => ({
      id: x.id,
      title: x.id === "archiviste" ? "Archiviste" : x.id === "armurier" ? "Armurier" : x.id,
      role: x.role,
      text: [x.fonction_protectrice, x.evolution].filter(Boolean).join(" — "),
    })),
  ];

  return (
    <AppShell title={<div className="font-display text-lg">Bibliothèque</div>} showSearch>
      <div className="view-enter flex min-h-0 flex-1 flex-col">
        <p className="px-4 pt-3 pb-1 text-sm text-muted">
          Le monde de {seed.projet.titre} — visages, règles, et ce qui doit rester cohérent.
        </p>
        <PaperSheet>
          <TabsBar tabs={TABS} value={tab} onChange={(id) => setTab(id as (typeof TABS)[number][0])} />
          {tab === "personnages" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {people.map((e) => {
                const main = OFFICIAL_REFS.find((r) => r.entityId === e.id);
                return (
                  <article key={e.id} className="overflow-hidden rounded-xl border border-paper-line bg-paper">
                    {main ? (
                      <img src={main.data} alt={e.title} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="grid h-40 place-items-center bg-cream-2 font-display text-3xl text-accent">
                        {e.title.slice(0, 1)}
                      </div>
                    )}
                    <div className="p-3">
                      <h4 className="font-display text-lg">{e.title}</h4>
                      {e.role ? <div className="text-[11px] font-bold tracking-wide text-tab-on uppercase">{e.role}</div> : null}
                      {e.text ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-paper-muted">{e.text}</p> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {tab === "regles" ? (
            <div className="space-y-2">
              {(seed.regles_editoriales || []).length ? (
                (seed.regles_editoriales || []).map((r) => (
                  <article key={r.id} className="rounded-xl border border-paper-line bg-paper p-3">
                    <h5 className="mb-1 font-display text-base">{r.titre}</h5>
                    <p className="text-[12.5px] leading-relaxed text-paper-muted">{r.contenu}</p>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-paper-line px-4 py-10 text-center text-sm text-paper-muted">
                  Aucune règle éditoriale.
                </div>
              )}
            </div>
          ) : null}

          {tab === "coherence" ? <CoherencePanel /> : null}
        </PaperSheet>
      </div>
    </AppShell>
  );
}

function CoherencePanel() {
  const seed = useStudio((s) => s.seed);
  const revision = useStudio((s) => s.revision);
  const navigate = useNavigate();
  void revision;
  const list = allIssues(seed);
  const errors = list.filter((x) => x.level === "error").length;
  const warns = list.filter((x) => x.level === "warn").length;
  return (
    <>
      <div className="mb-3 flex gap-2">
        <span className="rounded-full bg-chip px-2.5 py-1.5 text-[11px] font-extrabold text-chip-fg">
          {errors} erreur{errors > 1 ? "s" : ""}
        </span>
        <span className="rounded-full bg-chip px-2.5 py-1.5 text-[11px] font-extrabold text-chip-fg">
          {warns} avertissement{warns > 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {list.length ? (
          list.map((x) => (
            <button
              key={`${x.pageId}-${x.title}`}
              type="button"
              className={cn(
                "rounded-xl border p-2.5 text-left text-xs leading-snug",
                x.level === "error" && "border-danger/40 bg-danger/10 text-danger",
                x.level === "warn" && "border-accent/40 bg-chip text-chip-fg",
              )}
              onClick={() =>
                x.pageId && void navigate({ to: "/planche/$plancheId", params: { plancheId: x.pageId } })
              }
            >
              <b className="mb-0.5 block">
                P{x.pageNumero} — {x.title}
              </b>
              {x.text}
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-ok/40 bg-ok/15 p-2.5 text-sm text-chip-fg">Tout est cohérent.</div>
        )}
      </div>
    </>
  );
}