import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileText, MoreHorizontal, Plus, Printer, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CaseCard } from "@/components/case-card";
import { CaseInspector } from "@/components/case-inspector";
import { PaperSheet } from "@/components/paper-sheet";
import { PageStatusBadge } from "@/components/status-badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { checkPage } from "@/lib/coherence";
import { useStudio } from "@/lib/store";
import { printStoryboard } from "@/lib/print";
import { caseLabel } from "@/lib/sequence";
import { padPage } from "@/lib/utils";
import { computeVisualPages } from "@/lib/visual-layout";
import { useEffect, useState } from "react";
import { GUARDIANS } from "@/lib/constants";

export function PlancheView({ plancheId }: { plancheId: string }) {
  const seed = useStudio((s) => s.seed);
  const meta = useStudio((s) => s.meta);
  const revision = useStudio((s) => s.revision);
  const selected = useStudio((s) => s.selectedCaseId);
  const setSelected = useStudio((s) => s.setSelectedCase);
  const addCase = useStudio((s) => s.addCase);
  const deleteCase = useStudio((s) => s.deleteCase);
  const deletePlanche = useStudio((s) => s.deletePlanche);
  const setPageField = useStudio((s) => s.setPageField);
  const setPageGuardian = useStudio((s) => s.setPageGuardian);
  const setPageNote = useStudio((s) => s.setPageNote);
  const [pageIndex, setPageIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  void revision;
  const p = seed.planches.find((x) => x.id === plancheId);
  useEffect(() => {
    setSheetOpen(Boolean(selected && p?.cases.some((c) => c.id === selected)));
  }, [plancheId, selected, p?.cases]);
  useEffect(() => { setPageIndex(0); }, [plancheId]);
  if (!p) {
    return (
      <AppShell title={<div className="font-display text-lg">Planche introuvable</div>}>
        <div className="p-6 text-muted">Cette planche n’existe plus.</div>
      </AppShell>
    );
  }
  const panel = selected ? p.cases.find((c) => c.id === selected) || null : p.cases[0] || null;
  const issues = checkPage(seed, p).filter((x) => x.level === "error");
  const visualPages = computeVisualPages({ ...seed, planches: [p] });
  const currentIndex = Math.min(pageIndex, Math.max(0, visualPages.length - 1));
  const visualPage = visualPages[currentIndex];

  function openCase(cid: string) {
    setSelected(cid);
    setSheetOpen(true);
  }

  return (
    <AppShell
      back={
        <Link to="/projet" className="grid size-10 place-items-center text-cream">
          <ArrowLeft className="size-5" />
        </Link>
      }
      title={
        <div>
          <h2 className="font-display text-[22px] leading-none">Planche {padPage(p.numero)}</h2>
          <div className="mt-0.5 truncate text-[12.5px] text-muted">{p.titre}</div>
        </div>
      }
      actions={
        <div className="flex items-center gap-1.5">
          <PageStatusBadge id={p.id} stop={false} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" title="Plus">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void printStoryboard(seed, p.id)}>
                <Printer className="size-4" />
                Imprimer la planche
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  addCase(p.id);
                }}
              >
                <Plus className="size-4" />
                Ajouter une case
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                danger
                onSelect={() => {
                  if (!confirm("Supprimer cette planche ?")) return;
                  deletePlanche(p.id);
                  void navigate({ to: "/projet" });
                }}
              >
                <Trash2 className="size-4" />
                Supprimer la planche
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="view-enter flex min-h-0 flex-1 flex-col">
        <PaperSheet>
          {issues.length ? <div className="mb-3 rounded-xl border border-dashed border-accent/40 bg-chip px-3 py-2 text-[11.5px] text-chip-fg">{issues.length} alerte{issues.length > 1 ? "s" : ""} de cohérence — voir les détails de la planche.</div> : null}
          {visualPages.length > 1 ? (
            <div className="mb-3 flex items-center justify-between gap-2 text-sm">
              <Button variant="paper" size="sm" disabled={currentIndex === 0} onClick={() => setPageIndex(currentIndex - 1)}>←</Button>
              <span>Grille {currentIndex + 1} / {visualPages.length}</span>
              <Button variant="paper" size="sm" disabled={currentIndex === visualPages.length - 1} onClick={() => setPageIndex(currentIndex + 1)}>→</Button>
            </div>
          ) : null}
          {visualPage ? (
            <div className="visual-grid w-full max-w-[900px] self-center">
              {visualPage.items.map(({ c, row, col, width, height }) => (
                <div key={c.id} className="min-h-0 min-w-0" style={{ gridColumn: `${col + 1} / span ${width}`, gridRow: `${row + 1} / span ${height}` }}>
                  <CaseCard panel={c} compact selected={selected === c.id && sheetOpen} onSelect={() => openCase(c.id)} />
                </div>
              ))}
            </div>
          ) : <p className="py-8 text-center text-sm text-paper-muted">Aucune case sur cette planche.</p>}
          <button type="button" className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-subtle/60 text-[13px] font-semibold text-tab" onClick={() => { addCase(p.id); setPageIndex(visualPages.length ? visualPages.length - 1 : 0); }}>
            <Plus className="size-4" /> Ajouter une case
          </button>
          <div className="mt-4 rounded-xl border border-line bg-panel p-3.5 text-cream">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-accent" />Dialogue global <span className="font-normal text-muted">(optionnel)</span></div>
            <textarea className="min-h-16 w-full rounded-lg border border-line bg-ink p-2.5 text-[12.5px] leading-relaxed text-cream-2 outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-accent/50" placeholder="Dialogue global de la planche" value={p.instructions_planche || ""} onChange={(e) => setPageField(p.id, "instructions_planche", e.target.value)} />
          </div>
          <details className="mt-3 rounded-xl border border-paper-line bg-paper p-3">
            <summary className="min-h-9 cursor-pointer font-semibold">Détails de la planche et gardiens</summary>
            <div className="mt-3 space-y-3">
              <Field label="Titre">
                <Input value={p.titre || ""} onChange={(e) => setPageField(p.id, "titre", e.target.value)} />
              </Field>
              <Field label="Date dans l’histoire">
                <Input
                  value={p.date_histoire || ""}
                  onChange={(e) => setPageField(p.id, "date_histoire", e.target.value)}
                />
              </Field>
              {(p.notes_planche || []).map((n, i) => (
                <div key={i} className="rounded-xl border border-paper-line bg-paper p-3">
                  <h5 className="mb-1.5 text-xs font-bold tracking-wide text-tab-on uppercase">
                    Note canonique {i + 1}
                  </h5>
                  <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">{n}</p>
                </div>
              ))}
              <Field label="Note de production">
                <Textarea
                  placeholder="Repères de dessin, références, à faire…"
                  defaultValue={meta.notes[p.id] || ""}
                  key={p.id}
                  onChange={(e) => setPageNote(p.id, e.target.value)}
                />
              </Field>
              <h5 className="text-xs font-bold text-tab-on">État des gardiens</h5>
              <div className="grid grid-cols-2 gap-2">
                {GUARDIANS.map(([gid, label]) => {
                  const guardian = p.gardien_etat[gid];
                  return <Field key={gid} label={seed.gardiens.find((g) => g.id === gid)?.nom || label}>
                    <select className="h-11 w-full rounded-md border border-paper-line bg-paper px-2"
                      value={guardian.present ? String(guardian.niveau ?? 0) : "absent"}
                      onChange={(event) => {
                        const value = event.target.value;
                        setPageGuardian(p.id, gid, "present", value !== "absent");
                        if (value !== "absent") setPageGuardian(p.id, gid, "niveau", Number(value));
                      }}>
                      <option value="absent">Absent</option>
                      {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Présent · niveau {n}</option>)}
                    </select>
                  </Field>;
                })}
              </div>
              {issues.length ? (
                <div className="space-y-2">
                  {issues.map((x) => (
                    <div key={x.title} className="rounded-xl border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
                      <b className="block">{x.title}</b>
                      {x.text}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-ok/40 bg-ok/15 p-2.5 text-xs text-chip-fg">
                  Aucune alerte de cohérence.
                </div>
              )}
            </div>
          </details>
        </PaperSheet>
      </div>

      {panel ? (
        <Dialog
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open && selected) {
              const index = visualPages.findIndex((page) => page.items.some(({ c }) => c.id === selected));
              if (index >= 0) setPageIndex(index);
              setSelected(null);
            }
          }}
        >
          <DialogContent title={`Case ${caseLabel(panel)}`}>
            <CaseInspector page={p} panel={panel} />
            <Button
              variant="danger"
              className="mt-3 w-full"
              onClick={() => {
                if (!confirm("Supprimer cette case ?")) return;
                deleteCase(p.id, panel.id);
                setSheetOpen(false);
                setSelected(null);
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
