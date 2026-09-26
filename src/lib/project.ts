import type { Meta, PageStatus, PanelCase, Planche, Seed } from "./types";
import { casesForPlanche, storyCases } from "./sequence";
import { computeVisualPages } from "./visual-layout";

export const PROJECT_GENRES = "Drame intime · Récit autobiographique · Fantastique social";

export const STATUS_WEIGHT: Record<PageStatus, number> = {
  a_faire: 0,
  brouillon: 0.35,
  en_cours: 0.7,
  termine: 1,
};

export function pageStatusOf(meta: Meta, id: string): PageStatus {
  return meta.statuts[id] || "a_faire";
}

export function shortChapter(name: string | null | undefined) {
  if (!name) return "Sans chapitre";
  return name.replace(/^CHAPITRE\s+\d+\s+[—–-]\s+/i, "");
}

export function caseCaption(c: PanelCase) {
  return {
    title: (c.titre || "").trim(),
    desc: (c.description || "").trim(),
  };
}

export function inferPageStatus(p: Planche, seed?: Seed): PageStatus {
  const linked = seed ? casesForPlanche(seed, p.id) : [];
  const cases = linked.length ? linked : p.cases || [];
  if (cases.some((c) => Boolean(c.image))) return "en_cours";
  return "brouillon";
}

export function progressOf(seed: Seed, _meta: Meta) {
  const manuscripts = seed.planches.length;
  const visual = computeVisualPages(seed).length;
  const cases = storyCases(seed);
  const done = cases.filter((c) => c.statut === "valide").length;
  const wip = cases.filter((c) => c.statut === "en_cours").length;
  const drafts = cases.filter((c) => c.statut === "brouillon").length;
  const weighted = cases.reduce((sum, c) => sum +
    ({ valide: 1, en_cours: 0.7, brouillon: 0.35 }[c.statut] || 0), 0);
  return {
    n: visual, visual, manuscripts, done, wip, drafts,
    pct: cases.length ? Math.round(100 * weighted / cases.length) : 0,
    label: `${done} / ${cases.length} cases validées`,
  };
}

export function chapterProgress(seed: Seed, meta: Meta, chapter: string) {
  const pages = seed.planches.filter((p) => p.chapitre === chapter);
  const n = pages.length;
  const done = pages.filter((p) => pageStatusOf(meta, p.id) === "termine").length;
  const weighted = n
    ? pages.reduce((sum, p) => sum + STATUS_WEIGHT[pageStatusOf(meta, p.id)], 0) / n
    : 0;
  return { n, done, pct: Math.round(weighted * 100), pages };
}

export function importCount(seed: Seed) {
  return storyCases(seed).filter((c) => c.image).length;
}