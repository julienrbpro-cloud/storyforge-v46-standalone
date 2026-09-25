import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GUARDIANS, TEXT_TYPES } from "@/lib/constants";
import { peopleOf } from "@/lib/seed";
import { useStudio } from "@/lib/store";
import { caseSize } from "@/lib/visual-layout";
import { buildPrompt } from "@/lib/prompt";
import { toast } from "sonner";
import type { Overlay, PanelCase, Planche } from "@/lib/types";
import { OverlayCanvas } from "@/components/overlay-canvas";
import { CaseStatusBadge } from "@/components/status-badge";
import { pickImage } from "@/lib/files";

function overlayText(c: PanelCase, o: Overlay) {
  if (o.text_ref) return c.textes.find((t) => t.id === o.text_ref)?.contenu || "";
  return o.content || "";
}

export function CaseInspector({ page, panel }: { page: Planche; panel: PanelCase }) {
  const seed = useStudio((s) => s.seed);
  const setCaseField = useStudio((s) => s.setCaseField);
  const togglePerson = useStudio((s) => s.toggleCasePerson);
  const setGuardian = useStudio((s) => s.setCaseGuardian);
  const setSize = useStudio((s) => s.setCaseSize);
  const setText = useStudio((s) => s.setTextField);
  const addText = useStudio((s) => s.addText);
  const removeText = useStudio((s) => s.removeText);
  const moveText = useStudio((s) => s.moveText);
  const addOverlay = useStudio((s) => s.addOverlay);
  const setOverlay = useStudio((s) => s.setOverlay);
  const setOverlayTextRef = useStudio((s) => s.setOverlayTextRef);
  const removeOverlay = useStudio((s) => s.removeOverlay);
  const replaceImage = useStudio((s) => s.replaceCaseImage);
  const removeImage = useStudio((s) => s.removeCaseImage);
  const [promptOpen, setPromptOpen] = useState(false);
  const promptText = buildPrompt(seed, page, panel);
  const size = caseSize(panel);
  const people = peopleOf(seed);

  async function chooseImage() {
    try {
      const file = await pickImage();
      if (file) await replaceImage(panel.id, file);
    } catch (error) { toast.error((error as Error).message); }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
      toast.success("Prompt copié");
    } catch {
      toast.error("Impossible de copier");
    }
  }

  return (
    <div className="space-y-3 text-paper-ink">
      <div className="flex flex-wrap gap-2">
        <CaseStatusBadge pid={page.id} cid={panel.id} statut={panel.statut} />
        <Button variant="paper" className="rounded-md" onClick={() => void chooseImage()}>
          {panel.image ? "Remplacer l’image" : "Ajouter une image"}
        </Button>
        {panel.image ? (
          <Button
            variant="paper"
            className="rounded-md"
            onClick={() => {
              if (confirm("Supprimer l’image courante de cette case ?")) removeImage(page.id, panel.id);
            }}
          >
            Retirer l’image
          </Button>
        ) : null}
      </div>
      <Field label="Titre">
        <Input
          value={panel.titre || ""}
          onChange={(e) => setCaseField(page.id, panel.id, "titre", e.target.value)}
        />
      </Field>
      <Field label="Mise en image">
        <Textarea
          value={panel.description || ""}
          onChange={(e) => setCaseField(page.id, panel.id, "description", e.target.value)}
        />
      </Field>
      <Field label="Note">
        <Textarea
          value={panel.notes || ""}
          onChange={(e) => setCaseField(page.id, panel.id, "notes", e.target.value)}
        />
      </Field>
      <h5 className="text-xs font-bold tracking-wide text-accent uppercase">Personnages</h5>
      <div className="flex flex-wrap gap-2">
        {people.map((x) => (
          <label key={x.id} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-5 accent-accent"
              checked={panel.personnages.includes(x.id)}
              onChange={(e) => togglePerson(page.id, panel.id, x.id, e.target.checked)}
            />
            {x.nom}
          </label>
        ))}
      </div>
      <h5 className="text-xs font-bold tracking-wide text-accent uppercase">Textes</h5>
      {(panel.textes || []).map((t, i) => {
        const locked = !!t.preserve_exact;
        return (
          <div
            key={t.id}
            className={`rounded-[10px] border border-paper-line bg-paper p-2.5 ${locked ? "border-l-4 border-l-accent" : ""}`}
          >
            <div className="grid grid-cols-2 gap-1.5">
              <select
                disabled={locked}
                className="h-10 rounded-md border border-paper-line bg-paper"
                value={t.type}
                onChange={(e) => setText(page.id, panel.id, t.id, "type", e.target.value)}
              >
                {TEXT_TYPES.map((x) => (
                  <option key={x[0]} value={x[0]}>
                    {x[1]}
                  </option>
                ))}
              </select>
              <select
                disabled={locked}
                className="h-10 rounded-md border border-paper-line bg-paper"
                value={t.personnage_id || ""}
                onChange={(e) => setText(page.id, panel.id, t.id, "personnage_id", e.target.value || null)}
              >
                <option value="">Sans personnage</option>
                {people.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom}
                  </option>
                ))}
              </select>
              <textarea
                readOnly={locked}
                className="col-span-2 min-h-20 rounded-md border border-paper-line bg-paper p-2"
                value={t.contenu || ""}
                onChange={(e) => setText(page.id, panel.id, t.id, "contenu", e.target.value)}
              />
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <label className="mr-auto inline-flex items-center gap-1.5 text-xs font-bold">
                <input
                  type="checkbox"
                  className="size-5 accent-accent"
                  checked={locked}
                  disabled={locked}
                  onChange={(e) => setText(page.id, panel.id, t.id, "preserve_exact", e.target.checked)}
                />
                preserve exact
              </label>
              <button
                type="button"
                disabled={locked}
                className="size-9 rounded-md border border-paper-line font-extrabold"
                onClick={() => moveText(page.id, panel.id, i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={locked}
                className="size-9 rounded-md border border-paper-line font-extrabold"
                onClick={() => moveText(page.id, panel.id, i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                disabled={locked}
                className="size-9 rounded-md border border-paper-line font-extrabold"
                onClick={() => {
                  if (confirm("Supprimer ce bloc de texte ?")) removeText(page.id, panel.id, t.id);
                }}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
      <Button variant="paper" className="w-full rounded-md" onClick={() => addText(page.id, panel.id)}>
        Ajouter un dialogue
      </Button>
      <details className="rounded-xl border border-paper-line bg-paper p-2.5">
        <summary className="cursor-pointer text-xs font-bold tracking-wide text-paper-muted uppercase">
          Options avancées
        </summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {GUARDIANS.map(([gid, label]) => {
              const o = panel.gardien_override?.[gid];
              const value = o == null ? "inherit" : o.present === false ? "absent" : String(o.niveau);
              return (
                <label key={gid} className="text-[11px] font-extrabold text-paper-muted">
                  {seed.gardiens.find((g) => g.id === gid)?.nom || label}
                  <select
                    className="mt-1 h-11 w-full rounded-md border border-paper-line bg-paper font-normal text-paper-ink"
                    value={value}
                    onChange={(e) => setGuardian(page.id, panel.id, gid, e.target.value)}
                  >
                    <option value="inherit">Hérite de la planche</option>
                    <option value="absent">Absent</option>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={String(n)}>
                        Présent · niveau {n}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          <div className="flex gap-3">
            {(["width", "height"] as const).map((key) => (
              <label key={key} className="flex-1">
                <span className="mb-1 block text-[11px] font-extrabold tracking-wide text-paper-muted uppercase">
                  {key === "width" ? "Largeur grille" : "Hauteur grille"}
                </span>
                <select
                  className="h-11 w-full rounded-md border border-paper-line bg-paper px-2"
                  value={size[key]}
                  onChange={(e) => setSize(page.id, panel.id, key, Number(e.target.value))}
                >
                  {Array.from({ length: key === "height" ? 4 : 3 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <Button className="rounded-md" onClick={() => setPromptOpen(true)}>
            Assembler le prompt IA
          </Button>
          <h5 className="text-xs font-bold tracking-wide text-accent uppercase">Lettrage visuel</h5>
          <OverlayCanvas page={page} panel={panel} />
          <p className="text-[11px] leading-snug text-subtle">
            Optionnel. Le storyboard n’en dépend pas — les dialogues vivent d’abord comme texte.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="paper" className="rounded-md" onClick={() => addOverlay(page.id, panel.id, "text")}>
              Texte
            </Button>
            <Button variant="paper" className="rounded-md" onClick={() => addOverlay(page.id, panel.id, "speech")}>
              Bulle
            </Button>
          </div>
      {(panel.overlays || []).map((o) => (
        <div key={o.id} className="rounded-[10px] border border-paper-line bg-paper p-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            <label className="text-[10px] font-extrabold text-paper-muted">
              Type
              <select
                className="mt-1 h-10 w-full rounded-md border border-paper-line bg-paper font-normal"
                value={o.type}
                onChange={(e) => setOverlay(page.id, panel.id, o.id, { type: e.target.value as Overlay["type"] })}
              >
                <option value="text">Texte</option>
                <option value="speech">Bulle de dialogue</option>
              </select>
            </label>
            <label className="text-[10px] font-extrabold text-paper-muted">
              Source
              <select
                className="mt-1 h-10 w-full rounded-md border border-paper-line bg-paper font-normal"
                value={o.text_ref || ""}
                onChange={(e) => setOverlayTextRef(page.id, panel.id, o.id, e.target.value)}
              >
                <option value="">Texte libre</option>
                {panel.textes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.contenu.slice(0, 40)}
                  </option>
                ))}
              </select>
            </label>
            {o.text_ref ? (
              <label className="col-span-2 text-[10px] font-extrabold text-paper-muted">
                Contenu canonique
                <textarea readOnly className="mt-1 min-h-16 w-full rounded-md border border-paper-line p-2 font-normal" value={overlayText(panel, o)} />
              </label>
            ) : (
              <label className="col-span-2 text-[10px] font-extrabold text-paper-muted">
                Contenu libre
                <textarea
                  className="mt-1 min-h-16 w-full rounded-md border border-paper-line p-2 font-normal"
                  value={o.content || ""}
                  onChange={(e) => setOverlay(page.id, panel.id, o.id, { content: e.target.value })}
                />
              </label>
            )}
            <label className="text-[10px] font-extrabold text-paper-muted">
              Largeur
              <input
                type="range"
                min={0.08}
                max={0.9}
                step={0.01}
                value={o.width}
                onChange={(e) => setOverlay(page.id, panel.id, o.id, { width: Number(e.target.value) })}
                className="mt-2 w-full"
              />
            </label>
            {o.type === "speech" ? (
              <label className="text-[10px] font-extrabold text-paper-muted">
                Hauteur
                <input
                  type="range"
                  min={0.06}
                  max={0.7}
                  step={0.01}
                  value={o.height}
                  onChange={(e) => setOverlay(page.id, panel.id, o.id, { height: Number(e.target.value) })}
                  className="mt-2 w-full"
                />
              </label>
            ) : null}
            <label className="text-[10px] font-extrabold text-paper-muted">
              Taille
              <input
                type="range"
                min={0.02}
                max={0.12}
                step={0.005}
                value={o.font_size}
                onChange={(e) => setOverlay(page.id, panel.id, o.id, { font_size: Number(e.target.value) })}
                className="mt-2 w-full"
              />
            </label>
            <label className="text-[10px] font-extrabold text-paper-muted">
              Alignement
              <select
                className="mt-1 h-10 w-full rounded-md border border-paper-line bg-paper font-normal"
                value={o.align}
                onChange={(e) =>
                  setOverlay(page.id, panel.id, o.id, { align: e.target.value as Overlay["align"] })
                }
              >
                <option value="left">Gauche</option>
                <option value="center">Centre</option>
                <option value="right">Droite</option>
              </select>
            </label>
          </div>
          <Button
            variant="paper"
            size="sm"
            className="mt-2 rounded-md"
            onClick={() => {
              if (confirm("Supprimer cet élément visuel ?")) removeOverlay(page.id, panel.id, o.id);
            }}
          >
            Supprimer
          </Button>
        </div>
      ))}
      {panel.source_verbatim ? (
        <details>
          <summary className="cursor-pointer text-[11px] text-subtle">Voir la source verbatim</summary>
          <p className="mt-2 whitespace-pre-wrap text-[11px] text-subtle">{panel.source_verbatim}</p>
        </details>
      ) : null}
        </div>
      </details>
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent title={`Prompt · P${page.numero} case ${panel.numero}`}>
          <textarea
            readOnly
            spellCheck={false}
            className="min-h-[50vh] w-full rounded-md border border-paper-line bg-paper p-3 font-mono text-[13px] leading-relaxed"
            value={promptText}
          />
          <div className="mt-3 flex gap-2">
            <Button className="rounded-md" onClick={() => void copyPrompt()}>
              Copier le prompt
            </Button>
            <Button variant="paper" className="rounded-md" onClick={() => setPromptOpen(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
