import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BookOpen, FolderOpen, Home, Plus, Search, UserRound } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { SearchDialog } from "@/components/search-dialog";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";

const NAV = [
  { to: "/atelier" as const, icon: Home, label: "Accueil", kind: "home" },
  { to: "/projet" as const, icon: FolderOpen, label: "Projets", kind: "projets" },
  { to: "/bibliotheque" as const, icon: BookOpen, label: "Bibliothèque", kind: "biblio" },
  { to: "/donnees" as const, icon: UserRound, label: "Profil", kind: "profil" },
];

export function AppShell({
  children,
  title,
  sub,
  actions,
  back,
  hideNav = false,
  showSearch = false,
  showPlus = false,
}: {
  children: ReactNode;
  title?: ReactNode;
  sub?: string;
  actions?: ReactNode;
  back?: ReactNode;
  hideNav?: boolean;
  showSearch?: boolean;
  showPlus?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const saveState = useStudio((s) => s.saveState);
  const setSearchOpen = useStudio((s) => s.setSearchOpen);
  const addPlanche = useStudio((s) => s.addPlanche);
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-ink shadow-[0_0_80px_rgba(0,0,0,.7)] lg:max-w-[1120px]">
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur-sm">
        {back}
        <div className="min-w-0 flex-1">{title ?? <Wordmark sub={sub ?? "Créer aujourd’hui les mondes de demain"} />}</div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] tracking-wide text-subtle uppercase sm:inline">
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
              title="Ajouter une planche"
              onClick={() => {
                const id = addPlanche();
                void navigate({ to: "/planche/$plancheId", params: { plancheId: id } });
              }}
            >
              <Plus className="size-5" />
            </Button>
          ) : null}
          {actions}
        </div>
      </header>
      <div className={cn("flex min-h-0 flex-1 flex-col", hideNav ? "pb-4" : "pb-[74px]")}>{children}</div>
      {hideNav ? null : (
        <nav className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-line bg-nav pb-[env(safe-area-inset-bottom)] lg:max-w-[1120px]">
          {NAV.map((item) => {
            const active =
              item.kind === "home"
                ? pathname === "/atelier"
                : item.kind === "projets"
                  ? pathname.startsWith("/projet") || pathname.startsWith("/planche")
                  : item.kind === "biblio"
                    ? pathname.startsWith("/bibliotheque")
                    : pathname.startsWith("/donnees");
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "grid min-h-14 justify-items-center gap-1 py-2.5 text-[11px] text-muted transition-colors",
                  active && "text-accent",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
      <SearchDialog />
    </div>
  );
}