import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PaperSheet, TabsBar } from "@/components/paper-sheet";
import { ProgressBar } from "@/components/progress-bar";
import { PageStatusBadge } from "@/components/status-badge";
import { CaseImage } from "@/components/case-image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { checkPage } from "@/lib/coherence";
import { filteredPages, useStudio } from "@/lib/store";
import { exportProjectZip, downloadJson } from "@/lib/export-zip";
import { printStoryboard } from "@/lib/print";
import { progressOf, PROJECT_GENRES, shortChapter } from "@/lib/project";
import { padPage } from "@/lib/utils";

const TABS = [
  ["planches", "Planches"],
  ["fichiers", "Exports"],
] as const;

export function ProjectView({ tab = "planches", chapitre }: { tab?: (typeof TABS)[number][0]; chapitre?: string }) {
  const seed = useStudio((s) => s.seed);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const meta = useStudio((s) => s.meta);
  const revision = useStudio((s) => s.revision);
  const setFilter = useStudio((s) => s.setFilter);
  const addPlanche = useStudio((s) => s.addPlanche);
  const movePage = useStudio((s) => s.movePage);
  const dropPage = useStudio((s) => s.dropPage);
  const deletePlanche = useStudio((s) => s.deletePlanche);
  const setSearchOpen = useStudio((s) => s.setSearchOpen);
  const navigate = useNavigate();
  void revision;
  const pages = filteredPages(seed, meta);
  const prog = progressOf(seed, meta);

  useEffect(() => {
    setFilter("chapitre", chapitre || "");
  }, [chapitre, setFilter]);

  function setTab(next: string) {
    void navigate({ to: "/projet", search: { tab: next as (typeof TABS)[number][0], chapitre: meta.filters.chapitre || undefined } });
  }

  return (
    <AppShell
      back={
        <Link to="/atelier" className="grid size-10 place-items-center text-cream">
          <ArrowLeft className="size-5" />
        </Link>
      }
      title={<span className="sr-only">{seed.projet.titre}</span>}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" title="Rechercher" onClick={() => setSearchOpen(true)}>
            <Search className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="view-enter flex min-h-0 flex-1 flex-col">
        <div className="border-b border-line px-4 py-3 text-center">
          <h2 className="font-display text-2xl">{seed.projet.titre}</h2>
          {activeProjectId === "original" ? <div className="mt-1 text-xs text-muted">{PROJECT_GENRES}</div> : null}
          {seed.projet.sous_titre ? (
            <p className="mx-auto mt-2 max-w-[320px] font-display text-sm text-cream-2 italic">
              « {seed.projet.sous_titre} »
            </p>
          ) : null}
        </div>

        <PaperSheet>
          <TabsBar tabs={TABS} value={tab} onChange={setTab} />

          {tab === "planches" ? (
            <>
              <div className="mb-3 flex items-center gap-2.5">
                <ProgressBar value={prog.pct} track="paper" className="flex-1" />
                <span className="whitespace-nowrap text-xs font-bold text-chip-fg">{prog.label}</span>
              </div>
              {meta.filters.chapitre ? (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-chip px-3 py-2 text-xs font-bold text-chip-fg">
                  <span>{shortChapter(meta.filters.chapitre)}</span>
                  <button type="button" className="text-tab-on" onClick={() => {
                    setFilter("chapitre", "");
                    void navigate({ to: "/projet", search: { tab } });
                  }}>
                    Tout voir
                  </button>
                </div>
              ) : null}
              <PlancheList
                pages={pages}
                onOpen={(id) => void navigate({ to: "/planche/$plancheId", params: { plancheId: id } })}
                onMove={movePage}
                onDrop={dropPage}
                onDelete={deletePlanche}
              />
              <Button
                className="mt-3 w-full"
                onClick={() => {
                  const id = addPlanche();
                  void navigate({ to: "/planche/$plancheId", params: { plancheId: id } });
                }}
              >
                <Plus className="size-4" />
                Nouvelle planche
              </Button>
            </>
          ) : null}


          {tab === "fichiers" ? (
            <div className="space-y-2">
              <p className="mb-3 rounded-xl border border-paper-line bg-paper p-3 text-[12px] leading-relaxed text-paper-muted">
                Le manuscrit embarqué reste la base. Tes changements vivent dans ce navigateur jusqu’à l’export.
              </p>
              <FileLine
                title="Export du projet"
                st="ZIP · données + images"
                action="Exporter"
                onClick={() => void exportProjectZip(seed, meta, useStudio.getState().mediaMeta)}
              />
              <FileLine
                title="Seed de travail"
                st="JSON"
                action="Exporter"
                onClick={() => downloadJson(seed, "storyforge-seed-travail.json")}
              />
              <FileLine
                title="Storyboard complet"
                st="texte + images"
                action="Imprimer"
                onClick={() => void printStoryboard(seed, null)}
              />
            </div>
          ) : null}
        </PaperSheet>
      </div>
    </AppShell>
  );
}

function PlancheList({
  pages,
  onOpen,
  onMove,
  onDrop,
  onDelete,
}: {
  pages: ReturnType<typeof filteredPages>;
  onOpen: (id: string) => void;
  onMove: (id: string, dir: number) => void;
  onDrop: (from: string, to: string) => void;
  onDelete: (id: string) => void;
}) {
  const seed = useStudio((s) => s.seed);
  let last = "";
  return (
    <div className="flex flex-col gap-2">
      {pages.length ? (
        pages.map((p) => {
          const ch = p.chapitre || "";
          const head = ch && ch !== last;
          last = ch;
          const issues = checkPage(seed, p).filter((x) => x.level === "error").length;
          const thumb = p.cases.find((c) => c.image);
          return (
            <div key={p.id}>
              {head ? (
                <div className="mt-2 mb-1 px-1 text-[10px] font-bold tracking-[0.16em] text-tab uppercase">
                  {shortChapter(ch)}
                </div>
              ) : null}
              <div
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(e.dataTransfer.getData("text/plain"), p.id);
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-paper-line bg-paper p-2"
                onClick={() => onOpen(p.id)}
              >
                <div className="relative h-[42px] w-14 shrink-0 overflow-hidden rounded-md bg-cream-2">
                  {thumb?.image ? (
                    <CaseImage src={thumb.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-accent/50">
                      <span className="font-display text-xs">{padPage(p.numero)}</span>
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px]">{p.titre || "Sans titre"}</b>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-tab">
                    <PageStatusBadge id={p.id} />
                    <span>
                      {p.cases.length} case{p.cases.length > 1 ? "s" : ""}
                    </span>
                    {issues ? <span className="text-danger">{issues} alerte{issues > 1 ? "s" : ""}</span> : null}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="grid size-10 place-items-center rounded-full text-tab hover:bg-cream-2"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent onClick={(event) => event.stopPropagation()}>
                    <DropdownMenuItem onSelect={() => onOpen(p.id)}>Ouvrir</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(p.id, -1)}>Monter</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onMove(p.id, 1)}>Descendre</DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        void printStoryboard(useStudio.getState().seed, p.id);
                      }}
                    >
                      Imprimer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      danger
                      onSelect={() => {
                        if (confirm("Supprimer cette planche ?")) onDelete(p.id);
                      }}
                    >
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })
      ) : (
        <div className="rounded-xl border border-dashed border-paper-line px-4 py-10 text-center text-sm text-paper-muted">
          Aucune planche pour ce filtre.
        </div>
      )}
    </div>
  );
}

function FileLine({
  title,
  st,
  action,
  onClick,
}: {
  title: string;
  st: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-paper-line bg-paper px-3 py-2.5 text-xs">
      <div className="min-w-0 flex-1">
        <b className="block">{title}</b>
        <span className="text-[10.5px] text-subtle">{st}</span>
      </div>
      <button
        type="button"
        className="rounded-full border border-paper-line bg-cream px-3 py-2 text-[11px] font-bold"
        onClick={onClick}
      >
        {action}
      </button>
    </div>
  );
}
