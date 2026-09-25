import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CaseImage } from "@/components/case-image";
import { PaperSheet } from "@/components/paper-sheet";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OFFICIAL_REFS } from "@/lib/constants";
import { pickImage } from "@/lib/files";
import { useStudio } from "@/lib/store";
import { toast } from "sonner";

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
  const replaceLibraryImage = useStudio((s) => s.replaceLibraryImage);
  const activeProjectId = useStudio((s) => s.activeProjectId);
  const addPerson = useStudio((s) => s.addLibraryPerson);
  const addGuardian = useStudio((s) => s.addLibraryGuardian);
  const addRule = useStudio((s) => s.addEditorialRule);
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
    <AppShell
      showSearch
      back={
        <Link to="/projet" aria-label="Retour au projet" className="grid size-10 place-items-center text-cream">
          <ArrowLeft className="size-5" />
        </Link>
      }
      title={<div className="font-display text-lg leading-tight">Personnages & règles</div>}
    >
      <div className="view-enter flex min-h-0 flex-1 flex-col">
        <p className="px-4 pt-3 pb-1 text-sm text-muted">Le monde de {seed.projet.titre}.</p>
        <PaperSheet>
          <section id="personnages" className="space-y-3">
            <h3 className="font-display text-xl">Personnages</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(seed.personnages || []).map((person) => {
                const image = person.image || (activeProjectId === "original" ? officialImage(person.id) : null);
                return (
                  <article key={person.id} className="rounded-xl border border-paper-line bg-paper">
                    <ReferencePortrait
                      image={image}
                      alt={person.nom || person.id}
                      fallback={(person.nom || person.id).slice(0, 1)}
                      onReplace={() => void chooseImage("personnage", person.id)}
                    />
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
            </div>
            <Button variant="paper" onClick={addPerson}>Ajouter un personnage</Button>
          </section>

          <section id="gardiens" className="mt-8 space-y-3">
            <h3 className="font-display text-xl">Gardiens</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(seed.gardiens || []).map((guardian) => {
                const image = guardian.image || (activeProjectId === "original" ? officialImage(guardian.id) : null);
                return (
                  <article key={guardian.id} className="rounded-xl border border-paper-line bg-paper">
                    <ReferencePortrait
                      image={image}
                      alt={guardian.nom || guardianTitle(guardian.id)}
                      fallback={(guardian.nom || guardianTitle(guardian.id)).slice(0, 1)}
                      onReplace={() => void chooseImage("gardien", guardian.id)}
                    />
                    <div className="space-y-2 p-3">
                      <Field label="Nom">
                        <Input
                          value={guardian.nom || guardianTitle(guardian.id)}
                          onChange={(e) => setEntityField("gardien", guardian.id, "nom", e.target.value)}
                        />
                      </Field>
                      <Field label="Rôle">
                        <Input
                          value={guardian.role || ""}
                          onChange={(e) => setEntityField("gardien", guardian.id, "role", e.target.value)}
                        />
                      </Field>
                      <Field label="Description">
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
            </div>
            {seed.gardiens.length < 2 ? (
              <Button variant="paper" onClick={addGuardian}>Ajouter un gardien</Button>
            ) : null}
          </section>

          <section id="regles" className="mt-8 space-y-3">
            <h3 className="font-display text-xl">Règles</h3>
            {(seed.regles_editoriales || []).length ? (
              (seed.regles_editoriales || []).map((rule) => (
                <article key={rule.id} className="space-y-2 rounded-xl border border-paper-line bg-paper p-3">
                  <Field label="Titre">
                    <Input value={rule.titre} onChange={(e) => setRuleField(rule.id, "titre", e.target.value)} />
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
            <Button variant="paper" className="w-full" onClick={addRule}>
              Ajouter une règle
            </Button>
          </section>
        </PaperSheet>
      </div>
    </AppShell>
  );
}

function ReferencePortrait({
  image,
  alt,
  fallback,
  onReplace,
}: {
  image: string | null;
  alt: string;
  fallback: string;
  onReplace: () => void;
}) {
  return (
    <div className="bg-cream-2 p-3">
      {image ? (
        <CaseImage src={image} alt={alt} className="mx-auto block h-auto max-h-[70vh] w-full object-contain" />
      ) : (
        <div className="grid h-36 place-items-center font-display text-3xl text-accent">{fallback}</div>
      )}
      <Button type="button" variant="paper" size="sm" className="mt-3 w-full rounded-md" onClick={onReplace}>
        Remplacer l’image
      </Button>
    </div>
  );
}
