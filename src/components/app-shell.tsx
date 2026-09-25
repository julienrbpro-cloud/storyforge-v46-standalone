import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { SearchDialog } from "@/components/search-dialog";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";

export function AppShell({
  children,
  title,
  sub,
  actions,
  back,
  showSearch = false,
  showPlus = false,
}: {
  children: ReactNode;
  title?: ReactNode;
  sub?: string;
  actions?: ReactNode;
  back?: ReactNode;
  showSearch?: boolean;
  showPlus?: boolean;
}) {
  const saveState = useStudio((s) => s.saveState);
  const setSearchOpen = useStudio((s) => s.setSearchOpen);
  const addProject = useStudio((s) => s.addProject);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-ink shadow-[0_0_80px_rgba(0,0,0,.7)] lg:max-w-[1120px]">
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur-sm">
        {back}
        <div className="min-w-0 flex-1">{title ?? <Wordmark sub={sub ?? "Créer aujourd’hui les mondes de demain"} />}</div>
        <div className="flex items-center gap-2">
          <span role="status" className={cn("text-[10px] tracking-wide uppercase", saveState === "error" ? "text-danger" : "hidden text-subtle sm:inline")}>
            {saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "Non enregistré" : "Enregistré"}
          </span>
          {showSearch ? (
            <Button
              variant="secondary"
              size="icon"
              title="Rechercher"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
            </Button>
          ) : null}
          {showPlus ? (
            <Button
              size="icon"
              title="Nouveau projet"
              aria-label="Nouveau projet"
              onClick={() => setProjectOpen(true)}
            >
              <Plus className="size-5" />
            </Button>
          ) : null}
          {actions}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col pb-4">{children}</div>
      <SearchDialog />
      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent title="Nouveau projet">
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!addProject(projectTitle)) return;
            setProjectTitle("");
            setProjectOpen(false);
            void navigate({ to: "/projet" });
          }} className="space-y-3">
            <Field label="Nom du projet"><Input autoFocus required value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} /></Field>
            <Button type="submit" className="w-full">Créer le projet</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
