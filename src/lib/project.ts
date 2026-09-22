import type { Meta, PageStatus, PanelCase, Planche, Seed } from "./types";

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

export function inferPageStatus(p: Planche): PageStatus {
  const hasImage = (p.cases || []).some((c) => Boolean(c.image));
  if (hasImage) return "en_cours";
  return "brouillon";
}

export function progressOf(seed: Seed, meta: Meta) {
  const n = seed.planches.length;
  const done = seed.planches.filter((p) => pageStatusOf(meta, p.id) === "termine").length;
  const wip = seed.planches.filter((p) => pageStatusOf(meta, p.id) === "en_cours").length;
  const drafts = seed.planches.filter((p) => pageStatusOf(meta, p.id) === "brouillon").length;
  const weighted = n
    ? seed.planches.reduce((sum, p) => sum + STATUS_WEIGHT[pageStatusOf(meta, p.id)], 0) / n
    : 0;
  return {
    n,
    done,
    wip,
    drafts,
    pct: Math.round(weighted * 100),
    label: !n
      ? "Aucune planche"
      : done > 0
        ? `${done} / ${n} planches`
        : wip > 0
          ? `${wip} en cours · ${n} planches`
          : `${drafts} brouillons · ${n} planches`,
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
  return seed.planches.flatMap((p) => p.cases).filter((c) => c.image).length;
}