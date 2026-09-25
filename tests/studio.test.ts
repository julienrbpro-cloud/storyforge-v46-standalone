import assert from "node:assert/strict";
import { test } from "node:test";
import "fake-indexeddb/auto";
import { SEED_OFFICIEL, normalizeSeed, parseSeed, normalizeMeta, emptyMeta } from "../src/lib/seed";
import { useStudio } from "../src/lib/store";
import { dataUrlToBlob, dbAll, dbPut, dbReplace, openDB } from "../src/lib/media";
import { LS_MEDIA_META, LS_META, LS_PROJECTS, LS_SEED } from "../src/lib/constants";
import { parseSession, createSession } from "../src/lib/session";
import { computeVisualPages } from "../src/lib/visual-layout";
import { orderedCases, persistedSeed } from "../src/lib/case-order";
import { checkPage, choiceFor, effectiveGuardian } from "../src/lib/coherence";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});
Object.defineProperty(globalThis, "FileReader", {
  value: class {
    result = "";
    onload?: () => void;
    onerror?: (error: unknown) => void;
    readAsDataURL(blob: Blob) {
      void blob
        .arrayBuffer()
        .then((buffer) => {
          this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
          this.onload?.();
        })
        .catch((error) => this.onerror?.(error));
    }
  },
});
const before = JSON.stringify(SEED_OFFICIEL);
function fresh() {
  const seed = normalizeSeed(SEED_OFFICIEL);
  useStudio.setState({ seed, meta: emptyMeta(), mediaMeta: {}, selectedCaseId: null });
  return useStudio.getState();
}

test("edits and reset never mutate the official seed or an import object", () => {
  const s = fresh();
  const p = s.seed.planches[0],
    c = p.cases[0];
  s.setCaseField(p.id, c.id, "description", "Changed");
  assert.equal(JSON.stringify(SEED_OFFICIEL), before);
  s.resetWorkingSeed();
  assert.equal(
    useStudio.getState().seed.planches[0].cases[0].description,
    SEED_OFFICIEL.planches[0].cases[0].description,
  );
  const input = structuredClone(SEED_OFFICIEL);
  normalizeSeed(input).planches[0].titre = "Changed";
  assert.notEqual(input.planches[0].titre, "Changed");
});

test("imports accept canonical, wrapped and empty projects and reject malformed or duplicate IDs", () => {
  assert.equal(parseSeed(SEED_OFFICIEL).planches.length, 29);
  assert.equal(parseSeed({ seed: SEED_OFFICIEL }).planches.length, 29);
  assert.equal(parseSeed({ planches: [] }).planches.length, 0);
  for (const input of [
    {},
    { planches: [{}] },
    { planches: [{ cases: "bad" }] },
    { planches: [{ cases: [{ textes: {} }] }] },
  ]) {
    assert.throws(() => parseSeed(input));
  }
  const seed = normalizeSeed(SEED_OFFICIEL);
  seed.planches[1].cases[0].id = seed.planches[0].cases[0].id;
  assert.throws(() => parseSeed(seed), /dupliqué/);
});

test("import clears stale filters, notes and selected case; invalid input preserves current project", () => {
  const s = fresh();
  s.setFilter("q", "nothing");
  s.setPageNote("P01", "old note");
  s.setSelectedCase("P01-1");
  s.importSeedJson({ planches: [] });
  assert.deepEqual(useStudio.getState().meta, emptyMeta());
  assert.equal(useStudio.getState().selectedCaseId, null);
  assert.throws(() => s.importSeedJson({ unexpected: true }));
  assert.equal(useStudio.getState().seed.planches.length, 0);
});

test("metadata sanitization prevents invalid progress and filters", () => {
  assert.deepEqual(
    normalizeMeta({ statuts: { a: "bad", b: "termine" }, notes: { a: null }, filters: { q: 12 } }),
    { ...emptyMeta(), statuts: { b: "termine" } },
  );
});

test("locked text cannot be edited, removed, or moved indirectly", () => {
  const s = fresh();
  const p = s.seed.planches.find((p) =>
    p.cases.some((c) => c.textes.some((t) => t.preserve_exact)),
  )!;
  const c = p.cases.find((c) => c.textes.some((t) => t.preserve_exact))!;
  const t = c.textes.find((t) => t.preserve_exact)!;
  const original = structuredClone(c.textes);
  s.setTextField(p.id, c.id, t.id, "contenu", "wrong");
  s.setTextField(p.id, c.id, t.id, "preserve_exact", false);
  s.removeText(p.id, c.id, t.id);
  s.moveText(p.id, c.id, c.textes.indexOf(t), -1);
  assert.deepEqual(c.textes, original);
});

test("detaching or deleting a text source preserves visible lettering", () => {
  const s = fresh(),
    p = s.seed.planches[0],
    c = p.cases[1];
  s.addOverlay(p.id, c.id, "speech");
  const o = c.overlays[0],
    text = c.textes[0].contenu;
  s.setOverlayTextRef(p.id, c.id, o.id, "");
  assert.equal(o.content, text);
  s.setOverlayTextRef(p.id, c.id, o.id, c.textes[0].id);
  s.removeText(p.id, c.id, c.textes[0].id);
  assert.equal(o.content, text);
  assert.equal(o.text_ref, undefined);
});

test("legacy cases migrate once into a persisted global sequence without losing data", () => {
  const legacy = structuredClone(SEED_OFFICIEL);
  const original = structuredClone(legacy.planches[0].cases[0]);
  const seed = parseSeed(legacy);
  assert.equal(orderedCases(seed).length, 152);
  const migrated = orderedCases(seed)[0];
  assert.equal(migrated.id, original.id);
  assert.deepEqual(migrated.textes, original.textes);
  assert.equal(migrated.description, original.description);
  assert.equal(migrated.source_planche_id, "P01");
  assert.equal(migrated.image, original.image?.replace(/^\./, "") ?? null);
});

test("global move before Case 1 keeps stable ID, full content, source guardian and numbering", () => {
  const s = fresh();
  const first = orderedCases(s.seed)[0];
  const lastPage = s.seed.planches.at(-1)!;
  const moved = lastPage.cases[0];
  const snapshot = structuredClone(moved);
  const guardianBefore = effectiveGuardian(lastPage, moved, "armurier");
  assert.equal(s.moveCase(moved.id, first.id, "before"), true);
  const seed = useStudio.getState().seed;
  assert.equal(orderedCases(seed)[0].id, moved.id);
  assert.deepEqual(orderedCases(seed)[0], { ...snapshot, numero: "1" });
  assert.deepEqual(orderedCases(seed).map((c) => Number(c.numero)), Array.from({ length: 152 }, (_, i) => i + 1));
  assert.deepEqual(effectiveGuardian(lastPage, orderedCases(seed)[0], "armurier"), guardianBefore);
  const persisted = persistedSeed(seed);
  assert.equal(persisted.planches.every((p) => p.cases.length === 0), true);
  assert.equal(persisted.cases?.[0].id, moved.id);
  assert.equal(Object.hasOwn(persisted.cases?.[0] || {}, "numero"), false);
  assert.equal(parseSeed(JSON.parse(JSON.stringify(persisted))).cases?.[0].id, moved.id);
});

test("a new large case can move ahead of Case 1 and survive a session round trip", async () => {
  const s = fresh();
  const first = orderedCases(s.seed)[0];
  const page = s.seed.planches[1];
  s.addCase(page.id);
  const id = useStudio.getState().selectedCaseId!;
  s.setCaseField(page.id, id, "description", "Une nouvelle scène");
  s.setCaseSize(page.id, id, "width", 3);
  s.setCaseSize(page.id, id, "height", 4);
  assert.equal(s.moveCase(id, first.id, "before"), true);
  const moved = orderedCases(useStudio.getState().seed)[0];
  assert.equal(moved.id, id);
  assert.equal(moved.numero, "1");
  assert.deepEqual(moved.layout_size, { width: 3, height: 4 });
  const backup = await createSession(useStudio.getState().seed, useStudio.getState().meta, {});
  const restored = parseSession(backup).seed;
  assert.equal(restored.cases?.[0].id, id);
  assert.equal(restored.cases?.[0].description, "Une nouvelle scène");
  assert.equal(computeVisualPages(restored)[0].items[0].c.id, id);
});

test("backup round trip preserves images, text, notes, status and restores actual binary data", async () => {
  const s = fresh(),
    p = s.seed.planches[0],
    c = p.cases[0];
  await dbReplace([]);
  await s.replaceCaseImage(c.id, new File(["image-bytes"], "proof.png", { type: "image/png" }));
  s.setPageNote(p.id, "Production note");
  s.cyclePageStatus(p.id);
  const backup = await createSession(s.seed, useStudio.getState().meta, {});
  await dbReplace([]);
  fresh();
  await useStudio.getState().importSessionJson(backup);
  const state = useStudio.getState(),
    records = await dbAll();
  assert.equal(state.meta.notes[p.id], "Production note");
  assert.equal(state.meta.statuts[p.id], "brouillon");
  assert.equal(await records[0].blob.text(), "image-bytes");
  assert.equal(state.seed.planches[0].cases[0].image, `idb://${records[0].id}`);
});

test("restoring one project preserves the other project's images and excludes them from its backup", async () => {
  const s = fresh();
  const other = normalizeSeed(SEED_OFFICIEL);
  s.seed.planches[0].cases[0].image = "idb://current-photo";
  other.planches[0].cases[0].image = "idb://other-photo";
  const previousArchive = storage.get(LS_PROJECTS);
  storage.set(LS_PROJECTS, JSON.stringify({ activeId: "original", projects: [
    { id: "original", seed: s.seed, meta: s.meta, mediaMeta: {} },
    { id: "other", seed: other, meta: emptyMeta(), mediaMeta: {} },
  ] }));
  try {
    await dbReplace([
      { id: "current-photo", blob: new Blob(["current"], { type: "image/png" }) },
      { id: "other-photo", blob: new Blob(["other"], { type: "image/png" }) },
    ]);
    const backup = await createSession(s.seed, s.meta, {});
    assert.deepEqual(backup.media.map((record) => record.id), ["current-photo"]);
    await s.importSessionJson(backup);
    assert.deepEqual((await dbAll()).map((record) => record.id).sort(), ["current-photo", "other-photo"]);
  } finally {
    if (previousArchive == null) storage.delete(LS_PROJECTS);
    else storage.set(LS_PROJECTS, previousArchive);
  }
});

test("invalid and incomplete backups never clear existing images or manuscript", async () => {
  const previous = useStudio.getState().seed;
  const records = await dbAll();
  for (const input of [
    {},
    { seed: { planches: [{}] } },
    { seed: previous },
    { seed: previous, media: [{ id: "bad", data: "corrupt" }] },
  ]) {
    await assert.rejects(useStudio.getState().importSessionJson(input));
    assert.equal(useStudio.getState().seed, previous);
    assert.equal((await dbAll()).length, records.length);
  }
});

test("backup media accepts only non-empty image data URLs", () => {
  const valid = dataUrlToBlob("data:image/png;base64,eA==");
  assert.equal(valid.type, "image/png");
  assert.equal(valid.size, 1);
  for (const data of [
    "data:text/plain;base64,eA==",
    "data:image/png;base64,",
    "data:image/png;base64,%%%%",
  ]) {
    assert.throws(
      () => parseSession({ seed: SEED_OFFICIEL, media: [{ id: "bad", data }] }),
      /Image de sauvegarde invalide/,
    );
  }
});

test("failed media restore puts back the exact raw localStorage bytes", async () => {
  const s = fresh();
  const savedStorage = new Map(storage);
  const db = await openDB();
  try {
    localStorage.setItem(LS_SEED, "{invalid-json");
    localStorage.setItem(LS_META, "raw-meta-not-json");
    localStorage.setItem(LS_MEDIA_META, "raw-media-not-json");
    Object.defineProperty(db, "transaction", {
      configurable: true,
      value: () => {
        throw new Error("forced media failure");
      },
    });
    await assert.rejects(
      s.importSessionJson({ seed: SEED_OFFICIEL, media: [] }),
      /forced media failure/,
    );
    assert.equal(localStorage.getItem(LS_SEED), "{invalid-json");
    assert.equal(localStorage.getItem(LS_META), "raw-meta-not-json");
    assert.equal(localStorage.getItem(LS_MEDIA_META), "raw-media-not-json");
  } finally {
    Reflect.deleteProperty(db, "transaction");
    storage.clear();
    for (const [key, value] of savedStorage) storage.set(key, value);
  }
});

test("legacy images migrate into persistent media records", () => {
  const restored = parseSession({
    seed: SEED_OFFICIEL,
    images: { "P01-1": "data:image/png;base64,eA==" },
  });
  assert.equal(restored.seed.planches[0].cases[0].image, "idb://legacy-P01-1");
  assert.equal(restored.records[0].blob.size, 1);
});

test("failed media transaction rolls back deletion", async () => {
  await dbPut({ id: "keep", blob: new Blob(["keep"]) });
  await assert.rejects(dbReplace([{ blob: new Blob(["bad"]) } as any]));
  assert.ok((await dbAll()).some((r) => r.id === "keep"));
});

test.after(() => useStudio.getState().persistNow());

test("case guardian overrides do not produce a false absent-page error", () => {
  const s = fresh(),
    p = s.seed.planches[0],
    c = p.cases[0];
  s.toggleCasePerson(p.id, c.id, "archiviste", true);
  s.setCaseGuardian(p.id, c.id, "archiviste", "2");
  assert.ok(
    !checkPage(s.seed, p).some((i) => i.level === "error" && i.title.includes("Archiviste")),
  );
});

test("editorial restrictions follow original case identity after page reordering", () => {
  const s = fresh(),
    p = s.seed.planches.find((p) => p.id === "P16")!;
  const c = p.cases.find((c) => c.numero_source === "2A")!;
  s.movePage(p.id, 1);
  assert.equal(choiceFor(s.seed, p, c)?.bloque_generation_du_texte, true);
});

test("storage quota failure refuses restore without touching existing media", async () => {
  const s = fresh();
  await dbReplace([{ id: "existing", blob: new Blob(["existing"]) }]);
  const setItem = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  try {
    await assert.rejects(s.importSessionJson({ seed: SEED_OFFICIEL, media: [] }), /Quota/);
    assert.equal((await dbAll())[0].id, "existing");
    assert.equal(useStudio.getState().seed, s.seed);
  } finally {
    localStorage.setItem = setItem;
  }
});

test("boot never overwrites corrupt local data through autosave", () => {
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  try {
    localStorage.setItem("sf46-seed", "{invalid-json");
    useStudio.setState({ ready: false });
    useStudio.getState().boot();
    assert.equal(useStudio.getState().recoveryRequired, true);
    useStudio.getState().setFilter("chapitre", "");
    useStudio.getState().persistNow();
    assert.equal(localStorage.getItem("sf46-seed"), "{invalid-json");
    useStudio.getState().importSeedJson(SEED_OFFICIEL);
    useStudio.getState().persistNow();
    assert.equal(useStudio.getState().saveState, "saved");
  } finally { delete (globalThis as { window?: unknown }).window; }
});
