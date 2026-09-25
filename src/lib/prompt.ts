import { GUARDIANS } from "./constants";
import { SEED_OFFICIEL, typeInfo } from "./seed";
import { choiceFor } from "./coherence";
import { caseLabel, storyCases } from "./sequence";
import type { GuardianId, PanelCase, Seed } from "./types";
import { visualPageIndexOf } from "./visual-layout";

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

function declaredGuardian(c: PanelCase, gid: GuardianId) {
  const state = c.gardien_override?.[gid];
  if (!state) return "non déclaré sur la case";
  return state.present ? "présent, niveau " + state.niveau : "absent";
}

/** Visible number and visual page come from `seed.cases`. Provenance stays metadata. */
export function buildPrompt(seed: Seed, c: PanelCase) {
  const ordered = storyCases(seed);
  const visible = caseLabel(c, ordered);
  const visualPage = visualPageIndexOf(ordered, c.id) + 1;
  const canonical = SEED_OFFICIEL.planches.find((page) => page.cases.some((panel) => panel.id === c.id));
  const choice = canonical ? choiceFor(seed, canonical, c) : undefined;
  const origin = c.planche_id ? seed.planches.find((page) => page.id === c.planche_id) : undefined;
  const states = GUARDIANS.map(([gid, label]) => `${label}: ${declaredGuardian(c, gid)}`).join("\n");
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
  const provenance = origin
    ? `Planche manuscrite ${origin.numero} — ${origin.titre}. Repère d’origine ${c.numero}. Cette provenance ne numérote pas la case.`
    : "Aucune planche d’origine.";
  return `CRÉATION D’UNE CASE DE BANDE DESSINÉE — ${seed.projet.titre} ${seed.projet.version}

Planche visuelle ${visualPage}
Case ${visible}${c.titre ? " — " + c.titre : ""}

PROVENANCE CANONIQUE
${provenance}

MISE EN IMAGE
${c.description || "[Description volontairement absente]"}

PERSONNAGES ET RÉFÉRENCES
${refs}

ÉTAT DE LA CASE
${states}

TEXTES À INTÉGRER
${texts}
${choice?.bloque_generation_du_texte ? `\nBLOCAGE ÉDITORIAL OBLIGATOIRE\n${choice.regle}` : ""}

RÈGLES PERTINENTES
${rules}

CONTRAINTE DE SORTIE
Respecter exactement la composition décrite, les apparences officielles, les textes verrouillés et les absences déclarées. Ne pas ajouter de narration redondante, de symbole, de gardien, d’esprit, d’objet ou de dialogue non autorisé.`;
}
