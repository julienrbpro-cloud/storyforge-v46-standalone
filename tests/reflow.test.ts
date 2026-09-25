import assert from "node:assert/strict";
import { test } from "node:test";
import { caseLabel, moveCaseToIndex, storyCases, syncStoryOrder } from "../src/lib/sequence";
import type { PanelCase, Seed } from "../src/lib/types";
import { GRID_CELLS, GRID_COLS, GRID_ROWS, caseSize, reflow } from "../src/lib/visual-layout";

function panel(id: string, width = 1, height = 1): PanelCase {
  return {
    id,
    numero: id,
    titre: id,
    type_unite: "case",
    description: id,
    textes: [],
    personnages: [],
    notes: null,
    source_verbatim: null,
    statut: "a_valider",
    overlays: [],
    layout_size: { width, height },
  };
}

function cellsOf(pages: ReturnType<typeof reflow>) {
  return pages.map((page) => {
    const cells = new Set<string>();
    for (const item of page.items) {
      for (let row = item.row; row < item.row + item.height; row++) {
        for (let col = item.col; col < item.col + item.width; col++) {
          assert.ok(row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS);
          const key = `${row},${col}`;
          assert.equal(cells.has(key), false);
          cells.add(key);
        }
      }
    }
    assert.equal(page.occupied.length, GRID_CELLS);
    assert.equal(cells.size, page.items.reduce((sum, item) => sum + item.width * item.height, 0));
    return cells;
  });
}

test("a 3×4 page holds 12 cells and every case appears once in narrative order", () => {
  assert.equal(GRID_COLS * GRID_ROWS, 12);
  assert.equal(GRID_CELLS, 12);
  const cases = Array.from({ length: 13 }, (_, index) => panel(`c${index + 1}`));
  const pages = reflow(cases);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].items.length, 12);
  assert.equal(pages[1].items.length, 1);
  assert.equal(pages[0].occupied.every(Boolean), true);
  assert.deepEqual(
    pages.flatMap((page) => page.items.map((item) => item.c.id)),
    cases.map((item) => item.id),
  );
  cellsOf(pages);
});

function assertReadingOrder(pages: ReturnType<typeof reflow>) {
  cellsOf(pages);
  for (const page of pages) {
    let cursor = -1;
    for (const item of page.items) {
      const anchor = item.row * GRID_COLS + item.col;
      assert.ok(anchor > cursor);
      cursor = anchor;
    }
  }
}

test("a 2×1 followed by a 2×1 wraps onto the next row of the same page", () => {
  const cases = [panel("a", 2, 1), panel("b", 2, 1)];
  const pages = reflow(cases);
  assert.equal(pages.length, 1);
  assert.deepEqual(
    pages[0].items.map((item) => [item.c.id, item.row, item.col, item.width, item.height]),
    [
      ["a", 0, 0, 2, 1],
      ["b", 1, 0, 2, 1],
    ],
  );
  assert.equal(pages[0].occupied[2], false);
  assertReadingOrder(pages);
});

test("1×1, 2×1 and 3×1 share a page in reading order", () => {
  const cases = [panel("a"), panel("b", 2, 1), panel("c", 3, 1)];
  const pages = reflow(cases);
  assert.equal(pages.length, 1);
  assert.deepEqual(
    pages[0].items.map((item) => [item.c.id, item.row, item.col]),
    [
      ["a", 0, 0],
      ["b", 0, 1],
      ["c", 1, 0],
    ],
  );
  assertReadingOrder(pages);
});

test("a 2×2 after a partial row wraps instead of leaving the page", () => {
  const cases = [panel("a", 2, 1), panel("b", 2, 2)];
  const pages = reflow(cases);
  assert.equal(pages.length, 1);
  assert.deepEqual(
    pages[0].items.map((item) => [item.c.id, item.row, item.col, item.width, item.height]),
    [
      ["a", 0, 0, 2, 1],
      ["b", 1, 0, 2, 2],
    ],
  );
  assertReadingOrder(pages);
});

test("a later small case does not fill a hole already passed", () => {
  const cases = [panel("a", 2, 1), panel("b", 2, 1), panel("c")];
  const pages = reflow(cases);
  assert.equal(pages.length, 1);
  assert.deepEqual(
    pages[0].items.map((item) => [item.c.id, item.row, item.col]),
    [
      ["a", 0, 0],
      ["b", 1, 0],
      ["c", 1, 2],
    ],
  );
  assert.equal(pages[0].occupied[2], false);
  assertReadingOrder(pages);
});

test("a case that fits nowhere ahead moves entirely to the next page", () => {
  const cases = [panel("a"), panel("full", 3, 4), panel("after")];
  const pages = reflow(cases);
  assert.deepEqual(
    pages.map((page) => page.items.map((item) => item.c.id)),
    [["a"], ["full"], ["after"]],
  );
  assert.equal(pages[1].items[0].row, 0);
  assert.equal(pages[1].items[0].col, 0);
  assert.equal(pages[1].items[0].width, 3);
  assert.equal(pages[1].items[0].height, 4);
  const blocked = reflow([panel("top", 3, 2), panel("block", 3, 3)]);
  assert.deepEqual(
    blocked.map((page) => page.items.map((item) => item.c.id)),
    [["top"], ["block"]],
  );
  const alone = reflow([panel("only", 3, 4)]);
  assert.equal(alone.length, 1);
  assert.equal(alone[0].items[0].width, 3);
  assert.equal(alone[0].items[0].height, 4);
  assert.equal(caseSize(panel("too-tall", 3, 9)).height, 4);
  assertReadingOrder(pages);
  assertReadingOrder(blocked);
});

test("growing and shrinking a case reflows the following cases", () => {
  const cases = Array.from({ length: 12 }, (_, index) => panel(`c${index + 1}`));
  assert.equal(reflow(cases).length, 1);
  cases[0].layout_size = { width: 2, height: 2 };
  const grown = reflow(cases);
  assert.equal(grown.length, 2);
  assert.ok(grown[0].items.length < 12);
  assert.equal(grown[0].items[0].c.id, "c1");
  assert.equal(grown.flatMap((page) => page.items).length, 12);
  cases[0].layout_size = { width: 1, height: 1 };
  assert.equal(reflow(cases).length, 1);
  cellsOf(grown);
});

test("moving a case before case 1 keeps its id and renumbers 1…n", () => {
  const cases = [panel("a"), panel("b"), panel("c")];
  const seed = { cases, planches: [], personnages: [], gardiens: [], regles_editoriales: [], choix_editoriaux_ouverts: [], projet: { titre: "t", version: "v" } } as Seed;
  syncStoryOrder(seed);
  assert.equal(moveCaseToIndex(seed, "c", 0), true);
  const ordered = storyCases(seed);
  assert.deepEqual(ordered.map((item) => item.id), ["c", "a", "b"]);
  assert.deepEqual(ordered.map((item) => item.ordre), [1, 2, 3]);
  assert.deepEqual(ordered.map((item) => caseLabel(item, ordered)), ["1", "2", "3"]);
  assert.equal(ordered[0].id, "c");
  assert.equal(ordered[0].titre, "c");
});
