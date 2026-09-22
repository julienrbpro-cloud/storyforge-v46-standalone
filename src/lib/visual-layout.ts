import type { PanelCase, Seed, VisualPage } from "./types";

export function caseSize(c: PanelCase) {
  const dim = (v: unknown, max: number) =>
    Number.isInteger(Number(v)) && Number(v) >= 1 ? Math.min(Number(v), max) : 1;
  return { width: dim(c.layout_size?.width, 3), height: dim(c.layout_size?.height, 3) };
}

export function computeVisualPages(seed: Seed): VisualPage[] {
  const pages: VisualPage[] = [];
  let page: VisualPage | null = null;
  let cursor = 9;
  for (const p of seed.planches || []) {
    for (const c of p.cases || []) {
      const { width, height } = caseSize(c);
      let placed = false;
      while (!placed) {
        if (cursor >= 9) {
          page = { items: [], occupied: Array(9).fill(false) };
          pages.push(page);
          cursor = 0;
        }
        for (let i = cursor; i < 9; i++) {
          const row = Math.floor(i / 3);
          const col = i % 3;
          if (col + width > 3 || row + height > 3) continue;
          const cells: number[] = [];
          for (let y = row; y < row + height; y++) {
            for (let x = col; x < col + width; x++) cells.push(y * 3 + x);
          }
          if (cells.some((k) => page!.occupied[k])) continue;
          cells.forEach((k) => {
            page!.occupied[k] = true;
          });
          page!.items.push({ p, c, row, col, width, height });
          cursor = i + 1;
          placed = true;
          break;
        }
        if (!placed) cursor = 9;
      }
    }
  }
  return pages;
}