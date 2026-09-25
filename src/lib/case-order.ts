import type { PanelCase, Seed } from "./types";

/** A single story order over stable case IDs. Page arrays hold the existing display projection. */
export function orderedCases(seed: Seed): PanelCase[] {
  const byId = new Map(seed.planches.flatMap((p) => p.cases).map((c) => [c.id, c]));
  return (seed.ordre_cases || []).map((id) => byId.get(id)).filter((c): c is PanelCase => Boolean(c));
}

export function syncCaseOrder(seed: Seed) {
  const cases = seed.planches.flatMap((p) => p.cases);
  const oldPages = new Map(seed.planches.flatMap((p) => p.cases.map((c) => [c.id, p] as const)));
  const byId = new Map(cases.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const ids = [...(seed.ordre_cases || []), ...cases.map((c) => c.id)].filter((id) => {
    if (!byId.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  seed.ordre_cases = ids;
  // The previous page sizes are a temporary pagination projection until the 3×4 engine ships.
  let offset = 0;
  for (const page of seed.planches) {
    const count = page.cases.length;
    page.cases = ids.slice(offset, offset + count).map((id) => byId.get(id)!);
    for (const c of page.cases) {
      const previous = oldPages.get(c.id);
      if (previous && previous !== page) {
        c.gardien_override ||= {};
        for (const gid of ["archiviste", "armurier"] as const) {
          c.gardien_override[gid] ??= { ...previous.gardien_etat[gid] };
        }
      }
    }
    offset += count;
  }
  seed.planches.flatMap((p) => p.cases).forEach((c, i) => {
    if (c.numero_source === undefined && c.numero !== String(i + 1)) c.numero_source = c.numero;
    c.numero = String(i + 1);
  });
}

export function moveCase(seed: Seed, sourceId: string, targetId: string, side: "before" | "after") {
  if (sourceId === targetId) return false;
  const ids = seed.ordre_cases || [];
  const from = ids.indexOf(sourceId);
  if (from < 0 || !ids.includes(targetId)) return false;
  ids.splice(from, 1);
  ids.splice(ids.indexOf(targetId) + (side === "after" ? 1 : 0), 0, sourceId);
  syncCaseOrder(seed);
  return true;
}
