import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_OFFICIEL, normalizeSeed } from "../src/lib/seed";
import { moveCase, orderedCases } from "../src/lib/case-order";
import { computeVisualPages, GRID_CELLS, GRID_COLUMNS, GRID_ROWS, visualPageForCase } from "../src/lib/visual-layout";
import type { Seed } from "../src/lib/types";

function story(sizes: Array<[number, number]>): Seed {
  const seed = normalizeSeed({ ...structuredClone(SEED_OFFICIEL), planches: [], cases: [] });
  seed.cases = sizes.map(([width, height], i) => ({
    ...structuredClone(SEED_OFFICIEL.planches[0].cases[0]),
    id: `test-${i + 1}`, numero: String(i + 1), source_planche_id: "source",
    layout_size: { width, height },
  }));
  return seed;
}

function verify(seed: Seed) {
  const pages = computeVisualPages(seed);
  assert.equal(GRID_COLUMNS, 3);
  assert.equal(GRID_ROWS, 4);
  assert.equal(GRID_CELLS, 12);
  assert.deepEqual(pages.flatMap((p) => p.items.map((item) => item.c.id)), orderedCases(seed).map((c) => c.id));
  for (const page of pages) {
    assert.equal(page.occupied.length, 12);
    const cells = new Set<number>();
    for (const { row, col, width, height } of page.items)
      for (let r = row; r < row + height; r++)
        for (let c = col; c < col + width; c++) {
          assert.ok(r >= 0 && r < 4 && c >= 0 && c < 3);
          const cell = r * 3 + c;
          assert.equal(cells.has(cell), false, `overlap at ${r}, ${c}`);
          cells.add(cell);
        }
    assert.deepEqual(page.occupied.map((filled, i) => filled === cells.has(i)), Array(12).fill(true));
  }
  return pages;
}

test("12-cell pages never overlap or reorder cases across the whole story", () => {
  const seed = story(Array.from({ length: 29 }, (_, i) => i % 5 ? [1, 1] : [2, 2]));
  assert.ok(verify(seed).length > 2);
});

test("the first free cell is the only anchor; never search later holes", () => {
  const seed = story([[1, 1], [1, 1], [3, 3], [1, 1]]);
  const pages = verify(seed);
  assert.deepEqual(pages[0].items.map(({ c }) => c.id), ["test-1", "test-2"]);
  assert.deepEqual([pages[1].items[0].row, pages[1].items[0].col], [0, 0]);
  const gap = story([[2, 1], [2, 1]]);
  assert.equal(verify(gap).length, 2); // A free column exists, but the second 2×1 must start there.
});

test("3×4 goes to the next page when it cannot fit at the first free cell", () => {
  const seed = story([[1, 1], [3, 4], [1, 1]]);
  const pages = verify(seed);
  assert.equal(pages[0].items.length, 1);
  assert.equal(pages[1].items[0].c.id, "test-2");
  assert.equal(pages[1].occupied.every(Boolean), true);
  assert.equal(pages[2].items[0].c.id, "test-3");
});

test("grow, shrink, add, delete and move reflow all following cases", () => {
  const seed = story(Array.from({ length: 13 }, () => [1, 1]));
  assert.equal(verify(seed).length, 2);
  seed.cases![0].layout_size = { width: 3, height: 4 };
  assert.equal(visualPageForCase(verify(seed), "test-2"), 1);
  seed.cases![0].layout_size = { width: 1, height: 1 };
  assert.equal(visualPageForCase(verify(seed), "test-2"), 0);
  const first = seed.cases![0].id;
  const added = structuredClone(seed.cases![0]);
  added.id = "new-large";
  added.layout_size = { width: 3, height: 4 };
  seed.cases!.push(added);
  assert.equal(moveCase(seed, added.id, first, "before"), true);
  assert.equal(verify(seed)[0].items[0].c.id, added.id);
  assert.equal(seed.cases![0].id, "new-large");
  assert.deepEqual(seed.cases!.map((c) => Number(c.numero)), Array.from({ length: 14 }, (_, i) => i + 1));
  seed.cases!.splice(0, 1);
  assert.equal(verify(seed)[0].items[0].c.id, first);
});
