import { ImagePlus } from "lucide-react";
import { CaseImage } from "@/components/case-image";
import { caseCaption } from "@/lib/project";
import { caseLabel } from "@/lib/sequence";
import { cn } from "@/lib/utils";
import type { PanelCase } from "@/lib/types";
import { OverlayCanvas } from "@/components/overlay-canvas";

export function CaseCard({
  panel,
  selected,
  onSelect,
  compact = false,
}: {
  panel: PanelCase;
  selected?: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const { title, desc } = caseCaption(panel);
  const quote = (panel.textes || []).find((t) => t.contenu)?.contenu;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-md border border-black/20 bg-paper text-left text-paper-ink transition-[box-shadow,transform] duration-150",
        selected ? "ring-2 ring-accent ring-offset-2 ring-offset-cream" : "hover:border-black/40",
      )}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-cream-2">
        {panel.overlays.length ? <OverlayCanvas panel={panel} editable={false} className="absolute inset-0 h-full min-h-0 w-full rounded-none border-0" /> : panel.image ? (
          <CaseImage src={panel.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-subtle">
            <ImagePlus className="size-7 opacity-50" strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute top-1.5 left-1.5 z-10 rounded-md bg-paper-ink px-1.5 py-0.5 text-[11px] font-extrabold text-cream tabular-nums">
          {caseLabel(panel)}
        </span>
      </div>
      {compact ? (
        <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-paper/90 px-1 py-0.5 text-[9px] leading-tight">
          {title || desc || "Case sans description"}
        </span>
      ) : <div className="px-2.5 py-2">
        <p className="line-clamp-4 text-[12px] leading-snug">
          <b className="font-bold">
            {caseLabel(panel)}
            {title ? ` ${title}${title.endsWith(".") ? "" : "."}` : "."}
          </b>{" "}
          <span className="text-paper-muted">{desc || "Pas encore de mise en image."}</span>
        </p>
        {quote ? (
          <p className="mt-1.5 line-clamp-2 font-display text-[11.5px] leading-snug text-paper-ink/80 italic">
            « {quote} »
          </p>
        ) : null}
      </div>}
    </button>
  );
}
