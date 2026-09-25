import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { CaseImage } from "@/components/case-image";
import { clamp, cn } from "@/lib/utils";
import { caseLabel } from "@/lib/sequence";
import { useStudio } from "@/lib/store";
import type { Overlay, PanelCase, Planche } from "@/lib/types";

function overlayText(c: PanelCase, o: Overlay) {
  if (o.text_ref) return c.textes.find((t) => t.id === o.text_ref)?.contenu || "[Texte canonique introuvable]";
  return o.content || "";
}

export function OverlayCanvas({
  page,
  panel,
  editable = true,
  className,
  imageFit = "cover",
}: {
  page?: Planche;
  panel: PanelCase;
  editable?: boolean;
  className?: string;
  imageFit?: "cover" | "contain";
}) {
  const setOverlay = useStudio((s) => s.setOverlay);
  const persistNow = useStudio((s) => s.persistNow);
  const canvasRef = useRef<HTMLDivElement>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  function startDrag(ev: ReactPointerEvent<HTMLElement>, oid: string, mode: "move" | "resize") {
    if (!editable || !page) return;
    ev.preventDefault();
    ev.stopPropagation();
    const o = (panel.overlays || []).find((x) => x.id === oid);
    const canvas = canvasRef.current;
    if (!o || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = ev.clientX;
    const sy = ev.clientY;
    const start = { x: o.x, y: o.y, width: o.width, height: o.height };
    const move = (e: globalThis.PointerEvent) => {
      const dx = (e.clientX - sx) / rect.width;
      const dy = (e.clientY - sy) / rect.height;
      if (mode === "resize") {
        setOverlay(
          page.id,
          panel.id,
          oid,
          {
            width: clamp(start.width + dx, 0.08, 1 - o.x),
            height: clamp(start.height + dy, 0.06, 1 - o.y),
          },
          false,
        );
      } else {
        setOverlay(
          page.id,
          panel.id,
          oid,
          {
            x: clamp(start.x + dx, 0, 1 - o.width),
            y: clamp(start.y + dy, 0, 1 - (o.type === "speech" ? o.height : 0.06)),
          },
          false,
        );
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      stopDrag.current = null;
      persistNow();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
    stopDrag.current = up;
  }

  return (
    <div
      ref={canvasRef}
      className={cn("case-canvas relative aspect-square min-h-[190px] overflow-hidden rounded-md border border-paper-line bg-paper", className)}
      style={{ touchAction: editable ? "none" : undefined, containerType: "inline-size" }}
    >
      {panel.image ? (
        <CaseImage
          src={panel.image}
          alt={`Case ${caseLabel(panel)}`}
          className={cn("absolute inset-0 h-full w-full", imageFit === "contain" ? "object-contain" : "object-cover")}
        />
      ) : (
        <span className="pointer-events-none absolute inset-0 grid place-items-center font-display text-4xl text-[#c9bba0]">
          {caseLabel(panel)}
        </span>
      )}
      {(panel.overlays || []).map((o) => (
        <div
          key={o.id}
          className={`overlay absolute z-10 min-h-7 overflow-hidden px-2 py-1.5 leading-tight select-none ${o.type === "speech" ? "overlay-speech" : "overlay-text"}`}
          style={{
            left: `${o.x * 100}%`,
            top: `${o.y * 100}%`,
            width: `${o.width * 100}%`,
            height: o.type === "speech" ? `${o.height * 100}%` : undefined,
            fontSize: `clamp(10px, ${o.font_size * 100}cqw, 36px)`,
            textAlign: o.align,
            cursor: editable ? "move" : "default",
          }}
          onPointerDown={(e) => startDrag(e, o.id, "move")}
        >
          {overlayText(panel, o)}
          {editable && o.type === "speech" ? (
            <span
              className="absolute right-0.5 bottom-0.5 size-3.5 rounded-full border-2 border-paper-ink bg-accent"
              style={{ cursor: "nwse-resize" }}
              onPointerDown={(e) => startDrag(e, o.id, "resize")}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
