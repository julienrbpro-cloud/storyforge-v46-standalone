import officialJson from "@/data/seed.json";
import { uid, clamp } from "./utils";
import type { Overlay, PanelCase, Planche, Seed, Meta } from "./types";
import { z } from "zod";

export const SEED_OFFICIEL = officialJson as Seed;

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function typeInfo(type: string) {
  const map: Record<string, [string, string, string]> = {
    dialogue: ["dialogue", "Dialogue", "t-dialogue"],
    narration: ["narration", "Narration", "t-narration"],
    narration_interieure: ["narration_interieure", "Narration intérieure", "t-narration"],
    lettre: ["lettre", "Lettre", "t-lettre"],
    texto: ["texto", "Texto", "t-texto"],
    caption: ["caption", "Carton / caption", "t-caption"],
    texte_symbolique: ["texte_symbolique", "Texte symbolique", "t-symbolique"],
    texte_ecran: ["texte_ecran", "Texte d’écran", "t-ecran"],
    repere_temporel: ["repere_temporel", "Repère temporel", "t-repere"],
  };
  return map[type] ?? [type, type, "t-narration"];
}

function publicAsset(ref: string | null | undefined) {
  if (!ref) return null;
  if (ref.startsWith("./")) return ref.slice(1);
  return ref;
}

export function normalizeSeed(input: Seed | null | undefined): Seed {
  const SEED = Object.assign(clone(SEED_OFFICIEL), clone(input || {})) as Seed;
  SEED.projet ||= clone(SEED_OFFICIEL.projet);
  SEED.personnages ||= clone(SEED_OFFICIEL.personnages);
  SEED.gardiens ||= clone(SEED_OFFICIEL.gardiens);
  SEED.regles_editoriales ||= clone(SEED_OFFICIEL.regles_editoriales);
  SEED.choix_editoriaux_ouverts ||= clone(SEED_OFFICIEL.choix_editoriaux_ouverts);
  SEED.planches ||= [];
  SEED.planches.forEach((p, pi) => {
    p.id ||= uid("P");
    p.numero ??= pi + 1;
    p.titre ||= "";
    p.gardien_etat = {
      archiviste: p.gardien_etat?.archiviste || { present: false, niveau: null },
      armurier: p.gardien_etat?.armurier || { present: false, niveau: null },
    };
    p.cases ||= [];
    p.cases.forEach((c, ci) => {
      c.id ||= uid("case");
      c.numero ??= String(ci + 1);
      c.description ||= "";
      if (!Object.prototype.hasOwnProperty.call(c, "image")) {
        const canonical = SEED_OFFICIEL.planches
          .find((x) => x.id === p.id)
          ?.cases.find((x) => x.id === c.id);
        c.image = publicAsset(canonical?.image ?? null);
      } else {
        c.image = publicAsset(c.image ?? null);
      }
      c.overlays = Array.isArray(c.overlays) ? c.overlays : [];
      c.textes ||= [];
      c.personnages ||= [];
      c.statut ||= "a_valider";
      if (Array.isArray(c.notes)) c.notes = (c.notes as unknown as string[]).join("\n");
      c.notes = c.notes ? String(c.notes) : null;
      c.textes.forEach((t, ti) => {
        t.id ||= `${c.id}-T${String(ti + 1).padStart(2, "0")}`;
        t.preserve_exact = !!t.preserve_exact;
      });
      c.overlays.forEach((o: Overlay, oi: number) => {
        o.id ||= `${c.id}-OV${String(oi + 1).padStart(2, "0")}`;
        o.type ||= "text";
        o.x = clamp(Number(o.x ?? 0.1), 0, 1);
        o.y = clamp(Number(o.y ?? 0.1), 0, 1);
        o.width = clamp(Number(o.width ?? 0.32), 0.08, 1);
        o.height = clamp(Number(o.height ?? 0.18), 0.06, 1);
        o.font_size = clamp(Number(o.font_size ?? 0.045), 0.02, 0.12);
        o.align ||= "center";
      });
    });
  });
  SEED.projet.nombre_planches = SEED.planches.length;
  return SEED;
}

const guardianSchema = z.object({
  present: z.boolean(),
  niveau: z.number().int().min(0).max(5).nullable(),
});
const seedSchema = z
  .object({
    projet: z
      .object({ titre: z.string(), version: z.string(), sous_titre: z.string().optional() })
      .passthrough()
      .optional(),
    personnages: z.array(z.object({ id: z.string(), nom: z.string() }).passthrough()).optional(),
    gardiens: z.array(z.object({ id: z.string() }).passthrough()).optional(),
    regles_editoriales: z
      .array(z.object({ id: z.string(), titre: z.string(), contenu: z.string() }).passthrough())
      .optional(),
    choix_editoriaux_ouverts: z
      .array(
        z
          .object({
            id: z.string(),
            planche: z.union([z.number(), z.string()]),
            case: z.string(),
            regle: z.string(),
          })
          .passthrough(),
      )
      .optional(),
    planches: z.array(
      z
        .object({
          id: z.string().min(1).optional(),
          numero: z.number().int().positive().optional(),
          titre: z.string().nullable().optional(),
          chapitre: z.string().nullable().optional(),
          date_histoire: z.string().nullable().optional(),
          instructions_planche: z.string().nullable().optional(),
          notes_planche: z.array(z.string()).nullable().optional(),
          gardien_etat: z
            .object({ archiviste: guardianSchema.optional(), armurier: guardianSchema.optional() })
            .optional(),
          cases: z.array(
            z
              .object({
                id: z.string().min(1).optional(),
                numero: z.string().optional(),
                titre: z.string().nullable().optional(),
                description: z.string().nullable().optional(),
                image: z.string().nullable().optional(),
                statut: z.string().optional(),
                personnages: z.array(z.string()).optional(),
                textes: z
                  .array(
                    z
                      .object({
                        id: z.string().optional(),
                        type: z.string(),
                        contenu: z.string(),
                        personnage_id: z.string().nullable().optional(),
                        preserve_exact: z.boolean().optional(),
                      })
                      .passthrough(),
                  )
                  .optional(),
                gardien_override: z
                  .object({
                    archiviste: guardianSchema.optional(),
                    armurier: guardianSchema.optional(),
                  })
                  .optional(),
                overlays: z
                  .array(
                    z
                      .object({
                        id: z.string().optional(),
                        type: z.enum(["text", "speech"]).optional(),
                        text_ref: z.string().nullable().optional(),
                        content: z.string().optional(),
                        x: z.number().optional(),
                        y: z.number().optional(),
                        width: z.number().optional(),
                        height: z.number().optional(),
                        font_size: z.number().optional(),
                        align: z.enum(["left", "center", "right"]).optional(),
                      })
                      .passthrough(),
                  )
                  .optional(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough();

/** Accept a seed or the seed member of a session; never silently use the official manuscript. */
export function parseSeed(data: unknown): Seed {
  const input = data && typeof data === "object" && "seed" in data ? data.seed : data;
  const result = seedSchema.safeParse(input);
  if (!result.success)
    throw new Error("Structure du seed invalide : " + result.error.issues[0].path.join("."));
  const seed = normalizeSeed(result.data as unknown as Seed);
  const ids = new Set<string>();
  for (const p of seed.planches) {
    for (const item of [p, ...p.cases, ...p.cases.flatMap((c) => [...c.textes, ...c.overlays])]) {
      if (ids.has(item.id)) throw new Error(`Identifiant dupliqué : ${item.id}`);
      ids.add(item.id);
    }
  }
  return seed;
}

export function normalizeMeta(input: unknown): Meta {
  const result = emptyMeta();
  if (!input || typeof input !== "object") return result;
  const m = input as Partial<Meta>;
  for (const [id, status] of Object.entries(m.statuts || {})) {
    if (["a_faire", "brouillon", "en_cours", "termine"].includes(status))
      result.statuts[id] = status;
  }
  for (const [id, note] of Object.entries(m.notes || {}))
    if (typeof note === "string") result.notes[id] = note;
  for (const key of Object.keys(result.filters) as Array<keyof Meta["filters"]>) {
    if (typeof m.filters?.[key] === "string") result.filters[key] = m.filters[key];
  }
  return result;
}

export function pageById(seed: Seed, id: string) {
  return seed.planches.find((p) => p.id === id);
}

export function caseById(seed: Seed, pid: string, cid: string) {
  return pageById(seed, pid)?.cases.find((c) => c.id === cid);
}

export function caseEntry(seed: Seed, cid: string): { p: Planche; c: PanelCase } | null {
  for (const p of seed.planches) {
    const c = p.cases.find((x) => x.id === cid);
    if (c) return { p, c };
  }
  return null;
}

export function emptyFilters() {
  return { q: "", chapitre: "", personnage: "", gardien: "", statut: "" };
}

export function emptyMeta(): Meta {
  return { statuts: {}, notes: {}, filters: emptyFilters() };
}

export function totalCases(seed: Seed) {
  return seed.planches.reduce((n, p) => n + p.cases.length, 0);
}

export function caseImageCount(seed: Seed) {
  return seed.planches.flatMap((p) => p.cases).filter((c) => c.image).length;
}

export function idbImageCount(seed: Seed) {
  return seed.planches
    .flatMap((p) => p.cases)
    .filter((c) => String(c.image || "").startsWith("idb://")).length;
}

export function peopleOf(seed: Seed) {
  return [
    ...(seed.personnages || []).map((p) => ({ id: p.id, nom: p.nom || p.id })),
    ...(seed.gardiens || []).map((g) => ({
      id: g.id,
      nom: g.id === "archiviste" ? "Archiviste" : g.id === "armurier" ? "Armurier" : g.id,
    })),
  ];
}

export function findPlanches(obj: unknown): unknown[] | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  if (
    Array.isArray(rec.planches) &&
    rec.planches.some((p) => p && typeof p === "object" && "cases" in (p as object))
  ) {
    return rec.planches as unknown[];
  }
  for (const key of Object.keys(rec)) {
    const nested = findPlanches(rec[key]);
    if (nested) return nested;
  }
  return null;
}
