import { clone } from "./seed";
import { dbAll, imageExt } from "./media";
import type { Meta, Seed } from "./types";
import { createSession } from "./session";
import { toast } from "sonner";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zipU16(n: number) {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}
function zipU32(n: number) {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}
function joinBytes(parts: Uint8Array[]) {
  const size = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function makeStoreZip(entries: Array<{ name: string; data: Uint8Array | ArrayBuffer }>) {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = enc.encode(entry.name);
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
    const crc = crc32(data);
    const local = joinBytes([
      zipU32(0x04034b50),
      zipU16(20),
      zipU16(0),
      zipU16(0),
      zipU16(0),
      zipU16(0),
      zipU32(crc),
      zipU32(data.length),
      zipU32(data.length),
      zipU16(name.length),
      zipU16(0),
      name,
      data,
    ]);
    locals.push(local);
    const central = joinBytes([
      zipU32(0x02014b50),
      zipU16(20),
      zipU16(20),
      zipU16(0),
      zipU16(0),
      zipU16(0),
      zipU16(0),
      zipU32(crc),
      zipU32(data.length),
      zipU32(data.length),
      zipU16(name.length),
      zipU16(0),
      zipU16(0),
      zipU16(0),
      zipU16(0),
      zipU32(0),
      zipU32(offset),
      name,
    ]);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, p) => n + p.length, 0);
  const end = joinBytes([
    zipU32(0x06054b50),
    zipU16(0),
    zipU16(0),
    zipU16(entries.length),
    zipU16(entries.length),
    zipU32(centralSize),
    zipU32(offset),
    zipU16(0),
  ]);
  return new Blob([...locals, ...centrals, end] as BlobPart[], { type: "application/zip" });
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadJson(data: unknown, name: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), name);
}

function exportAssetPath(
  numero: number,
  caseNumero: string,
  caseId: string,
  mime?: string,
  name?: string,
) {
  const pn = String(numero).padStart(2, "0");
  const raw = String(caseNumero);
  const clean = raw.toLowerCase().replace(/[^a-z0-9]+/g, "") || caseId.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const cn = /^\d+$/.test(clean) ? clean.padStart(2, "0") : clean.replace(/^(\d)(\D)/, "0$1$2");
  return `assets/bd/p${pn}/c${cn}.${imageExt(mime, name)}`;
}

export async function exportProjectZip(seed: Seed, meta: Meta, mediaMeta: unknown) {
  try {
    downloadBlob(await buildProjectZip(seed, meta, mediaMeta), "storyforge-v46-export.zip");
  } catch (error) {
    toast.error("Export impossible : " + (error as Error).message);
  }
}

export async function buildProjectZip(seed: Seed, meta: Meta, mediaMeta: unknown) {
  seed = clone(seed);
  meta = clone(meta);
  mediaMeta = clone(mediaMeta);
  const enc = new TextEncoder();
  const records = await dbAll();
  const byId = new Map(records.map((r) => [r.id, r]));
  const portable = clone(seed);
  const entries: Array<{ name: string; data: Uint8Array | ArrayBuffer }> = [];
  const manifest: Array<{
    case_id: string | null;
    owner_type?: string;
    owner_id?: string;
    source: string;
    target: string;
    name: string | null;
  }> = [];
  for (const p of portable.planches || []) {
    for (const c of p.cases || []) {
      if (!c.image) continue;
      const source = c.image;
      let rec;
      if (source.startsWith("idb://")) rec = byId.get(source.slice(6));
      else {
        const response = await fetch(source);
        if (!response.ok) throw new Error(`Image inaccessible : ${c.id}`);
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) throw new Error(`Fichier image invalide : ${c.id}`);
        rec = { blob, mime: blob.type, name: source.split("/").pop() };
      }
      if (!rec?.blob) throw new Error(`Image IndexedDB introuvable : ${c.id}`);
      let path = exportAssetPath(p.numero, c.numero, c.id, rec.mime || rec.blob.type, rec.name);
      if (entries.some((e) => e.name === path)) path = path.replace(/(\.[^.]+)$/, `-${manifest.length}$1`);
      entries.push({ name: path, data: await rec.blob.arrayBuffer() });
      manifest.push({ case_id: c.id, owner_type: "case", owner_id: c.id, source: String(c.image), target: "./" + path, name: rec.name || null });
      c.image = "./" + path;
    }
  }

  async function addReferenceImage(
    ownerType: "personnage" | "gardien",
    ownerId: string,
    source: string,
  ) {
    let rec;
    if (source.startsWith("idb://")) rec = byId.get(source.slice(6));
    else {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Image de référence inaccessible : ${ownerId}`);
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error(`Image de référence invalide : ${ownerId}`);
      rec = { blob, mime: blob.type, name: source.split("/").pop() };
    }
    if (!rec?.blob) throw new Error(`Image IndexedDB introuvable : ${ownerId}`);
    const ext = imageExt(rec.mime || rec.blob.type, rec.name);
    const safeId = ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
    let path = `assets/references/${ownerType}-${safeId}.${ext}`;
    if (entries.some((e) => e.name === path)) {
      path = `assets/references/${ownerType}-${safeId}-${manifest.length}.${ext}`;
    }
    entries.push({ name: path, data: await rec.blob.arrayBuffer() });
    manifest.push({
      case_id: null,
      owner_type: ownerType,
      owner_id: ownerId,
      source,
      target: "./" + path,
      name: rec.name || null,
    });
    return "./" + path;
  }

  for (const person of portable.personnages || []) {
    if (person.image) person.image = await addReferenceImage("personnage", person.id, person.image);
  }
  for (const guardian of portable.gardiens || []) {
    if (guardian.image) guardian.image = await addReferenceImage("gardien", guardian.id, guardian.image);
  }

  const used = new Set(manifest.filter((x) => x.source.startsWith("idb://")).map((x) => x.source.slice(6)));
  for (const rec of records) {
    if (used.has(rec.id) || !rec.blob) continue;
    const ext = imageExt(rec.mime || rec.blob.type, rec.name);
    const safeId = rec.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const target = `assets/uncommitted/${manifest.length}-${safeId}.${ext}`;
    entries.push({ name: target, data: await rec.blob.arrayBuffer() });
    manifest.push({
      case_id: null,
      source: `idb://${rec.id}`,
      target: `./${target}`,
      name: rec.name || null,
    });
  }
  const exportedAt = new Date().toISOString();
  entries.unshift(
    { name: "storyforge-v46-seed-travail.json", data: enc.encode(JSON.stringify(portable, null, 2)) },
    {
      name: "storyforge-v46-session.json",
      data: enc.encode(
        JSON.stringify(
          await createSession(seed, meta, mediaMeta, records),
          null,
          2,
        ),
      ),
    },
    {
      name: "integration-manifest.json",
      data: enc.encode(JSON.stringify({ exported_at: exportedAt, files: manifest }, null, 2)),
    },
  );
  return makeStoreZip(entries);
}
