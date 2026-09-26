import { GUARDIANS, TEXT_TYPES } from "./constants";
import { SEED_OFFICIEL } from "./seed";
import type { CoherenceIssue, GuardianId, PanelCase, Planche, Seed } from "./types";
import { caseLabel, casesForPlanche, storyCases } from "./sequence";

/** Compatibility argument is provenance only; current state belongs to the case. */
export function effectiveGuardian(_planche: Planche, panel: PanelCase, gid: GuardianId) {
  return panel.gardien_override?.[gid];
}

export function choicesFor(seed: Seed, c: PanelCase) {
  return (seed.choix_editoriaux_ouverts || []).filter((choice) => choice.case_id === c.id);
}

export function choiceFor(seed: Seed, _p: Planche, c: PanelCase) {
  return choicesFor(seed, c)[0];
}

export function checkCase(seed: Seed, c: PanelCase): CoherenceIssue[] {
  const out: CoherenceIssue[] = [];
  const ordered = storyCases(seed);
  const label = caseLabel(c, ordered);
  const canonicalPage = SEED_OFFICIEL.planches.find((p) => p.cases.some((x) => x.id === c.id));
  const canonical = canonicalPage?.cases.find((x) => x.id === c.id);
  const add = (level: CoherenceIssue["level"], title: string, text: string) =>
    out.push({ level, title: `Case ${label} : ${title}`, text, caseId: c.id });
  for (const [gid, name] of GUARDIANS) {
    const state = c.gardien_override?.[gid];
    if (!state) {
      if (c.personnages.includes(gid)) add("error", `${name} non déclaré`, "Déclarer sa présence et son niveau sur cette case.");
      continue;
    }
    if (state.present && (!Number.isInteger(state.niveau) || state.niveau! < 0 || state.niveau! > 5))
      add("error", `${name} niveau invalide`, "Choisir un niveau de 0 à 5.");
    if (!state.present && state.niveau != null)
      add("error", `${name} absent avec niveau`, "Un gardien absent doit avoir un niveau nul.");
    if (c.personnages.includes(gid) && !state.present)
      add("error", `${name} incohérent`, "Le gardien apparaît mais son état est absent.");
    const reference = canonical?.gardien_override?.[gid] ?? canonicalPage?.gardien_etat[gid];
    if (reference && JSON.stringify(reference) !== JSON.stringify(state))
      add("warn", `${name} modifié par rapport au seed`, `Repère manuscrit P${canonicalPage!.numero} : ${reference.present ? `niveau ${reference.niveau}` : "absent"}.`);
    if ([15, 19, 24].includes(canonicalPage?.numero || 0) && state.present) {
      const previous = ordered.slice(0, ordered.indexOf(c)).reverse().find((x) =>
        x.planche_id !== c.planche_id && x.gardien_override?.[gid]?.present)?.gardien_override?.[gid];
      if (previous && state.niveau !== previous.niveau! - 1)
        add("warn", `Répit : ${name}`, `La règle prévoit un abaissement d’un cran; précédent niveau présent dans l’ordre actuel : ${previous.niveau}.`);
    }
  }
  for (const choice of choicesFor(seed, c)) {
    if (choice.bloque_generation_du_texte) add("warn", "verbatim absent", choice.regle);
  }
  for (const t of c.textes) {
    if (!TEXT_TYPES.some(([type]) => type === t.type)) add("error", "type de texte inconnu", String(t.type));
    if (t.preserve_exact && !t.contenu) add("error", "texte exact vide", "Le verrou preserve_exact porte sur un contenu vide.");
    const original = canonical?.textes.find((x) => x.id === t.id);
    if (original?.preserve_exact && (original.contenu !== t.contenu || original.type !== t.type || !t.preserve_exact))
      add("error", "verbatim canonique modifié", "Le contenu, le type et le verrou du texte original doivent être préservés.");
  }
  for (const original of canonical?.textes || []) {
    if (original.preserve_exact && !c.textes.some((t) => t.id === original.id))
      add("error", "verbatim canonique manquant", "Un texte verrouillé du manuscrit est absent de cette case.");
  }
  return out;
}

/** Manuscript grouping remains available only for reference checks. */
export function checkPage(seed: Seed, p: Planche): CoherenceIssue[] {
  const cases = casesForPlanche(seed, p.id);
  const issues = cases.flatMap((c) => checkCase(seed, c));
  if (p.id === "P29" && cases.length !== 1)
    issues.push({ level: "error", title: "P29 : composition unique", text: "Les huit souvenirs restent des fragments internes, pas huit cases.", caseId: cases[0]?.id });
  return issues.map((issue) => ({ ...issue, pageId: p.id, pageNumero: p.numero }));
}

export function allIssues(seed: Seed) {
  const issues = storyCases(seed).flatMap((c) => checkCase(seed, c));
  const p29 = seed.planches.find((p) => p.id === "P29");
  if (p29) issues.push(...checkPage(seed, p29).filter((x) => x.title === "P29 : composition unique"));
  return issues;
}

export function pageStatusLabel(status: string) {
  return (
    {
      a_faire: "À faire",
      brouillon: "Brouillon",
      en_cours: "En cours",
      termine: "Terminé",
      a_valider: "À valider",
      valide: "Validée",
    } as Record<string, string>
  )[status] || status;
}