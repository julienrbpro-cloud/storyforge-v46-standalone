import { useNavigate } from "@tanstack/react-router";
import { CaseImage } from "@/components/case-image";
import { computeVisualPages } from "@/lib/visual-layout";
import { useStudio } from "@/lib/store";
import { clamp } from "@/lib/utils";
import { OverlayCanvas } from "@/components/overlay-canvas";

export function VisualLayout({ compact = false, plancheId }: { compact?: boolean; plancheId?: string }) {
  const seed = useStudio((s) => s.seed);
  const revision = useStudio((s) => s.revision);
  const index = useStudio((s) => s.visualPageIndex);
  const setIndex = useStudio((s) => s.setVisualPageIndex);
  const setSelected = useStudio((s) => s.setSelectedCase);
  const navigate = useNavigate();
  void revision;
  const viewSeed = plancheId
    ? { ...seed, planches: seed.planches.filter((p) => p.id === plancheId) }
    : seed;
  const pages = computeVisualPages(viewSeed);
  const pageIndex = clamp(index, 0, Math.max(0, pages.length - 1));
  const page = pages[pageIndex];

  return (
    <div>
      {!compact ? (
        <>
          <h4 className="font-display text-lg text-paper-ink">Mise en page du récit · 3 × 3</h4>
          <p className="mb-2 text-[11px] leading-snug text-subtle">
            {pages.length} planches visuelles. Clique sur une case pour l’ouvrir. Son identifiant
            indique toujours son origine canonique.
          </p>
        </>
      ) : null}
      {page ? (
        <>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              className="h-10 min-w-10 rounded-md border border-paper-line bg-paper px-3 font-bold text-paper-ink disabled:opacity-40"
              disabled={pageIndex === 0}
              onClick={() => setIndex(pageIndex - 1)}
            >
              ←
            </button>
            <select
              aria-label="Planche visuelle"
              className="h-11 max-w-[65%] flex-1 rounded-md border border-paper-line bg-paper px-2 text-paper-ink"
              value={pageIndex}
              onChange={(e) => setIndex(Number(e.target.value))}
            >
              {pages.map((_, i) => (
                <option key={i} value={i}>
                  Planche visuelle {i + 1} / {pages.length}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="h-10 min-w-10 rounded-md border border-paper-line bg-paper px-3 font-bold text-paper-ink disabled:opacity-40"
              disabled={pageIndex === pages.length - 1}
              onClick={() => setIndex(pageIndex + 1)}
            >
              →
            </button>
          </div>
          <div className="visual-grid">
            {page.items.map(({ p, c, row, col, width, height }) => (
              <button
                key={c.id}
                type="button"
                className="relative min-h-0 min-w-0 overflow-hidden border border-[#8d7960] bg-[#f5eddf] p-1.5 text-left text-[#34291f]"
                style={{
                  gridColumn: `${col + 1} / span ${width}`,
                  gridRow: `${row + 1} / span ${height}`,
                }}
                title={`${c.id} · ${width}×${height}`}
                aria-label={`${c.id} · ${width}×${height}`}
                onClick={() => {
                  setSelected(c.id);
                  void navigate({ to: "/planche/$plancheId", params: { plancheId: p.id } });
                }}
              >
                {c.overlays.length ? <OverlayCanvas panel={c} editable={false} imageFit="contain" className="absolute inset-0 h-full min-h-0 w-full rounded-none border-0" /> : c.image ? (
                  <CaseImage src={c.image} alt="" className="absolute inset-0 h-full w-full object-contain" />
                ) : (
                  <>
                    <span className="relative z-10 block bg-[#fff9e9e8] text-[10px]">
                      {c.id} · {width}×{height}
                    </span>
                    <small className="block max-h-[85%] overflow-hidden text-[10px]">
                      {c.description || c.titre || ""}
                    </small>
                  </>
                )}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-subtle">Aucune case à paginer.</p>
      )}
    </div>
  );
}
