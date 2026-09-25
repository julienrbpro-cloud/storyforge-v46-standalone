import { orderedCases } from "./case-order";
import type { PanelCase, Seed, VisualPage } from "./types";

export const GRID_COLUMNS = 3;
export const GRID_ROWS = 4;
export const GRID_CELLS = GRID_COLUMNS * GRID_ROWS;

export function caseSize(c: PanelCase) {
  const dim = (v: unknown, max: number) =>
    Number.isInteger(Number(v)) && Number(v) >= 1 ? Math.min(Number(v), max) : 1;
  return { width: dim(c.layout_size?.width, GRID_COLUMNS), height: dim(c.layout_size?.height, GRID_ROWS) };
}

/** Scan forward in reading order; skipped cells are never revisited for later cases. */
export function computeVisualPages(seed: Seed): VisualPage[] {
  const pages: VisualPage[] = [];
  let page: VisualPage | undefined;
  let cursor = 0;
  const sources = new Map(seed.planches.map((p) => [p.id, p]));
  for (const c of orderedCases(seed)) {
    const { width, height } = caseSize(c);
    if (!page) {
      page = { items: [], occupied: Array(GRID_CELLS).fill(false) };
      pages.push(page);
    }
    const findAnchor = () => {
      for (let at = cursor; at < GRID_CELLS; at++) {
        const row = Math.floor(at / GRID_COLUMNS);
        const col = at % GRID_COLUMNS;
        if (col + width > GRID_COLUMNS || row + height > GRID_ROWS) continue;
        let free = true;
        for (let y = row; y < row + height && free; y++)
          for (let x = col; x < col + width; x++)
            if (page!.occupied[y * GRID_COLUMNS + x]) { free = false; break; }
        if (free) return at;
      }
      return -1;
    };
    let anchor = findAnchor();
    if (anchor < 0) {
      page = { items: [], occupied: Array(GRID_CELLS).fill(false) };
      pages.push(page);
      cursor = 0;
      anchor = 0;
    }
    const row = Math.floor(anchor / GRID_COLUMNS);
    const col = anchor % GRID_COLUMNS;
    for (let y = row; y < row + height; y++)
      for (let x = col; x < col + width; x++) page.occupied[y * GRID_COLUMNS + x] = true;
    cursor = anchor + 1;
    const source = sources.get(c.source_planche_id || "") || {
      id: "source", numero: 1, titre: "", cases: [], chapitre: null, date_histoire: null,
      instructions_planche: null, notes_planche: [],
      gardien_etat: { archiviste: { present: false, niveau: null }, armurier: { present: false, niveau: null } },
    };
    page.items.push({ p: source, c, row, col, width, height });
  }
  return pages;
}

export function visualPageForCase(pages: VisualPage[], id: string): number {
  return pages.findIndex((page) => page.items.some(({ c }) => c.id === id));
}
