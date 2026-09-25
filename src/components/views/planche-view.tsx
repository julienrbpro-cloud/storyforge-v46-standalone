import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CaseCard } from "@/components/case-card";
import { CaseInspector } from "@/components/case-inspector";
import { PaperSheet } from "@/components/paper-sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useStudio } from "@/lib/store";
import { computeVisualPages, visualPageForCase } from "@/lib/visual-layout";
import { padPage } from "@/lib/utils";

export function PlancheView({ plancheId }: { plancheId: string }) {
  const seed = useStudio((s) => s.seed);
  const revision = useStudio((s) => s.revision);
  const selected = useStudio((s) => s.selectedCaseId);
  const setSelected = useStudio((s) => s.setSelectedCase);
  const addCase = useStudio((s) => s.addCase);
  const deleteCase = useStudio((s) => s.deleteCase);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  void revision;
  const pages = computeVisualPages(seed);
  const legacySource = seed.planches.find((p) => p.id === plancheId);
  const legacyIndex = legacySource?.cases.length ? visualPageForCase(pages, legacySource.cases[0].id) : -1;
  const pageIndex = /^\d+$/.test(plancheId) ? Number(plancheId) - 1 : legacyIndex;
  const page = pages[pageIndex];
  const entry = selected ? pages.flatMap((visual) => visual.items).find(({ c }) => c.id === selected) : undefined;
  const hasEntry = Boolean(entry);
  const selectedIndex = selected ? visualPageForCase(pages, selected) : -1;

  useEffect(() => { setSheetOpen(hasEntry); }, [selected, hasEntry]);
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex !== pageIndex)
      void navigate({ to: "/planche/$plancheId", params: { plancheId: String(selectedIndex + 1) }, replace: true });
  }, [selectedIndex, pageIndex, navigate]);

  function addHere() {
    const id = addCase(page?.items.at(-1)?.c.id);
    const nextIndex = visualPageForCase(computeVisualPages(useStudio.getState().seed), id);
    if (nextIndex >= 0 && nextIndex !== pageIndex)
      void navigate({ to: "/planche/$plancheId", params: { plancheId: String(nextIndex + 1) }, replace: true });
  }

  return <AppShell
    back={<Link to="/projet" className="grid size-10 place-items-center text-cream" aria-label="Retour au projet"><ArrowLeft className="size-5" /></Link>}
    title={<h1 className="font-display text-[22px]">Planche visuelle {padPage(pageIndex + 1)}</h1>}>
    <div className="view-enter flex min-h-0 flex-1 flex-col"><PaperSheet>
      {page ? <>
        <div className="mb-3 flex items-center justify-between gap-2 text-sm">
          <Button variant="paper" size="sm" disabled={pageIndex <= 0} onClick={() => void navigate({ to: "/planche/$plancheId", params: { plancheId: String(pageIndex) } })}>← Précédente</Button>
          <span>{pageIndex + 1} / {pages.length}</span>
          <Button variant="paper" size="sm" disabled={pageIndex >= pages.length - 1} onClick={() => void navigate({ to: "/planche/$plancheId", params: { plancheId: String(pageIndex + 2) } })}>Suivante →</Button>
        </div>
        <div className="visual-grid mx-auto w-full max-w-[675px]">
          {page.items.map(({ c, row, col, width, height }) => <div key={c.id} className="min-h-0 min-w-0" style={{ gridColumn: `${col + 1} / span ${width}`, gridRow: `${row + 1} / span ${height}` }}>
            <CaseCard panel={c} compact selected={selected === c.id && sheetOpen} onSelect={() => setSelected(c.id)} />
          </div>)}
        </div>
      </> : <p className="py-8 text-center text-sm text-paper-muted">Cette planche visuelle n’existe plus après le reflow.</p>}
      <button type="button" className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-subtle/60 text-[13px] font-semibold text-tab" onClick={addHere}>
        <Plus className="size-4" /> Ajouter une case
      </button>
    </PaperSheet></div>
    {entry ? <Dialog open={sheetOpen} onOpenChange={(open) => {
      setSheetOpen(open);
      if (!open && selected) {
        const index = visualPageForCase(computeVisualPages(useStudio.getState().seed), selected);
        if (index >= 0) void navigate({ to: "/planche/$plancheId", params: { plancheId: String(index + 1) }, replace: true });
        setSelected(null);
      }
    }}><DialogContent title={`Case ${entry.c.numero}`}>
      <CaseInspector page={entry.p} panel={entry.c} />
      <Button variant="danger" className="mt-3 w-full" onClick={() => {
        if (!confirm("Supprimer cette case ?")) return;
        deleteCase(entry.p.id, entry.c.id);
        setSheetOpen(false);
        const count = computeVisualPages(useStudio.getState().seed).length;
        if (count && pageIndex >= count) void navigate({ to: "/planche/$plancheId", params: { plancheId: String(count) }, replace: true });
      }}>Supprimer la case</Button>
    </DialogContent></Dialog> : null}
  </AppShell>;
}
