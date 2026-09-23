import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileText, MoreHorizontal, Plus, Printer, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CaseCard } from "@/components/case-card";
import { CaseInspector } from "@/components/case-inspector";
import { PaperSheet, TabsBar } from "@/components/paper-sheet";
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
import { pickImage } from "@/lib/files";
import { padPage } from "@/lib/utils";
import { useEffect, useState } from "react";
import { GUARDIANS } from "@/lib/constants";
import { toast } from "sonner";

const TABS = [
  ["storyboard", "Storyboard"],
  ["notes", "Notes"],
  ["fichiers", "Fichiers"],
] as const;

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
  const replaceImage = useStudio((s) => s.replaceCaseImage);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("storyboard");
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  void revision;
  const p = seed.planches.find((x) => x.id === plancheId);
  useEffect(() => {
    setSheetOpen(Boolean(selected && p?.cases.some((c) => c.id === selected)));
  }, [plancheId, selected]);
  if (!p) {
    return (
      <AppShell title={<div className="font-display text-lg">Planche introuvable</div>}>
        <div className="p-6 text-muted">Cette planche n’existe plus.</div>
      </AppShell>
    );
  }
  const panel = p.cases.find((c) => c.id === selected) || p.cases[0] || null;
  const issues = checkPage(seed, p).filter((x) => x.level === "error");

  function openCase(cid: string) {
    setSelected(cid);
    setSheetOpen(true);
  }

  async function addImage(cid: string) {
    const file = await pickImage();
    if (file) await replaceImage(cid, file).catch((error: Error) => toast.error(error.message));
  }

  return (
    <AppShell
      hideNav
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
          <TabsBar tabs={TABS} value={tab} onChange={(id) => setTab(id as (typeof TABS)[number][0])} />

          {tab === "storyboard" ? (
            <>
              {issues.length ? (
                <div className="mb-3 rounded-xl border border-dashed border-accent/40 bg-chip px-3 py-2 text-[11.5px] leading-snug text-chip-fg">
                  {issues.length} alerte{issues.length > 1 ? "s" : ""} de cohérence — voir les notes.
                </div>
              ) : null}
              <div className="mx-auto grid max-w-[720px] grid-cols-2 gap-3">
                {p.cases.map((c) => (
                  <CaseCard
                    key={c.id}
                    panel={c}
                    selected={selected === c.id}
                    onSelect={() => openCase(c.id)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-subtle/60 text-[13px] font-semibold text-tab"
                onClick={() => addCase(p.id)}
              >
                <Plus className="size-4" />
                Ajouter une case
              </button>
              <div className="mt-4 rounded-xl border border-line bg-panel p-3.5 text-cream">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-accent" />
                  Dialogue global
                  <span className="font-normal text-muted">(optionnel)</span>
                </div>
                <textarea
                  className="min-h-16 w-full rounded-lg border border-line bg-ink p-2.5 text-[12.5px] leading-relaxed text-cream-2 outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-accent/50"
                  placeholder="Une planche, un fil. Ce que l’on laisse derrière soi."
                  value={p.instructions_planche || ""}
                  onChange={(e) => setPageField(p.id, "instructions_planche", e.target.value)}
                />
              </div>
            </>
          ) : null}

          {tab === "notes" ? (
            <div className="space-y-3">
              <Field label="Titre">
                <Input value={p.titre || ""} onChange={(e) => setPageField(p.id, "titre", e.target.value)} />
              </Field>
              <Field label="Chapitre">
                <Input value={p.chapitre || ""} onChange={(e) => setPageField(p.id, "chapitre", e.target.value)} />
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
                  return <Field key={gid} label={label}>
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
          ) : null}

          {tab === "fichiers" ? (
            <div className="space-y-2">
              {p.cases.length ? (
                p.cases.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2.5 rounded-xl border border-paper-line bg-paper px-3 py-2 text-xs"
                  >
                    <span className="flex-1 font-semibold">
                      Case {c.numero}
                      {c.titre ? ` — ${c.titre}` : ""}
                    </span>
                    <span className="max-w-[36%] truncate text-[10.5px] text-subtle">
                      {c.image ? "image jointe" : "aucune image"}
                    </span>
                    <button
                      type="button"
                      className="rounded-full border border-paper-line bg-cream px-3 py-1.5 font-bold"
                      onClick={() => void addImage(c.id)}
                    >
                      {c.image ? "Remplacer" : "Ajouter"}
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-paper-line px-4 py-10 text-center text-sm text-paper-muted">
                  Ajoute une case pour y joindre des images.
                </div>
              )}
            </div>
          ) : null}
        </PaperSheet>
      </div>

      {tab === "storyboard" && panel ? (
        <Dialog
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
          }}
        >
          <DialogContent title={`Case ${panel.numero}`}>
            <CaseInspector page={p} panel={panel} />
            <Button
              variant="danger"
              className="mt-3 w-full"
              onClick={() => {
                if (!confirm("Supprimer cette case ?")) return;
                deleteCase(p.id, panel.id);
                setSheetOpen(false);
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
