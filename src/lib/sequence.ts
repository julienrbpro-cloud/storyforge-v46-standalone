import type { GuardianId, GuardianState, Meta, PanelCase, Planche, Seed } from "./types";

const GUARDIAN_IDS: GuardianId[] = ["archiviste", "armurier"];

/** The persisted story order. Visual planches are not stored here. */
export function storyCases(seed: Seed): PanelCase[] {
  if (Array.isArray(seed.cases)) return seed.cases;
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
  return storyCases(seed).filter((panel) => panel.planche_id === plancheId);
}

/**
 * Move nested planche cases into `seed.cases` once.
 * Manuscript planche id stays metadata. Guardian state is copied onto the case
 * at that moment and is not read from the planche again.
 */
export function migrateSequence(seed: Seed) {
  const incoming = Array.isArray(seed.cases) ? seed.cases.filter((panel) => panel && typeof panel === "object") : [];
  const flattened = !Array.isArray(seed.cases);
  if (flattened) {
    const flat: PanelCase[] = [];
    for (const planche of seed.planches || []) {
      for (const panel of planche.cases || []) {
        if (!panel.planche_id) panel.planche_id = planche.id;
        flat.push(panel);
      }
    }
    const legacyOrder = (seed as Seed & { ordre_cases?: string[] }).ordre_cases;
    if (legacyOrder?.length) {
      const rank = new Map(legacyOrder.map((id, i) => [id, i]));
      flat.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    }
    seed.cases = flat;
  } else {
    seed.cases = incoming;
  }
  // Sol stored provenance under different names and regenerated numero.
  for (const panel of seed.cases || []) {
    const legacy = panel as PanelCase & { source_planche_id?: string; numero_source?: string };
    if (legacy.source_planche_id) {
      if (panel.source_label !== "Case locale" || legacy.numero_source != null)
        panel.planche_id ??= legacy.source_planche_id;
      panel.numero = legacy.numero_source ?? "";
    }
    delete legacy.source_planche_id;
    delete legacy.numero_source;
  }
  delete (seed as Seed & { ordre_cases?: string[] }).ordre_cases;
  if (flattened || seed._meta?.gardiens_sur_cases !== true) {
    for (const panel of seed.cases || []) {
      const origin = (seed.planches || []).find((planche) => planche.id === panel.planche_id);
      copyGuardianState(panel, origin);
    }
    seed._meta = { ...(seed._meta || {}), gardiens_sur_cases: true };
  }
  // Snapshot editorial context once; current case fields never inherit live page data.
  if (seed._meta?.contexte_sur_cases !== true) {
    for (const panel of seed.cases || []) {
      const origin = seed.planches.find((p) => p.id === panel.planche_id);
      if (!origin) continue;
      panel.instructions_case ??= origin.instructions_planche;
      panel.date_histoire ??= origin.date_histoire;
      panel.notes_editoriales ??= [...(origin.notes_planche || [])];
    }
    seed._meta = { ...seed._meta, contexte_sur_cases: true };
  }
  for (const choice of seed.choix_editoriaux_ouverts || []) {
    if (choice.case_id) continue;
    const panel = (seed.cases || []).find((c) => c.numero !== "" &&
      String(c.numero) === String(choice.case) &&
      String(seed.planches.find((p) => p.id === c.planche_id)?.numero) === String(choice.planche));
    if (panel) choice.case_id = panel.id;
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
  if (!Number.isInteger(to)) return false;
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

/** Preserve historical production notes without retaining a live page dependency. */
export function migrateProductionNotes(seed: Seed, meta: Meta) {
  if (seed._meta?.notes_production_sur_cases === true) return;
  for (const c of storyCases(seed)) {
    const note = c.planche_id ? meta.notes[c.planche_id] : undefined;
    if (note) c.notes = [c.notes, note].filter(Boolean).join("\n\n");
  }
  seed._meta = { ...seed._meta, notes_production_sur_cases: true };
}
