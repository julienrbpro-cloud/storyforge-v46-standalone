import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, Plus, Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CaseCard } from "@/components/case-card";
import { CaseInspector } from "@/components/case-inspector";
import { PaperSheet } from "@/components/paper-sheet";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { printVisualPage } from "@/lib/print";
import { progressOf, PROJECT_GENRES } from "@/lib/project";
import { totalCases } from "@/lib/seed";
import { caseLabel, storyCases } from "@/lib/sequence";
import { useStudio } from "@/lib/store";
import type { Planche } from "@/lib/types";
import { computeVisualPages, visualPageIndexOf } from "@/lib/visual-layout";

const EMPTY_PAGE: Planche = {
  id: "",
  numero: 0,
  titre: "",
  chapitre: null,
  date_histoire: null,
  gardien_etat: {
    archiviste: { present: false, niveau: null },
    armurier: { present: false, niveau: null },
  },
  instructions_planche: null,
  notes_planche: null,
  cases: [],
};

export function ProjectView() {
  const seed = useStudio((s) => s.seed);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const meta = useStudio((s) => s.meta);
  const revision = useStudio((s) => s.revision);
  const index = useStudio((s) => s.visualPageIndex);
  const setIndex = useStudio((s) => s.setVisualPageIndex);
  const selected = useStudio((s) => s.selectedCaseId);
  const setSelected = useStudio((s) => s.setSelectedCase);
  const addCase = useStudio((s) => s.addCase);
  const deleteCase = useStudio((s) => s.deleteCase);
  const [boardOpen, setBoardOpen] = useState(false);
  void revision;
  const cases = storyCases(seed);
  const pages = computeVisualPages(seed);
  const pageIndex = Math.min(Math.max(index, 0), Math.max(0, pages.length - 1));
  const page = pages[pageIndex];
  const prog = progressOf(seed, meta);
  const panel = selected ? cases.find((item) => item.id === selected) || null : null;
  const editorPage = panel
    ? seed.planches.find((item) => item.id === panel.planche_id) || EMPTY_PAGE
    : undefined;

  useEffect(() => {
    if (!selected) return;
    setBoardOpen(true);
    setIndex(visualPageIndexOf(storyCases(useStudio.getState().seed), selected));
  }, [selected, setIndex]);

  function closeEditor() {
    const id = useStudio.getState().selectedCaseId;
    if (id) setIndex(visualPageIndexOf(storyCases(useStudio.getState().seed), id));
    setSelected(null);
  }

  return (
    <AppShell
      showSearch
      back={
        <Link to="/" aria-label="Projets" className="grid size-10 place-items-center text-cream">
          <ArrowLeft className="size-5" />
        </Link>
      }
      title={<span className="sr-only">{seed.projet.titre}</span>}
      actions={
        boardOpen && pages.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" title="Plus">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void printVisualPage(useStudio.getState().seed, pageIndex)}>
                <Printer className="size-4" />
                Imprimer la planche
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null
      }
    >
      <div className="view-enter flex min-h-0 flex-1 flex-col">
        <div className="border-b border-line px-4 py-3 text-center">
          {activeProjectId === "original" ? (
            <img
              src="/assets/nous-malgre-nous-cover.png"
              alt=""
              className="mx-auto mb-3 max-h-48 w-full object-contain"
            />
          ) : null}
          <h2 className="font-display text-2xl">{seed.projet.titre}</h2>
          {activeProjectId === "original" ? <div className="mt-1 text-xs text-muted">{PROJECT_GENRES}</div> : null}
          {seed.projet.sous_titre ? (
            <p className="mx-auto mt-2 max-w-[320px] font-display text-sm text-cream-2 italic">
              « {seed.projet.sous_titre} »
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            {pages.length} planches visuelles · {totalCases(seed)} cases
          </p>
        </div>

        <PaperSheet>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Button asChild variant="paper" className="h-auto min-h-11 w-full whitespace-normal px-2 text-center">
              <Link to="/bibliotheque">Personnages & règles</Link>
            </Button>
            <Button asChild variant="paper" className="h-auto min-h-11 w-full whitespace-normal px-2 text-center">
              <Link to="/donnees">Exporter</Link>
            </Button>
          </div>
          <div className="mb-3 flex items-center gap-2.5">
            <ProgressBar value={prog.pct} track="paper" className="flex-1" />
            <span className="text-right text-xs font-bold text-chip-fg">{prog.label}</span>
          </div>
          {boardOpen && page ? (
            <>
              <div className="mb-2.5 flex items-center gap-2">
                <Button variant="paper" className="h-11 shrink-0" onClick={() => setBoardOpen(false)}>
                  Toutes les planches
                </Button>
                <select
                  aria-label="Planche visuelle"
                  className="h-11 min-w-0 flex-1 rounded-md border border-paper-line bg-paper px-2 text-paper-ink"
                  value={pageIndex}
                  onChange={(event) => setIndex(Number(event.target.value))}
                >
                  {pages.map((_, i) => (
                    <option key={i} value={i}>
                      Planche {i + 1} / {pages.length}
                    </option>
                  ))}
                </select>
              </div>
              <div className="visual-grid w-full max-w-[900px]">
                {page.items.map(({ c, row, col, width, height }) => (
                  <div
                    key={c.id}
                    className="min-h-0 min-w-0"
                    style={{ gridColumn: `${col + 1} / span ${width}`, gridRow: `${row + 1} / span ${height}` }}
                  >
                    <CaseCard panel={c} compact selected={selected === c.id} onSelect={() => setSelected(c.id)} />
                  </div>
                ))}
              </div>
            </>
          ) : pages.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {pages.map((visual, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Planche ${i + 1}`}
                  className="rounded-xl border border-paper-line bg-paper p-2 text-left text-paper-ink"
                  onClick={() => {
                    setIndex(i);
                    setBoardOpen(true);
                  }}
                >
                  <span className="block font-display text-lg">Planche {i + 1}</span>
                  <span aria-hidden="true" className="text-[11px] text-paper-muted">
                    {visual.items.length} case{visual.items.length > 1 ? "s" : ""}
                  </span>
                  <span aria-hidden="true" className="mt-2 grid aspect-[3/4] grid-cols-3 grid-rows-4 gap-px">
                    {visual.occupied.map((filled, cell) => (
                      <span key={cell} className={filled ? "bg-paper-ink/75" : "bg-paper-line/50"} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-paper-line px-4 py-10 text-center text-sm text-paper-muted">
              Aucune planche.
            </div>
          )}
          <Button className="mt-3 w-full" onClick={() => addCase("")}>
            <Plus className="size-4" />
            Ajouter une case
          </Button>
        </PaperSheet>
      </div>
      {panel && editorPage ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeEditor();
          }}
        >
          <DialogContent title={`Case ${caseLabel(panel, cases)}`}>
            <CaseInspector page={editorPage} panel={panel} />
            <Button
              variant="danger"
              className="mt-3 w-full"
              onClick={() => {
                if (!confirm("Supprimer cette case ?")) return;
                deleteCase(editorPage.id, panel.id);
              }}
            >
              Supprimer la case
            </Button>
          </DialogContent>
        </Dialog>
      ) : null}
    </AppShell>
  );
}
