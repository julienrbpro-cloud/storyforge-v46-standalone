import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PaperSheet } from "@/components/paper-sheet";
import { CaseImage } from "@/components/case-image";
import { CaseOrderPanel } from "@/components/case-order-panel";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { computeVisualPages, visualPageForCase } from "@/lib/visual-layout";
import { PROJECT_GENRES } from "@/lib/project";
import { padPage } from "@/lib/utils";

export function ProjectView() {
  const seed = useStudio((s) => s.seed);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const revision = useStudio((s) => s.revision);
  const addCase = useStudio((s) => s.addCase);
  const setSearchOpen = useStudio((s) => s.setSearchOpen);
  const navigate = useNavigate();
  void revision;
  const pages = computeVisualPages(seed);
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
        <h2 className="mb-3 font-display text-lg">Planches visuelles · {pages.length}</h2>
        <div className="grid gap-2 sm:grid-cols-2">{pages.map((page, index) => {
          const thumb = page.items.find(({ c }) => c.image)?.c;
          return <Link key={index} to="/planche/$plancheId" params={{ plancheId: String(index + 1) }} className="flex min-h-20 items-center gap-3 rounded-xl border border-paper-line bg-paper p-2">
            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-cream-2">{thumb?.image ? <CaseImage src={thumb.image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center font-display text-accent/50">{padPage(index + 1)}</span>}</div>
            <div><b className="block text-sm">Planche {padPage(index + 1)}</b><span className="text-xs text-paper-muted">{page.items.length} case{page.items.length > 1 ? "s" : ""} · Cases {page.items[0]?.c.numero}–{page.items.at(-1)?.c.numero}</span></div>
          </Link>;
        })}</div>
        {!pages.length ? <p className="py-8 text-center text-sm text-paper-muted">Aucune case pour l’instant.</p> : null}
        <Button className="mt-3 w-full" onClick={() => {
          const id = addCase();
          const index = visualPageForCase(computeVisualPages(useStudio.getState().seed), id);
          void navigate({ to: "/planche/$plancheId", params: { plancheId: String(index + 1) } });
        }}><Plus className="size-4" />Ajouter une case</Button>
        <CaseOrderPanel />
      </PaperSheet>
    </div>
  </AppShell>;
}
