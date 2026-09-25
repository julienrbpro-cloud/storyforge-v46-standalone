import type { PanelCase, Seed } from "./types";

/** The root array is the only ordering authority. Legacy page groups are reference metadata. */
export function orderedCases(seed: Seed): PanelCase[] {
  return seed.cases || [];
}

export function renumberCases(seed: Seed) {
  orderedCases(seed).forEach((c, index) => { c.numero = String(index + 1); });
}

export function attachSourceGroups(seed: Seed) {
  for (const p of seed.planches) p.cases = [];
  for (const c of orderedCases(seed)) {
    const source = seed.planches.find((p) => p.id === c.source_planche_id);
    source?.cases.push(c);
  }
  renumberCases(seed);
}

export function moveCase(seed: Seed, sourceId: string, targetId: string, side: "before" | "after") {
  if (sourceId === targetId) return false;
  const cases = orderedCases(seed);
  const from = cases.findIndex((c) => c.id === sourceId);
  if (from < 0 || !cases.some((c) => c.id === targetId)) return false;
  const [moved] = cases.splice(from, 1);
  const target = cases.findIndex((c) => c.id === targetId);
  cases.splice(target + (side === "after" ? 1 : 0), 0, moved);
  renumberCases(seed);
  return true;
}

/** Persist root cases once. Page groups are reconstructed by source IDs on load. */
export function persistedSeed(seed: Seed): Seed {
  const copy = structuredClone(seed);
  copy.planches = copy.planches.map((p) => ({ ...p, cases: [] }));
  copy.cases = orderedCases(copy).map((c) => {
    const { numero: _derived, ...content } = c;
    void _derived;
    return content as PanelCase;
  });
  delete copy.ordre_cases;
  return copy;
}
