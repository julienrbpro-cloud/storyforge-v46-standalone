import { ImagePlus } from "lucide-react";
import { CaseImage } from "@/components/case-image";
import { caseCaption } from "@/lib/project";
import { cn } from "@/lib/utils";
import type { PanelCase } from "@/lib/types";

export function CaseCard({
  panel,
  selected,
  onSelect,
}: {
  panel: PanelCase;
  selected?: boolean;
  onSelect: () => void;
}) {
  const { title, desc } = caseCaption(panel);
  const quote = (panel.textes || []).find((t) => t.contenu)?.contenu;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-black/20 bg-paper text-left text-paper-ink transition-[box-shadow,transform] duration-150",
        selected ? "ring-2 ring-accent ring-offset-2 ring-offset-cream" : "hover:border-black/40",
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-cream-2">
        {panel.image ? (
          <CaseImage src={panel.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-subtle">
            <ImagePlus className="size-7 opacity-50" strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute top-1.5 left-1.5 z-10 rounded-md bg-paper-ink px-1.5 py-0.5 text-[11px] font-extrabold text-cream tabular-nums">
          {panel.numero}
        </span>
      </div>
      <div className="px-2.5 py-2">
        <p className="line-clamp-4 text-[12px] leading-snug">
          <b className="font-bold">
            {panel.numero}
            {title ? ` ${title}${title.endsWith(".") ? "" : "."}` : "."}
          </b>{" "}
          <span className="text-paper-muted">{desc || "Pas encore de mise en image."}</span>
        </p>
        {quote ? (
          <p className="mt-1.5 line-clamp-2 font-display text-[11.5px] leading-snug text-paper-ink/80 italic">
            « {quote} »
          </p>
        ) : null}
      </div>
    </button>
  );
}