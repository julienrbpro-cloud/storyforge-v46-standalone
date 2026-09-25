import { GUARDIANS } from "./constants";
import { SEED_OFFICIEL, typeInfo } from "./seed";
import { choiceFor, effectiveGuardian } from "./coherence";
import { computeVisualPages, visualPageForCase } from "./visual-layout";
import type { PanelCase, Planche, Seed } from "./types";

export function relevantRules(seed: Seed, c: PanelCase) {
  if (seed._meta?.statut_canonique === "local") return seed.regles_editoriales || [];
  const ids = new Set(["PRINCIPE_VISUEL", "R_GLE_DITORIALE_V4_6"]);
  const people = new Set(c.personnages || []);
  if (people.has("archiviste"))
    ["L_ARCHIVISTE_DE_JULIEN", "PROGRESSION_DES_GARDIENS", "CONTINUIT_DES_APPARITIONS", "VOCABULAIRE_VISUEL_FERM"].forEach(
      (x) => ids.add(x),
    );
  if (people.has("armurier"))
    ["L_ARMURIER_DE_SUNNY", "PROGRESSION_DES_GARDIENS", "CONTINUIT_DES_APPARITIONS", "VOCABULAIRE_VISUEL_FERM"].forEach(
      (x) => ids.add(x),
    );
  if (people.has("arlo")) ["ARLO", "LETTRAGE_DES_INTERVENTIONS_D_ARLO"].forEach((x) => ids.add(x));
  if ((c.description || "").toLowerCase().includes("perle")) ids.add("LA_PETITE_PERLE");
  return (seed.regles_editoriales || []).filter((r) =>
    ids.has(r.id) || !SEED_OFFICIEL.regles_editoriales.some((official) => official.id === r.id),
  );
}

export function buildPrompt(seed: Seed, p: Planche, c: PanelCase) {
  const visualPage = visualPageForCase(computeVisualPages(seed), c.id);
  const choice = choiceFor(seed, p, c);
  const states = GUARDIANS.map(([gid, label]) => {
    const s = effectiveGuardian(p, c, gid);
    return `${label}: ${s.present ? "présent, niveau " + s.niveau : "absent"}`;
  }).join("\n");
  const texts =
    (c.textes || [])
      .map(
        (t) =>
          `- [${typeInfo(t.type)[1]}${t.personnage_id ? " · " + t.personnage_id : ""}${t.preserve_exact ? " · VERBATIM EXACT À PRÉSERVER" : ""}] ${t.contenu}`,
      )
      .join("\n") || "- Aucun texte.";
  const refs =
    (c.personnages || [])
      .map((id) => `- ${id}: utiliser sa fiche visuelle officielle intégrée à StoryForge.`)
      .join("\n") || "- Aucun personnage.";
  const rules = relevantRules(seed, c)
    .map((r) => `### ${r.titre}\n${r.contenu}`)
    .join("\n\n");
  return `CRÉATION D’UNE CASE DE BANDE DESSINÉE — ${seed.projet.titre} ${seed.projet.version}

Planche visuelle ${visualPage >= 0 ? visualPage + 1 : "?"}
Case ${c.numero}${c.titre ? " — " + c.titre : ""}

MISE EN IMAGE
${c.description || "[Description volontairement absente]"}

PERSONNAGES ET RÉFÉRENCES
${refs}

ÉTAT EFFECTIF DES GARDIENS
${states}

TEXTES À INTÉGRER
${texts}
${choice?.bloque_generation_du_texte ? `\nBLOCAGE ÉDITORIAL OBLIGATOIRE\n${choice.regle}` : ""}

RÈGLES PERTINENTES
${rules}

CONTRAINTE DE SORTIE
Respecter exactement la composition décrite, les apparences officielles, les textes verrouillés et les absences déclarées. Ne pas ajouter de narration redondante, de symbole, de gardien, d’esprit, d’objet ou de dialogue non autorisé.`;
}
