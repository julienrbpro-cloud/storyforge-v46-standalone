import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useStudio } from "@/lib/store";

export function ProjectsView() {
  const ready = useStudio((s) => s.ready);
  const projects = useStudio((s) => s.projects);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const openProject = useStudio((s) => s.openProject);
  const navigate = useNavigate();

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink text-cream">
        <p className="font-display text-2xl">
          Story<em className="not-italic text-accent">Forge</em>
        </p>
      </div>
    );
  }

  return (
    <AppShell showPlus title={<div className="font-display text-lg">Projets</div>}>
      <div className="view-enter space-y-2 p-4">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-panel p-4 text-left transition-colors hover:border-accent/40"
            onClick={() => {
              openProject(project.id);
              void navigate({ to: "/projet" });
            }}
          >
            {project.id === "original" ? (
              <img
                src="/assets/nous-malgre-nous-cover.png"
                alt=""
                className="h-20 w-14 shrink-0 rounded-md object-contain"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <b className="block truncate font-display text-xl">{project.title}</b>
              {project.id === activeProjectId ? <span className="text-xs text-muted" aria-hidden="true">Ouvert</span> : null}
            </div>
          </button>
        ))}
      </div>
    </AppShell>
  );
}
