import { resolveImageRef } from "./media";
import { typeInfo } from "./seed";
import type { Overlay, PanelCase, Seed } from "./types";
import { toast } from "sonner";
import { computeVisualPages, visualPageForCase } from "./visual-layout";

function overlayText(c: PanelCase, o: Overlay) {
  if (o.text_ref) return c.textes.find((t) => t.id === o.text_ref)?.contenu || "";
  return o.content || "";
}

function escapeHtml(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026#39;");
}

export async function printStoryboard(seed: Seed, plancheId: string | null) {
  try {
    const visual = computeVisualPages(seed);
    const source = seed.planches.find((p) => p.id === plancheId);
    const selectedIndex = plancheId && source
      ? visualPageForCase(visual, source.cases[0]?.id || "")
      : plancheId ? Number(plancheId) - 1 : -1;
    const pages = plancheId ? visual.filter((_, index) => index === selectedIndex) : visual;
    const blocks: string[] = [];
    for (const page of pages) {
      const pageNumber = visual.indexOf(page) + 1;
      const cases: string[] = [];
      for (const { c } of page.items) {
        const img = await resolveImageRef(c.image);
        const overlays = (c.overlays || [])
          .map((o) => {
            const text = overlayText(c, o);
            const h = o.type === "speech" ? `height:${o.height * 100}%;` : "";
            return `<div class="${o.type === "speech" ? "overlay-speech" : "overlay-text"}" style="position:absolute;overflow:hidden;padding:6px 8px;left:${o.x * 100}%;top:${o.y * 100}%;width:${o.width * 100}%;${h}font-size:clamp(10px,${o.font_size * 100}cqw,36px);text-align:${o.align}">${escapeHtml(text)}</div>`;
          })
          .join("");
        const texts = (c.textes || [])
          .map(
            (t) =>
              `<div><i>${escapeHtml(typeInfo(t.type)[1])}${t.personnage_id ? " " + escapeHtml(t.personnage_id) : ""}${t.preserve_exact ? " exact" : ""} :</i> ${escapeHtml(t.contenu)}</div>`,
          )
          .join("");
        cases.push(
          `<div style="border:1.5px solid #111;border-radius:6px;padding:8px 10px;margin-bottom:8px;page-break-inside:avoid"><b>Case ${escapeHtml(c.numero)}${c.titre ? " — " + escapeHtml(c.titre) : ""}</b>${img ? `<div style="container-type:inline-size;position:relative;width:min(100%,680px);margin:8px auto;overflow:hidden"><img src="${escapeHtml(img)}" alt="" style="width:100%;display:block;border:1px solid #aaa">${overlays}</div>` : ""}${c.description ? `<p>${escapeHtml(c.description)}</p>` : ""}${texts}${c.personnages?.length ? `<p><i>Personnages : ${escapeHtml(c.personnages.join(", "))}</i></p>` : ""}</div>`,
        );
      }
      blocks.push(
        `<div style="page-break-after:always;margin-bottom:24px"><h2 style="font-size:17px;margin:0 0 2px;border-bottom:2px solid #111;padding-bottom:4px">Planche visuelle ${pageNumber}</h2>${cases.join("")}</div>`,
      );
    }
    const root = document.getElementById("print-root");
    if (root) {
      root.innerHTML = `<h1 style="font-size:24px;margin:0 0 4px">${escapeHtml(seed.projet.titre)} — ${escapeHtml(seed.projet.version)}</h1><div style="font-size:12px;color:#555;margin-bottom:20px">Storyboard de production · ${pages.length} planche(s) · texte et images</div>${blocks.join("")}`;
    }
    if (!root) throw new Error("Zone d’impression introuvable");
    await Promise.all([...root.querySelectorAll("img")].map((img) => img.decode()));
    await document.fonts.ready;
    window.print();
  } catch (error) {
    toast.error("Impression impossible : " + (error as Error).message);
  }
}
