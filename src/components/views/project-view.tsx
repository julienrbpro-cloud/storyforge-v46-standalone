import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PaperSheet } from "@/components/paper-sheet";
import { ProgressBar } from "@/components/progress-bar";
import { PageStatusBadge } from "@/components/status-badge";
import { CaseImage } from "@/components/case-image";
import { CaseOrderPanel } from "@/components/case-order-panel";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { checkPage } from "@/lib/coherence";
import { filteredPages, useStudio } from "@/lib/store";
import { printStoryboard } from "@/lib/print";
import { progressOf, PROJECT_GENRES } from "@/lib/project";
import { padPage } from "@/lib/utils";

export function ProjectView() {
  const seed = useStudio((s) => s.seed);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const meta = useStudio((s) => s.meta);
  const revision = useStudio((s) => s.revision);
  const addPlanche = useStudio((s) => s.addPlanche);
  const movePage = useStudio((s) => s.movePage);
  const dropPage = useStudio((s) => s.dropPage);
  const deletePlanche = useStudio((s) => s.deletePlanche);
  const setSearchOpen = useStudio((s) => s.setSearchOpen);
  const navigate = useNavigate();
  void revision;
  const pages = filteredPages(seed, meta);
  const prog = progressOf(seed, meta);
  return <AppShell back={<Link to="/" className="grid size-10 place-items-center text-cream" aria-label="Retour aux projets"><ArrowLeft className="size-5" /></Link>}
    title={<span className="sr-only">{seed.projet.titre}</span>}
    actions={<Button variant="secondary" size="icon" title="Rechercher" onClick={() => setSearchOpen(true)}><Search className="size-4" /></Button>}>
    <div className="view-enter flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-4 py-3 text-center">
        <h1 className="font-display text-2xl">{seed.projet.titre}</h1>
        {activeProjectId === "original" ? <div className="mt-1 text-xs text-muted">{PROJECT_GENRES}</div> : null}
        {seed.projet.sous_titre ? <p className="mx-auto mt-2 max-w-[320px] font-display text-sm text-cream-2 italic">« {seed.projet.sous_titre} »</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-3">
        <Link to="/bibliotheque" className="rounded-lg border border-line bg-panel px-3 py-2.5 text-xs font-semibold">Personnages & règles</Link>
        <Link to="/donnees" className="rounded-lg border border-line bg-panel px-3 py-2.5 text-xs font-semibold">Exporter</Link>
      </div>
      <PaperSheet>
        <div className="mb-3 flex items-center gap-2.5"><ProgressBar value={prog.pct} track="paper" className="flex-1" /><span className="whitespace-nowrap text-xs font-bold text-chip-fg">{prog.label}</span></div>
        <div className="flex flex-col gap-2">{pages.map((p) => {
          const issues = checkPage(seed, p).filter((x) => x.level === "error").length;
          const thumb = p.cases.find((c) => c.image);
          return <div key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); dropPage(e.dataTransfer.getData("text/plain"), p.id); }}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-paper-line bg-paper p-2" onClick={() => void navigate({ to: "/planche/$plancheId", params: { plancheId: p.id } })}>
            <div className="relative h-[42px] w-14 shrink-0 overflow-hidden rounded-md bg-cream-2">{thumb?.image ? <CaseImage src={thumb.image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center font-display text-xs text-accent/50">{padPage(p.numero)}</span>}</div>
            <div className="min-w-0 flex-1"><b className="block truncate text-[13.5px]">{p.titre || "Sans titre"}</b><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-tab"><PageStatusBadge id={p.id} /><span>{p.cases.length} case{p.cases.length > 1 ? "s" : ""}</span>{issues ? <span className="text-danger">{issues} alerte{issues > 1 ? "s" : ""}</span> : null}</div></div>
            <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="grid size-10 place-items-center rounded-full text-tab" onClick={(e) => e.stopPropagation()} aria-label="Actions"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger><DropdownMenuContent onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => void navigate({ to: "/planche/$plancheId", params: { plancheId: p.id } })}>Ouvrir</DropdownMenuItem><DropdownMenuItem onSelect={() => movePage(p.id, -1)}>Monter</DropdownMenuItem><DropdownMenuItem onSelect={() => movePage(p.id, 1)}>Descendre</DropdownMenuItem><DropdownMenuItem onSelect={() => void printStoryboard(useStudio.getState().seed, p.id)}>Imprimer</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem danger onSelect={() => { if (confirm("Supprimer cette planche et ses cases ?")) deletePlanche(p.id); }}>Supprimer</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu>
          </div>;
        })}{!pages.length ? <p className="py-10 text-center text-sm text-paper-muted">Aucune planche pour ce filtre.</p> : null}</div>
        <Button className="mt-3 w-full" onClick={() => { const id = addPlanche(); void navigate({ to: "/planche/$plancheId", params: { plancheId: id } }); }}><Plus className="size-4" />Nouvelle planche</Button>
        <CaseOrderPanel />
      </PaperSheet>
    </div>
  </AppShell>;
}
