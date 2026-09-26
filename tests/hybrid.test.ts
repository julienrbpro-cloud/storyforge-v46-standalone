import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSeed, parseSeed, SEED_OFFICIEL, emptyMeta } from "../src/lib/seed";
import { migrateProductionNotes, storyCases, moveCaseToIndex } from "../src/lib/sequence";
import { allIssues, choicesFor } from "../src/lib/coherence";
import { buildPrompt } from "../src/lib/prompt";
import { progressOf } from "../src/lib/project";
import { computeVisualPages } from "../src/lib/visual-layout";
import { useStudio } from "../src/lib/store";

// Local tests never use a user's storage.
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });
test.after(() => useStudio.getState().persistNow());

test("an explicit empty sequence cannot resurrect stale nested cases", () => {
  const input = { ...structuredClone(SEED_OFFICIEL), cases: [] };
  const seed = parseSeed(input);
  assert.equal(storyCases(seed).length, 0);
  assert.equal(computeVisualPages(seed).length, 0);
  assert.ok(seed.planches.every((p) => !p.cases.length));
  assert.equal(input.planches[0].cases.length > 0, true);
});

test("Sol provenance, order, media, lettering, and editorial choices migrate once", () => {
  const base = normalizeSeed(SEED_OFFICIEL);
  const original = storyCases(base).find((c) => c.id === "P16-2A")!;
  const incoming = { ...base, _meta: {}, choix_editoriaux_ouverts: structuredClone(SEED_OFFICIEL.choix_editoriaux_ouverts), cases: storyCases(base).map((c) => {
    const { planche_id, ordre, numero, ...content } = c;
    return { ...content, source_planche_id: planche_id, numero_source: numero, numero: String(ordre) };
  }) };
  incoming.cases.reverse();
  incoming.cases[0].image = "idb://stable-media";
  incoming.cases[0].overlays = [{ id: "lettering", type: "speech", content: "Gardé", x: .1, y: .1, width: .3, height: .2, font_size: .04, align: "center" }];
  const seed = parseSeed(incoming);
  assert.deepEqual(seed.cases!.map((c) => c.id), incoming.cases.map((c) => c.id));
  const c = seed.cases!.find((c) => c.id === original.id)!;
  assert.equal(c.planche_id, "P16");
  assert.equal(c.numero, "2A");
  assert.equal(choicesFor(seed, c)[0]?.bloque_generation_du_texte, true);
  assert.equal(seed.cases![0].image, "idb://stable-media");
  assert.equal(seed.cases![0].overlays[0].content, "Gardé");
  assert.ok(!JSON.stringify(seed).includes('"source_planche_id"'));
  assert.ok(!JSON.stringify(seed).includes('"numero_source"'));
  assert.deepEqual(parseSeed(seed), seed);
});

test("legacy ordre_cases is consumed once and cannot compete with the root order", () => {
  const input = { ...structuredClone(SEED_OFFICIEL), ordre_cases: ["P16-2A", "P01-1"] };
  const seed = parseSeed(input);
  assert.equal(seed.cases![0].id, "P16-2A");
  assert.equal(seed.cases!.length, 152);
  assert.ok(!("ordre_cases" in seed));
});

test("new cases have no manuscript origin even when called from a historical page", () => {
  const seed = normalizeSeed(SEED_OFFICIEL);
  useStudio.setState({ seed, meta: emptyMeta(), recoveryRequired: false });
  useStudio.getState().addCase("P16");
  const c = seed.cases!.at(-1)!;
  assert.equal(c.planche_id, undefined);
  assert.equal(c.numero, "");
  assert.equal(c.gardien_override, undefined);
  assert.deepEqual(choicesFor(seed, c), []);
  assert.equal(seed.projet.nombre_planches, computeVisualPages(seed).length);
  assert.match(buildPrompt(seed, c), /Aucune planche d’origine/);
});

test("context and custom editorial blocks follow the case after moving and restoring", () => {
  const seed = parseSeed({
    projet: { titre: "Local", version: "1" },
    planches: [{ id: "old", numero: 7, instructions_planche: "Nuit", date_histoire: "Hier", notes_planche: ["Silence"], cases: [{ id: "stable", numero: "A" }] }],
    choix_editoriaux_ouverts: [{ id: "restriction", planche: 7, case: "A", regle: "Ne pas inventer", bloque_generation_du_texte: true }],
  });
  seed.cases!.push({ ...structuredClone(seed.cases![0]), id: "other", numero: "B" });
  moveCaseToIndex(seed, "stable", 1);
  seed.planches[0].instructions_planche = "Changement de référence";
  seed.planches[0].numero = 99;
  const restored = parseSeed(seed);
  const c = restored.cases![1];
  assert.equal(c.instructions_case, "Nuit");
  assert.deepEqual(c.notes_editoriales, ["Silence"]);
  assert.match(buildPrompt(restored, c), /BLOCAGE ÉDITORIAL OBLIGATOIRE\nNe pas inventer/);
  assert.equal(choicesFor(restored, restored.cases![0]).length, 0);
  assert.match(buildPrompt(restored, c), /Nuit\nSilence/);
});

test("coherence and progress include cases without provenance", () => {
  const seed = parseSeed({ planches: [], cases: [{ id: "new", personnages: ["archiviste"], statut: "valide" }] });
  assert.ok(allIssues(seed).some((issue) => issue.caseId === "new" && issue.level === "error"));
  assert.equal(progressOf(seed, emptyMeta()).pct, 100);
  assert.equal(progressOf(seed, emptyMeta()).n, 1);
  seed.cases![0].gardien_override = { archiviste: { present: true, niveau: 2 } };
  assert.equal(allIssues(seed).length, 0);
});

test("invalid move indices leave the story untouched", () => {
  const seed = normalizeSeed(SEED_OFFICIEL);
  const before = JSON.stringify(seed);
  for (const index of [NaN, Infinity, 1.5]) assert.equal(moveCaseToIndex(seed, seed.cases![4].id, index), false);
  assert.equal(JSON.stringify(seed), before);
});

test("historical production notes migrate without duplicating on reload", () => {
  const seed = normalizeSeed(SEED_OFFICIEL);
  const meta = emptyMeta();
  meta.notes.P01 = "À dessiner";
  seed.cases![0].notes = "Note de case";
  migrateProductionNotes(seed, meta);
  assert.equal(seed.cases![0].notes, "Note de case\n\nÀ dessiner");
  const restored = parseSeed(seed);
  migrateProductionNotes(restored, meta);
  assert.equal(restored.cases![0].notes, seed.cases![0].notes);
});
