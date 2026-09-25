import type { GuardianId, GuardianState, PanelCase, Planche, Seed } from "./types";

const GUARDIAN_IDS: GuardianId[] = ["archiviste", "armurier"];

/** The persisted story order. Visual planches are not stored here. */
export function storyCases(seed: Seed): PanelCase[] {
  if (Array.isArray(seed.cases) && seed.cases.length) return seed.cases;
  const cases: PanelCase[] = [];
  for (const planche of seed.planches || []) {
    for (const panel of planche.cases || []) cases.push(panel);
  }
  return cases;
}

/** Visible number is the 1-based index. `numero` stays the manuscript label. */
export function caseLabel(panel: Pick<PanelCase, "id" | "ordre" | "numero">, cases?: PanelCase[]) {
  if (cases) {
    const index = cases.findIndex((item) => item.id === panel.id);
    if (index >= 0) return String(index + 1);
  }
  if (panel.ordre) return String(panel.ordre);
  return "?";
}

/** Search index for a case. Visible position only — not the manuscript number. */
export function caseSearchBlob(panel: PanelCase, cases: PanelCase[]) {
  return [caseLabel(panel, cases), panel.titre, panel.description, ...(panel.textes || []).map((text) => text.contenu)]
    .filter((part) => part)
    .join(" ")
    .toLowerCase();
}

export function syncStoryOrder(seed: Seed) {
  (seed.cases || []).forEach((panel, index) => {
    panel.ordre = index + 1;
  });
}

/** Cases whose manuscript origin is this planche. Not a visual page. */
export function casesForPlanche(seed: Seed, plancheId: string) {
  const tagged = storyCases(seed).filter((panel) => panel.planche_id === plancheId);
  if (tagged.length) return tagged;
  return seed.planches.find((planche) => planche.id === plancheId)?.cases || [];
}

/**
 * Move nested planche cases into `seed.cases` once.
 * Manuscript planche id stays metadata. Guardian state is copied onto the case
 * at that moment and is not read from the planche again.
 */
export function migrateSequence(seed: Seed) {
  const incoming = Array.isArray(seed.cases) ? seed.cases.filter((panel) => panel && typeof panel === "object") : [];
  const flattened = !incoming.length;
  if (flattened) {
    const flat: PanelCase[] = [];
    for (const planche of seed.planches || []) {
      for (const panel of planche.cases || []) {
        if (!panel.planche_id) panel.planche_id = planche.id;
        flat.push(panel);
      }
    }
    seed.cases = flat;
  } else {
    seed.cases = incoming;
  }
  if (flattened || seed._meta?.gardiens_sur_cases !== true) {
    for (const panel of seed.cases || []) {
      const origin = (seed.planches || []).find((planche) => planche.id === panel.planche_id);
      copyGuardianState(panel, origin);
    }
    seed._meta = { ...(seed._meta || {}), gardiens_sur_cases: true };
  }
  for (const planche of seed.planches || []) planche.cases = [];
  for (const panel of seed.cases || []) {
    const loose = panel as PanelCase & { row?: unknown; col?: unknown };
    delete loose.row;
    delete loose.col;
  }
  syncStoryOrder(seed);
}

/** Snapshot of the origin planche. Existing case values win; missing keys are not a live link. */
function copyGuardianState(panel: PanelCase, planche: Planche | undefined) {
  if (!planche?.gardien_etat) return;
  panel.gardien_override ||= {};
  for (const gid of GUARDIAN_IDS) {
    if (panel.gardien_override[gid] != null) continue;
    const state = planche.gardien_etat[gid];
    if (!state) continue;
    panel.gardien_override[gid] = cloneGuardian(state);
  }
}

function cloneGuardian(state: GuardianState): GuardianState {
  return {
    present: !!state.present,
    niveau: state.present ? (state.niveau ?? null) : null,
  };
}

function relocate(cases: PanelCase[], from: number, to: number) {
  const target = Math.max(0, Math.min(to, cases.length - 1));
  if (from < 0 || target === from) return false;
  const [panel] = cases.splice(from, 1);
  cases.splice(target, 0, panel);
  return true;
}

export function moveCaseToIndex(seed: Seed, caseId: string, index: number) {
  const cases = seed.cases || [];
  const from = cases.findIndex((panel) => panel.id === caseId);
  if (!relocate(cases, from, index)) return false;
  syncStoryOrder(seed);
  return true;
}

export function moveCaseRelative(
  seed: Seed,
  caseId: string,
  anchorId: string,
  place: "before" | "after",
) {
  if (!caseId || !anchorId || caseId === anchorId) return false;
  const cases = seed.cases || [];
  const from = cases.findIndex((panel) => panel.id === caseId);
  const anchor = cases.findIndex((panel) => panel.id === anchorId);
  if (from < 0 || anchor < 0) return false;
  let target = place === "before" ? anchor : anchor + 1;
  if (from < target) target -= 1;
  return moveCaseToIndex(seed, caseId, target);
}

export function moveCaseBy(seed: Seed, caseId: string, dir: -1 | 1) {
  const cases = seed.cases || [];
  const from = cases.findIndex((panel) => panel.id === caseId);
  return moveCaseToIndex(seed, caseId, from + dir);
}
