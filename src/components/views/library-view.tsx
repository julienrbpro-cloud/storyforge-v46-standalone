import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CaseImage } from "@/components/case-image";
import { PaperSheet, TabsBar } from "@/components/paper-sheet";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OFFICIAL_REFS } from "@/lib/constants";
import { allIssues } from "@/lib/coherence";
import { pickImage } from "@/lib/files";
import { useStudio } from "@/lib/store";
import { computeVisualPages, visualPageForCase } from "@/lib/visual-layout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TABS = [
  ["personnages", "Personnages"],
  ["regles", "Règles"],
  ["coherence", "Cohérence"],
] as const;

function officialImage(entityId: string) {
  return OFFICIAL_REFS.find((r) => r.entityId === entityId)?.data || null;
}

function guardianTitle(id: string) {
  if (id === "archiviste") return "Archiviste";
  if (id === "armurier") return "Armurier";
  return id;
}

export function LibraryView() {
  const seed = useStudio((s) => s.seed);
  const revision = useStudio((s) => s.revision);
  const setEntityField = useStudio((s) => s.setLibraryEntityField);
  const setRuleField = useStudio((s) => s.setEditorialRuleField);
  const setChoiceField = useStudio((s) => s.setEditorialChoiceField);
  const replaceLibraryImage = useStudio((s) => s.replaceLibraryImage);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const addPerson = useStudio((s) => s.addLibraryPerson);
  const addGuardian = useStudio((s) => s.addLibraryGuardian);
  const addRule = useStudio((s) => s.addEditorialRule);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("personnages");
  void revision;

  async function chooseImage(kind: "personnage" | "gardien", id: string) {
    try {
      const file = await pickImage();
      if (file) await replaceLibraryImage(kind, id, file);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <AppShell title={<div className="font-display text-lg">Personnages & règles</div>} back={<Link to="/projet" className="grid size-10 place-items-center text-cream" aria-label="Retour au projet">←</Link>}>
      <div className="view-enter flex min-h-0 flex-1 flex-col">
        <p className="px-4 pt-3 pb-1 text-sm text-muted">
          Le monde de {seed.projet.titre} — visages, règles, et ce qui doit rester cohérent.
        </p>
        <PaperSheet>
          <TabsBar tabs={TABS} value={tab} onChange={(id) => setTab(id as (typeof TABS)[number][0])} />

          {tab === "personnages" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(seed.personnages || []).map((person) => {
                const image = person.image || (activeProjectId === "original" ? officialImage(person.id) : null);
                return (
                  <article key={person.id} className="overflow-hidden rounded-xl border border-paper-line bg-paper">
                    <div className="relative grid h-56 place-items-center overflow-hidden bg-cream-2">
                      {image ? (
                        <CaseImage src={image} alt={person.nom || person.id} className="h-full w-full object-contain" />
                      ) : (
                        <div className="font-display text-3xl text-accent">{(person.nom || person.id).slice(0, 1)}</div>
                      )}
                      <Button
                        type="button"
                        variant="paper"
                        size="sm"
                        className="absolute right-2 bottom-2 rounded-md"
                        onClick={() => void chooseImage("personnage", person.id)}
                      >
                        Remplacer l’image
                      </Button>
                    </div>
                    <div className="space-y-2 p-3">
                      <Field label="Nom">
                        <Input
                          value={person.nom || ""}
                          onChange={(e) => setEntityField("personnage", person.id, "nom", e.target.value)}
                        />
                      </Field>
                      <Field label="Rôle">
                        <Input
                          value={person.role || ""}
                          onChange={(e) => setEntityField("personnage", person.id, "role", e.target.value)}
                        />
                      </Field>
                      <Field label="Description">
                        <Textarea
                          value={person.note || ""}
                          onChange={(e) => setEntityField("personnage", person.id, "note", e.target.value)}
                        />
                      </Field>
                    </div>
                  </article>
                );
              })}

              {(seed.gardiens || []).map((guardian) => {
                const image = guardian.image || (activeProjectId === "original" ? officialImage(guardian.id) : null);
                return (
                  <article key={guardian.id} className="overflow-hidden rounded-xl border border-paper-line bg-paper">
                    <div className="relative grid h-56 place-items-center overflow-hidden bg-cream-2">
                      {image ? (
                        <CaseImage src={image} alt={guardian.nom || guardianTitle(guardian.id)} className="h-full w-full object-contain" />
                      ) : (
                        <div className="font-display text-3xl text-accent">{(guardian.nom || guardianTitle(guardian.id)).slice(0, 1)}</div>
                      )}
                      <Button
                        type="button"
                        variant="paper"
                        size="sm"
                        className="absolute right-2 bottom-2 rounded-md"
                        onClick={() => void chooseImage("gardien", guardian.id)}
                      >
                        Remplacer l’image
                      </Button>
                    </div>
                    <div className="space-y-2 p-3">
                      <Field label="Nom">
                        <Input value={guardian.nom || guardianTitle(guardian.id)} onChange={(e) => setEntityField("gardien", guardian.id, "nom", e.target.value)} />
                      </Field>
                      <Field label="Rôle">
                        <Input
                          value={guardian.role || ""}
                          onChange={(e) => setEntityField("gardien", guardian.id, "role", e.target.value)}
                        />
                      </Field>
                      <Field label="Description">
                        <Textarea value={guardian.note || ""} onChange={(e) => setEntityField("gardien", guardian.id, "note", e.target.value)} />
                      </Field>
                      <Field label="Fonction protectrice">
                        <Textarea
                          value={guardian.fonction_protectrice || ""}
                          onChange={(e) =>
                            setEntityField("gardien", guardian.id, "fonction_protectrice", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Évolution">
                        <Textarea
                          value={guardian.evolution || ""}
                          onChange={(e) => setEntityField("gardien", guardian.id, "evolution", e.target.value)}
                        />
                      </Field>
                      <Field label="Objets permanents">
                        <Textarea
                          value={(guardian.objets_permanents || []).join("\n")}
                          onChange={(e) =>
                            setEntityField(
                              "gardien",
                              guardian.id,
                              "objets_permanents",
                              e.target.value
                                .split("\n")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      </Field>
                    </div>
                  </article>
                );
              })}
              <div className="col-span-full flex flex-wrap gap-2">
                <Button variant="paper" onClick={addPerson}>Ajouter un personnage</Button>
                {seed.gardiens.length < 2 ? <Button variant="paper" onClick={addGuardian}>Ajouter un gardien</Button> : null}
              </div>
            </div>
          ) : null}

          {tab === "regles" ? (
            <div className="space-y-3">
              {(seed.regles_editoriales || []).length ? (
                (seed.regles_editoriales || []).map((rule) => (
                  <article key={rule.id} className="space-y-2 rounded-xl border border-paper-line bg-paper p-3">
                    <Field label="Titre">
                      <Input
                        value={rule.titre}
                        onChange={(e) => setRuleField(rule.id, "titre", e.target.value)}
                      />
                    </Field>
                    <Field label="Contenu">
                      <Textarea
                        className="min-h-28"
                        value={rule.contenu}
                        onChange={(e) => setRuleField(rule.id, "contenu", e.target.value)}
                      />
                    </Field>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-paper-line px-4 py-10 text-center text-sm text-paper-muted">
                  Aucune règle éditoriale.
                </div>
              )}
              <Button variant="paper" className="w-full" onClick={addRule}>Ajouter une règle</Button>
              {(seed.choix_editoriaux_ouverts || []).map((choice) => <article key={choice.id} className="space-y-2 rounded-xl border border-paper-line bg-paper p-3">
                <h3 className="text-xs font-bold">Repère éditorial · planche {choice.planche}, case {choice.case}</h3>
                <Field label="Description"><Textarea value={choice.description || ""} onChange={(e) => setChoiceField(choice.id, "description", e.target.value)} /></Field>
                <Field label="Règle"><Textarea value={choice.regle} onChange={(e) => setChoiceField(choice.id, "regle", e.target.value)} /></Field>
              </article>)}
            </div>
          ) : null}

          {tab === "coherence" ? <CoherencePanel /> : null}
        </PaperSheet>
      </div>
    </AppShell>
  );
}

function CoherencePanel() {
  const seed = useStudio((s) => s.seed);
  const revision = useStudio((s) => s.revision);
  const navigate = useNavigate();
  void revision;
  const list = allIssues(seed);
  const errors = list.filter((x) => x.level === "error").length;
  const warns = list.filter((x) => x.level === "warn").length;
  return (
    <>
      <div className="mb-3 flex gap-2">
        <span className="rounded-full bg-chip px-2.5 py-1.5 text-[11px] font-extrabold text-chip-fg">
          {errors} erreur{errors > 1 ? "s" : ""}
        </span>
        <span className="rounded-full bg-chip px-2.5 py-1.5 text-[11px] font-extrabold text-chip-fg">
          {warns} avertissement{warns > 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {list.length ? (
          list.map((x) => (
            <button
              key={`${x.pageId}-${x.title}`}
              type="button"
              className={cn(
                "rounded-xl border p-2.5 text-left text-xs leading-snug",
                x.level === "error" && "border-danger/40 bg-danger/10 text-danger",
                x.level === "warn" && "border-accent/40 bg-chip text-chip-fg",
              )}
              onClick={() =>
                x.pageId && void navigate({ to: "/planche/$plancheId", params: { plancheId: String(Math.max(1, visualPageForCase(computeVisualPages(seed), seed.planches.find((p) => p.id === x.pageId)?.cases[0]?.id || "") + 1)) } })
              }
            >
              <b className="mb-0.5 block">
                P{x.pageNumero} — {x.title}
              </b>
              {x.text}
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-ok/40 bg-ok/15 p-2.5 text-sm text-chip-fg">Tout est cohérent.</div>
        )}
      </div>
    </>
  );
}
