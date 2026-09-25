import { z } from "zod";
import { activeProjectMedia, blobToDataUrl, dataUrlToBlob, dbAll, type MediaRecord } from "./media";
import { clone, normalizeMeta, parseSeed } from "./seed";
import { APP_VERSION } from "./constants";
import type { Meta, Seed } from "./types";
import { orderedCases, persistedSeed } from "./case-order";

const sessionSchema = z.object({
  seed: z.unknown().refine((x) => x != null, "Seed manquant"),
  meta: z.unknown().optional(),
  media_meta: z.record(z.string(), z.array(z.unknown())).optional(),
  media: z
    .array(
      z.object({
        id: z.string().min(1),
        data: z.string(),
        ownerType: z.string().optional(),
        ownerId: z.string().optional(),
        mime: z.string().optional(),
        name: z.string().optional(),
        kind: z.string().optional(),
        createdAt: z.string().optional(),
      }),
    )
    .optional(),
  images: z.record(z.string(), z.string()).optional(),
});

export async function createSession(
  seed: Seed,
  meta: Meta,
  mediaMeta: unknown,
  records?: MediaRecord[],
) {
  // Snapshot before asynchronous file reads, so typing during export cannot mix revisions.
  const snapshot = { seed: persistedSeed(seed), meta: clone(meta), media_meta: clone(mediaMeta) };
  const media = await Promise.all(
    activeProjectMedia(records ?? (await dbAll()), seed).map(async ({ blob, ...record }) => ({
      ...record,
      data: await blobToDataUrl(blob),
    })),
  );
  return {
    format: "storyforge-standalone-session",
    format_version: 4,
    app_version: APP_VERSION,
    exported_at: new Date().toISOString(),
    ...snapshot,
    media,
  };
}

/** Validate and decode EVERYTHING before touching the current manuscript or images. */
export function parseSession(data: unknown) {
  const result = sessionSchema.safeParse(data);
  if (!result.success) throw new Error("Sauvegarde de session invalide");
  const d = result.data;
  const seed = parseSeed(d.seed);
  const records = new Map<string, MediaRecord>();
  for (const { data: encoded, ...record } of d.media || []) {
    if (records.has(record.id)) throw new Error(`Image dupliquée : ${record.id}`);
    records.set(record.id, { ...record, blob: dataUrlToBlob(encoded) });
  }
  // Legacy standalone backups stored images by case id.
  for (const c of orderedCases(seed)) {
      const legacy = d.images?.[c.id];
      if (legacy) {
        const id = `legacy-${c.id}`;
        records.set(id, { id, ownerType: "case", ownerId: c.id, blob: dataUrlToBlob(legacy) });
        c.image = `idb://${id}`;
      }
      if (c.image?.startsWith("idb://") && !records.has(c.image.slice(6))) {
        throw new Error(`La sauvegarde ne contient pas l’image de ${c.id}. Rien n’a été remplacé.`);
      }
  }
  for (const entity of [...(seed.personnages || []), ...(seed.gardiens || [])]) {
    if (entity.image?.startsWith("idb://") && !records.has(entity.image.slice(6))) {
      throw new Error(`La sauvegarde ne contient pas l’image de référence de ${entity.id}. Rien n’a été remplacé.`);
    }
  }
  return {
    seed,
    meta: normalizeMeta(d.meta),
    mediaMeta: d.media_meta || {},
    records: [...records.values()],
  };
}
