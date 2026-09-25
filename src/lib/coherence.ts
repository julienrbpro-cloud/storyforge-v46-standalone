import { GUARDIANS, TEXT_TYPES } from "./constants";
import { SEED_OFFICIEL } from "./seed";
import type { CoherenceIssue, GuardianId, PanelCase, Planche, Seed } from "./types";
import { casesForPlanche } from "./sequence";

/** Current guardians live on the case. The planche argument is provenance only. */
export function effectiveGuardian(_planche: Planche, panel: PanelCase, gid: GuardianId) {
  return panel.gardien_override?.[gid] || { present: false, niveau: null };
}

export function choiceFor(seed: Seed, p: Planche, c: PanelCase) {
  const canonical = SEED_OFFICIEL.planches.find((page) => page.id === p.id);
  const canonicalCase = canonical?.cases.find((panel) => panel.id === c.id);
  return (
    (seed.choix_editoriaux_ouverts || []).find(
      (x) => String(x.planche) === String(canonical?.numero ?? p.numero) && String(x.case) === String(canonicalCase?.numero ?? c.numero),
    ) ||
    (seed.choix_editoriaux_ouverts || []).find(
      (x) => c.id?.includes("P16-2A") && x.id === "P16-C2A-VERBATIM",
    )
  );
}

export function checkPage(seed: Seed, p: Planche): CoherenceIssue[] {
  const out: CoherenceIssue[] = [];
  const cases = casesForPlanche(seed, p.id);
  const canonical = SEED_OFFICIEL.planches.find((x) => x.id === p.id);
  for (const [gid, label] of GUARDIANS) {
    const s = p.gardien_etat?.[gid];
    const appear = cases.some((c) => (c.personnages || []).includes(gid));
    if (!s) out.push({ level: "error", title: `${label} : état manquant`, text: "Présence et niveau doivent être déclarés." });
    else if (s.present && (!Number.isInteger(s.niveau) || (s.niveau ?? -1) < 0 || (s.niveau ?? 9) > 5))
      out.push({ level: "error", title: `${label} : niveau invalide`, text: "Choisir un niveau de 0 à 5." });
    else if (!s.present && s.niveau != null)
      out.push({ level: "error", title: `${label} absent avec niveau`, text: "Un gardien absent doit avoir un niveau nul." });
    if (s?.present && !appear)
      out.push({ level: "warn", title: `${label} déclaré présent`, text: "Aucune case de la planche ne contient ce gardien." });
    if (!s?.present && cases.some((c) => c.personnages.includes(gid) && !effectiveGuardian(p, c, gid).present))
      out.push({ level: "error", title: `${label} déclaré absent`, text: "Au moins une case contient pourtant ce gardien." });
    const cs = canonical?.gardien_etat?.[gid];
    if (cs && JSON.stringify(cs) !== JSON.stringify(s))
      out.push({
        level: "warn",
        title: `${label} modifié par rapport au seed`,
        text: `Canonique : ${cs.present ? "présent niveau " + cs.niveau : "absent"}.`,
      });
    for (const c of cases) {
      const e = effectiveGuardian(p, c, gid);
      if (e.present && (!Number.isInteger(e.niveau) || (e.niveau ?? -1) < 0 || (e.niveau ?? 9) > 5))
        out.push({ level: "error", title: `Case ${c.numero} : ${label} niveau invalide`, text: "Choisir un niveau de 0 à 5." });
      if ((c.personnages || []).includes(gid) && !e.present)
        out.push({
          level: "error",
          title: `Case ${c.numero} : ${label} incohérent`,
          text: "Le gardien apparaît mais son état effectif est absent.",
        });
    }
  }
  for (const c of cases) {
    const choice = choiceFor(seed, p, c);
    if (choice?.bloque_generation_du_texte)
      out.push({ level: "warn", title: `Case ${c.numero} : verbatim absent`, text: choice.regle });
    for (const t of c.textes || []) {
      if (!TEXT_TYPES.some((x) => x[0] === t.type))
        out.push({ level: "error", title: `Case ${c.numero} : type de texte inconnu`, text: String(t.type) });
      if (t.preserve_exact && !t.contenu)
        out.push({
          level: "error",
          title: `Case ${c.numero} : texte exact vide`,
          text: "Le verrou preserve_exact porte sur un contenu vide.",
        });
    }
  }
  const n = Number(canonical?.numero ?? p.numero);
  if ([15, 19, 24].includes(n)) {
    const idx = seed.planches.indexOf(p);
    for (const [gid, label] of GUARDIANS) {
      const s = p.gardien_etat?.[gid];
      if (!s?.present) continue;
      let prev = null as { present: boolean; niveau: number | null } | null;
      for (let i = idx - 1; i >= 0; i--) {
        const x = seed.planches[i].gardien_etat?.[gid];
        if (x?.present) {
          prev = x;
          break;
        }
      }
      if (prev && s.niveau !== (prev.niveau ?? 0) - 1)
        out.push({
          level: "warn",
          title: `Répit P${n} : ${label}`,
          text: `La règle prévoit un abaissement d’un cran; précédent niveau présent : ${prev.niveau}.`,
        });
    }
  }
  if (p.id === "P22" && GUARDIANS.some(([g]) => p.gardien_etat?.[g]?.niveau !== 5))
    out.push({ level: "warn", title: "P22 : rupture", text: "La référence canonique place les deux gardiens au niveau 5." });
  if (p.id === "P29" && GUARDIANS.some(([g]) => p.gardien_etat?.[g]?.niveau !== 1))
    out.push({
      level: "warn",
      title: "P29 : retour proportionné",
      text: "La référence canonique ramène les deux gardiens au niveau 1.",
    });
  if (p.id === "P21") {
    const letter = cases
      .flatMap((c) => c.textes || [])
      .find((t) => (t.contenu || "").includes("Je ne me reconnais plus dans ce miroir."));
    if (letter && letter.type !== "lettre")
      out.push({ level: "error", title: "P21 : type de la lettre", text: "Le texte exact doit rester de type lettre." });
  }
  if (p.id === "P29" && cases.length !== 1)
    out.push({
      level: "error",
      title: "P29 : composition unique",
      text: "Les huit souvenirs restent des fragments internes, pas huit cases.",
    });
  return out.map((x) => ({ ...x, pageId: p.id, pageNumero: p.numero }));
}

export function allIssues(seed: Seed) {
  return seed.planches.flatMap((p) => checkPage(seed, p));
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