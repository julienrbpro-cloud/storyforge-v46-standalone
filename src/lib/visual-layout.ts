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

/** Sequential first-free anchor. A failed rectangle advances the WHOLE case to a fresh page. */
export function computeVisualPages(seed: Seed): VisualPage[] {
  const pages: VisualPage[] = [];
  let page: VisualPage | undefined;
  const sources = new Map(seed.planches.map((p) => [p.id, p]));
  for (const c of orderedCases(seed)) {
    const { width, height } = caseSize(c);
    if (!page) {
      page = { items: [], occupied: Array(GRID_CELLS).fill(false) };
      pages.push(page);
    }
    let anchor = page.occupied.indexOf(false);
    let row = Math.floor(anchor / GRID_COLUMNS);
    let col = anchor % GRID_COLUMNS;
    const fits = () => anchor >= 0 && col + width <= GRID_COLUMNS && row + height <= GRID_ROWS &&
      Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => (row + y) * GRID_COLUMNS + col + x))
        .flat().every((cell) => !page!.occupied[cell]);
    if (!fits()) {
      page = { items: [], occupied: Array(GRID_CELLS).fill(false) };
      pages.push(page);
      anchor = 0;
      row = 0;
      col = 0;
    }
    for (let y = row; y < row + height; y++)
      for (let x = col; x < col + width; x++) page.occupied[y * GRID_COLUMNS + x] = true;
    const source = sources.get(c.source_planche_id || "") || seed.planches[0] || {
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
