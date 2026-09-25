import type { PanelCase, Seed, VisualPage } from "./types";
import { storyCases } from "./sequence";

export const GRID_COLS = 3;
export const GRID_ROWS = 4;
export const GRID_CELLS = GRID_COLS * GRID_ROWS;

export function caseSize(c: PanelCase) {
  const dim = (v: unknown, max: number) =>
    Number.isInteger(Number(v)) && Number(v) >= 1 ? Math.min(Number(v), max) : 1;
  return { width: dim(c.layout_size?.width, GRID_COLS), height: dim(c.layout_size?.height, GRID_ROWS) };
}

function fits(page: VisualPage, row: number, col: number, width: number, height: number) {
  if (col < 0 || row < 0 || col + width > GRID_COLS || row + height > GRID_ROWS) return false;
  for (let y = row; y < row + height; y++) {
    for (let x = col; x < col + width; x++) {
      if (page.occupied[y * GRID_COLS + x]) return false;
    }
  }
  return true;
}

function occupy(page: VisualPage, row: number, col: number, width: number, height: number) {
  for (let y = row; y < row + height; y++) {
    for (let x = col; x < col + width; x++) page.occupied[y * GRID_COLS + x] = true;
  }
}

/**
 * Place cases in global order onto 3×4 pages.
 * Each case is tried from the current cell forward, left to right then the
 * next row. A miss continues to the next cell. The case goes to the next
 * page only when no remaining cell can hold the whole rectangle.
 * The cursor never moves backward, so an earlier hole is not reused.
 */
export function reflow(cases: PanelCase[]): VisualPage[] {
  if (!cases.length) return [];
  const pages: VisualPage[] = [];
  const blank = (): VisualPage => {
    const page = { items: [], occupied: Array(GRID_CELLS).fill(false) };
    pages.push(page);
    return page;
  };
  const anchorAt = (page: VisualPage, from: number, width: number, height: number) => {
    for (let index = from; index < GRID_CELLS; index++) {
      const row = Math.floor(index / GRID_COLS);
      const col = index % GRID_COLS;
      if (fits(page, row, col, width, height)) return index;
    }
    return -1;
  };
  let page = blank();
  let cursor = 0;
  for (const c of cases) {
    const { width, height } = caseSize(c);
    let anchor = anchorAt(page, cursor, width, height);
    if (anchor < 0) {
      page = blank();
      cursor = 0;
      anchor = anchorAt(page, 0, width, height);
    }
    if (anchor < 0) {
      const fitted = caseSize({
        ...c,
        layout_size: { width: Math.min(width, GRID_COLS), height: Math.min(height, GRID_ROWS) },
      });
      occupy(page, 0, 0, fitted.width, fitted.height);
      page.items.push({ c, row: 0, col: 0, width: fitted.width, height: fitted.height });
      cursor = 1;
      continue;
    }
    const row = Math.floor(anchor / GRID_COLS);
    const col = anchor % GRID_COLS;
    occupy(page, row, col, width, height);
    page.items.push({ c, row, col, width, height });
    cursor = anchor + 1;
  }
  return pages;
}

export function computeVisualPages(seed: Seed): VisualPage[] {
  return reflow(storyCases(seed));
}

export function visualPageIndexOf(cases: PanelCase[], caseId: string) {
  const index = reflow(cases).findIndex((page) => page.items.some((item) => item.c.id === caseId));
  return index < 0 ? 0 : index;
}
