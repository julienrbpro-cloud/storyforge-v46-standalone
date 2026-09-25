import { Link, useNavigate } from "@tanstack/react-router";
import { Images, LayoutList, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProgressBar } from "@/components/progress-bar";
import { CaseImage } from "@/components/case-image";
import { peopleOf, totalCases } from "@/lib/seed";
import { importCount, progressOf, shortChapter, chapterProgress, PROJECT_GENRES } from "@/lib/project";
import { useStudio } from "@/lib/store";
import { padPage } from "@/lib/utils";

export function HomeView() {
  const seed = useStudio((s) => s.seed);
  const meta = useStudio((s) => s.meta);
  const projects = useStudio((s) => s.projects);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const openProject = useStudio((s) => s.openProject);
  const revision = useStudio((s) => s.revision);
  const navigate = useNavigate();
  void revision;
  const prog = progressOf(seed, meta);
  const chapters = [...new Set(seed.planches.map((p) => p.chapitre).filter(Boolean))] as string[];
  const people = peopleOf(seed).length;
  const files = importCount(seed);

  return (
    <AppShell showSearch showPlus>
      <div className="view-enter p-4 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-start lg:gap-6">
        <div>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h3 className="font-display text-lg">Projet actif</h3>
            <Link to="/projet" className="text-xs text-muted transition-colors hover:text-cream">
              Voir tous →
            </Link>
          </div>
          <Link to="/projet" className="block overflow-hidden rounded-2xl border border-line bg-panel">
            <div className="relative flex h-[330px] items-center justify-center overflow-hidden bg-[#15110e] lg:h-[370px]">
              {activeProjectId === "original" ? (
                <img src="/assets/nous-malgre-nous-cover.png" alt="Couverture de Nous, malgré nous" className="h-full w-full object-contain" />
              ) : (
                <span className="px-8 text-center font-display text-3xl text-cream">{seed.projet.titre}</span>
              )}
            </div>
            <div className="px-4 py-3.5">
              <h4 className="font-display text-[22px]">{seed.projet.titre}</h4>
              {activeProjectId === "original" ? <div className="mt-1 text-xs tracking-wide text-muted">{PROJECT_GENRES}</div> : null}
              <ProgressBar value={prog.pct} className="my-3" />
              <div className="text-xs text-muted">{prog.label}</div>
              {seed.projet.sous_titre ? (
                <p className="mt-2.5 font-display text-[13.5px] text-cream-2 italic">
                  « {seed.projet.sous_titre} »
                </p>
              ) : null}
            </div>
          </Link>
          {projects.length > 1 ? (
            <div className="mt-4 space-y-2">
              <h3 className="font-display text-lg">Autres projets</h3>
              {projects.filter((p) => p.id !== activeProjectId).map((project) => (
                <button key={project.id} type="button" className="w-full rounded-xl border border-line bg-panel p-3 text-left text-sm hover:border-accent/40" onClick={() => { openProject(project.id); void navigate({ to: "/projet" }); }}>
                  {project.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 lg:mt-0">
          <div className="grid grid-cols-3 gap-2.5">
            <Stat
              icon={LayoutList}
              value={prog.done ? `${prog.done}/${prog.n}` : String(prog.n)}
              label="Planches"
              onClick={() => void navigate({ to: "/projet" })}
            />
            <Stat
              icon={Users}
              value={people}
              label="Personnages"
              onClick={() => void navigate({ to: "/bibliotheque" })}
            />
            <Stat
              icon={Images}
              value={files}
              label="Imports"
              onClick={() => void navigate({ to: "/projet", search: { tab: "fichiers" } })}
            />
          </div>

          <div className="mt-6 mb-2.5 flex items-baseline justify-between">
            <h3 className="font-display text-lg">Chapitres</h3>
            <Link to="/projet" className="text-xs text-muted hover:text-cream">
              Voir tous →
            </Link>
          </div>
          <div className="space-y-2">
            {chapters.map((ch) => {
              const c = chapterProgress(seed, meta, ch);
              const thumb = c.pages.flatMap((p) => p.cases).find((x) => x.image);
              return (
                <Link
                  key={ch}
                  to="/projet"
                  search={{ chapitre: ch }}
                  className="flex items-center gap-3 rounded-xl border border-line bg-panel p-2.5 transition-colors hover:border-accent/40"
                >
                  <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-panel-2 font-display text-accent">
                    {thumb?.image ? (
                      <CaseImage src={thumb.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      padPage(c.pages[0]?.numero ?? 1)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{shortChapter(ch)}</b>
                    <div className="text-[11px] text-muted">
                      {c.n} planche{c.n > 1 ? "s" : ""} · {c.done} terminée{c.done > 1 ? "s" : ""}
                    </div>
                    <ProgressBar value={c.pct} className="mt-1.5" />
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="mt-4 text-center text-[11px] text-subtle">
            {totalCases(seed)} cases dans {activeProjectId === "original" ? "le manuscrit" : "le projet"} · {seed.projet.version}
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  onClick,
}: {
  icon: typeof LayoutList;
  value: string | number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-xl border border-line bg-panel px-2 py-3.5 text-center transition-colors hover:border-accent/40"
      onClick={onClick}
    >
      <Icon className="mx-auto mb-1.5 size-4 text-accent" strokeWidth={1.75} />
      <div className="text-[17px] font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{label}</div>
    </button>
  );
}
