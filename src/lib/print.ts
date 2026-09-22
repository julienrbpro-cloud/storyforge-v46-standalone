import { resolveImageRef } from "./media";
import { typeInfo } from "./seed";
import type { Overlay, PanelCase, Seed } from "./types";

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
  const pages = plancheId ? seed.planches.filter((p) => p.id === plancheId) : seed.planches;
  const blocks: string[] = [];
  for (const p of pages) {
    const cases: string[] = [];
    for (const c of p.cases || []) {
      const img = await resolveImageRef(c.image);
      const overlays = (c.overlays || [])
        .map((o) => {
          const text = overlayText(c, o);
          const h = o.type === "speech" ? `height:${o.height * 100}%;` : "";
          return `<div style="position:absolute;left:${o.x * 100}%;top:${o.y * 100}%;width:${o.width * 100}%;${h}font-size:${Math.max(10, o.font_size * 180)}px;text-align:${o.align}">${escapeHtml(text)}</div>`;
        })
        .join("");
      const texts = (c.textes || [])
        .map(
          (t) =>
            `<div><i>${escapeHtml(typeInfo(t.type)[1])}${t.personnage_id ? " " + escapeHtml(t.personnage_id) : ""}${t.preserve_exact ? " exact" : ""} :</i> ${escapeHtml(t.contenu)}</div>`,
        )
        .join("");
      cases.push(
        `<div style="border:1.5px solid #111;border-radius:6px;padding:8px 10px;margin-bottom:8px;page-break-inside:avoid"><b>Case ${escapeHtml(c.numero)}${c.titre ? " — " + escapeHtml(c.titre) : ""}</b>${img ? `<div style="position:relative;width:min(100%,680px);margin:8px auto;overflow:hidden"><img src="${img}" alt="" style="width:100%;display:block;border:1px solid #aaa">${overlays}</div>` : ""}${c.description ? `<p>${escapeHtml(c.description)}</p>` : ""}${texts}${c.personnages?.length ? `<p><i>Personnages : ${escapeHtml(c.personnages.join(", "))}</i></p>` : ""}</div>`,
      );
    }
    blocks.push(
      `<div style="page-break-after:always;margin-bottom:24px"><h2 style="font-size:17px;margin:0 0 2px;border-bottom:2px solid #111;padding-bottom:4px">Planche ${escapeHtml(String(p.numero))} — ${escapeHtml(p.titre)}</h2><div style="font-size:11px;color:#555;margin:4px 0 10px">${escapeHtml(p.chapitre || "")}${p.date_histoire ? " · " + escapeHtml(p.date_histoire) : ""}</div>${p.instructions_planche ? `<p><b>Instructions :</b> ${escapeHtml(p.instructions_planche)}</p>` : ""}${cases.join("")}</div>`,
    );
  }
  const root = document.getElementById("print-root");
  if (root) {
    root.innerHTML = `<h1 style="font-size:24px;margin:0 0 4px">${escapeHtml(seed.projet.titre)} — ${escapeHtml(seed.projet.version)}</h1><div style="font-size:12px;color:#555;margin-bottom:20px">Storyboard de production · ${pages.length} planche(s) · texte et images</div>${blocks.join("")}`;
  }
  setTimeout(() => window.print(), 80);
}