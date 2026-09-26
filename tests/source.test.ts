import assert from "node:assert/strict";
import { test } from "node:test";
import "fake-indexeddb/auto";
import { buildProjectZip, caseAssetPath } from "../src/lib/export-zip";
import { dbPut } from "../src/lib/media";
import { buildPrompt } from "../src/lib/prompt";
import { progressOf } from "../src/lib/project";
import { SEED_OFFICIEL, emptyMeta, parseSeed, normalizeSeed } from "../src/lib/seed";
import { parseSession, createSession } from "../src/lib/session";
import { caseLabel, caseSearchBlob, moveCaseToIndex, storyCases } from "../src/lib/sequence";
import { computeVisualPages } from "../src/lib/visual-layout";

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

test("a moved manuscript number becomes case 1 in the label, prompt and search", () => {
  const seed = normalizeSeed(SEED_OFFICIEL);
  const target = storyCases(seed).find((panel) => panel.id === "P16-2A");
  assert.ok(target);
  assert.equal(moveCaseToIndex(seed, target.id, 0), true);
  const ordered = storyCases(seed);
  assert.equal(ordered[0].id, "P16-2A");
  assert.equal(ordered[0].numero, "2A");
  assert.equal(caseLabel(ordered[0], ordered), "1");
  const prompt = buildPrompt(seed, ordered[0]);
  assert.match(prompt, /Case 1/);
  assert.match(prompt, /Repère d’origine 2A/);
  assert.match(prompt, /ne numérote pas la case/);
  assert.doesNotMatch(prompt, /Case 2A/);
  assert.match(prompt, /Archiviste: absent/);
  assert.match(prompt, /Armurier: absent/);
  const blob = caseSearchBlob(ordered[0], ordered);
  assert.match(blob, /^1\b/);
  assert.equal(blob.includes("2a"), false);
});

test("a new case without a manuscript planche is case 1 and is not exported as p00 or p01", async () => {
  const seed = parseSeed({
    planches: [],
    personnages: [],
    gardiens: [],
    regles_editoriales: [],
    _meta: { statut_canonique: "local" },
    cases: [
      {
        id: "nouvelle-case",
        numero: "25",
        titre: "Sans origine",
        description: "Une case neuve",
        textes: [],
        personnages: [],
      },
    ],
  });
  const panel = storyCases(seed)[0];
  assert.equal(panel.planche_id, undefined);
  assert.equal(panel.gardien_override, undefined);
  assert.equal(panel.numero, "25");
  assert.equal(caseLabel(panel, storyCases(seed)), "1");
  const prompt = buildPrompt(seed, panel);
  assert.match(prompt, /Case 1/);
  assert.match(prompt, /Aucune planche d’origine/);
  assert.match(prompt, /non déclaré sur la case/);
  assert.doesNotMatch(prompt, /Case 25/);
  assert.equal(caseSearchBlob(panel, storyCases(seed)).includes("25"), false);
  const path = caseAssetPath(0, panel.id, "image/png");
  assert.equal(path, "assets/bd/c001-nouvelle-case.png");
  assert.doesNotMatch(path, /p00|p01/);
  panel.image = "idb://img-new";
  await dbPut({ id: "img-new", blob: new Blob(["png"], { type: "image/png" }), mime: "image/png", name: "x.png" });
  const zip = await buildProjectZip(seed, emptyMeta(), {});
  const packed = new TextDecoder().decode(new Uint8Array(await zip.arrayBuffer()));
  assert.match(packed, /assets\/bd\/c001-nouvelle-case\.png/);
  assert.doesNotMatch(packed, /assets\/bd\/p00/);
  assert.doesNotMatch(packed, /assets\/bd\/p01/);
});

test("the first visual planche mixes manuscript origins while numbers stay sequential", () => {
  const seed = normalizeSeed(SEED_OFFICIEL);
  const ordered = storyCases(seed);
  const page = computeVisualPages(seed)[0];
  const origins = new Set(page.items.map((item) => item.c.planche_id));
  assert.ok(origins.size > 1);
  assert.deepEqual(
    page.items.map((item) => caseLabel(item.c, ordered)),
    page.items.map((_, index) => String(index + 1)),
  );
  const first = seed.planches.find((planche) => planche.id === page.items[0].c.planche_id);
  assert.ok(first);
  const other = page.items.find((item) => item.c.planche_id !== first.id);
  assert.ok(other);
  const otherState = structuredClone(other.c.gardien_override);
  first.gardien_etat.archiviste = { present: true, niveau: 5 };
  assert.deepEqual(other.c.gardien_override, otherState);
  const prompt = buildPrompt(seed, other.c);
  assert.match(prompt, /Case \d+/);
  assert.match(prompt, /Archiviste: présent, niveau 0/);
  assert.doesNotMatch(prompt, /présent, niveau 5/);
  assert.doesNotMatch(prompt, new RegExp(`Case ${other.c.numero}\\b`));
});

test("seed.cases is validated and old nested cases still migrate", () => {
  assert.throws(() => parseSeed({ planches: [], cases: "bad" }));
  assert.throws(() => parseSeed({ planches: [], cases: [{ textes: {} }] }));
  assert.equal(storyCases(parseSeed({ planches: [] })).length, 0);
  const before = JSON.stringify(SEED_OFFICIEL);
  const migrated = parseSeed(structuredClone(SEED_OFFICIEL));
  assert.equal(JSON.stringify(SEED_OFFICIEL), before);
  assert.equal(migrated.cases?.length, 152);
  assert.equal(migrated.planches.every((planche) => planche.cases.length === 0), true);
  assert.equal(migrated.cases?.[0].planche_id, migrated.planches[0].id);
  assert.throws(() => parseSeed({ planches: [], cases: [{ titre: "sans id" }] }));
  assert.throws(() => parseSeed({ planches: [], cases: [{ id: "", description: "vide" }] }));
  assert.throws(() => parseSeed({ planches: [], cases: [{ id: "taille", layout_size: { width: 0, height: 1 } }] }));
  assert.throws(() => parseSeed({ planches: [], cases: [{ id: "taille", layout_size: { width: 4, height: 1 } }] }));
  assert.throws(() => parseSeed({ planches: [], cases: [{ id: "taille", layout_size: { width: 2 } }] }));
  const sized = parseSeed({ planches: [], cases: [{ id: "taille", layout_size: { width: 2, height: 2 } }] });
  assert.deepEqual(storyCases(sized)[0].layout_size, { width: 2, height: 2 });
});

test("migrated guardians stay on the case after a move, a planche edit and a restore", async () => {
  const seed = normalizeSeed(SEED_OFFICIEL);
  const origin = storyCases(seed).find((panel) => panel.id === "P13-1");
  assert.ok(origin);
  const frozen = { archiviste: { present: true, niveau: 3 }, armurier: { present: true, niveau: 3 } };
  assert.deepEqual(origin.gardien_override, frozen);
  assert.equal(moveCaseToIndex(seed, origin.id, 0), true);
  assert.equal(storyCases(seed)[0].id, "P13-1");
  assert.deepEqual(storyCases(seed)[0].gardien_override, frozen);
  const planche = seed.planches.find((item) => item.id === "P13");
  assert.ok(planche);
  planche.gardien_etat.archiviste = { present: false, niveau: null };
  planche.gardien_etat.armurier = { present: true, niveau: 1 };
  assert.deepEqual(storyCases(seed)[0].gardien_override, frozen);
  const prompt = buildPrompt(seed, storyCases(seed)[0]);
  assert.match(prompt, /Case 1/);
  assert.match(prompt, /Archiviste: présent, niveau 3/);
  assert.match(prompt, /Armurier: présent, niveau 3/);
  const restored = parseSession(await createSession(seed, emptyMeta(), {}));
  const kept = storyCases(restored.seed).find((panel) => panel.id === "P13-1");
  assert.deepEqual(kept?.gardien_override, frozen);
  assert.equal(caseLabel(kept!, storyCases(restored.seed)), "1");
  delete storyCases(seed)[0].gardien_override?.archiviste;
  const reloaded = normalizeSeed(seed);
  const after = storyCases(reloaded).find((panel) => panel.id === "P13-1");
  assert.equal(after?.gardien_override?.archiviste, undefined);
  assert.deepEqual(after?.gardien_override?.armurier, frozen.armurier);
});

test("a case created after migration does not inherit a manuscript guardian", () => {
  const seed = normalizeSeed(SEED_OFFICIEL);
  seed.cases?.push({
    id: "locale-nouvelle",
    numero: "",
    titre: null,
    type_unite: "case",
    description: "Case ajoutée",
    textes: [],
    personnages: [],
    overlays: [],
    notes: null,
    source_verbatim: null,
    statut: "a_valider",
    image: null,
  });
  const again = normalizeSeed(seed);
  const created = storyCases(again).find((panel) => panel.id === "locale-nouvelle");
  assert.ok(created);
  assert.equal(created.planche_id, undefined);
  assert.equal(created.gardien_override, undefined);
  const prompt = buildPrompt(again, created);
  assert.match(prompt, /Archiviste: non déclaré sur la case/);
  assert.match(prompt, /Armurier: non déclaré sur la case/);
  assert.match(prompt, /Aucune planche d’origine/);
});

test("visual planche stats stay distinct from the manuscript count", () => {
  const seed = normalizeSeed(SEED_OFFICIEL);
  const visual = computeVisualPages(seed).length;
  const progress = progressOf(seed, emptyMeta());
  assert.equal(seed.planches.length, 29);
  assert.equal(visual, 13);
  assert.equal(progress.visual, visual);
  assert.equal(progress.n, visual);
  assert.equal(progress.manuscripts, 29);
  assert.match(progress.label, /152 cases validées/);
  assert.doesNotMatch(progress.label, /13 planches manuscrites/);
});
