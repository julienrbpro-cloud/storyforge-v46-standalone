import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ProgressBar } from "@/components/progress-bar";
import { useStudio } from "@/lib/store";
import { totalCases } from "@/lib/seed";
import { progressOf } from "@/lib/project";

export function HomeView() {
  const projects = useStudio((s) => s.projects);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const openProject = useStudio((s) => s.openProject);
  const seed = useStudio((s) => s.seed);
  const meta = useStudio((s) => s.meta);
  const revision = useStudio((s) => s.revision);
  const navigate = useNavigate();
  void revision;
  const progress = progressOf(seed, meta);
  return <AppShell title={<h1 className="font-display text-2xl">Projets</h1>} showPlus>
    <main className="view-enter grid gap-4 p-4 sm:grid-cols-2">
      {projects.map((project) => <button key={project.id} type="button"
        className="overflow-hidden rounded-2xl border border-line bg-panel text-left transition-colors hover:border-accent/50"
        onClick={() => { openProject(project.id); void navigate({ to: "/projet" }); }}>
        <div className="flex h-56 items-center justify-center overflow-hidden bg-[#15110e]">
          {project.id === "original" ? <img src="/assets/nous-malgre-nous-cover.png" alt="Couverture de Nous, malgré nous" className="h-full w-full object-contain" />
            : <span className="p-5 text-center font-display text-3xl">{project.title}</span>}
        </div>
        <div className="p-4">
          <h2 className="font-display text-xl">{project.title}</h2>
          {project.id === activeProjectId ? <><ProgressBar value={progress.pct} className="my-3" />
            <p className="text-xs text-muted">{progress.label} · {totalCases(seed)} cases</p></>
            : <p className="mt-2 text-xs text-muted">Ouvrir le projet →</p>}
        </div>
      </button>)}
    </main>
  </AppShell>;
}
