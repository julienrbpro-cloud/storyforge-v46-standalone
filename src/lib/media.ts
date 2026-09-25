import { uid } from "./utils";
import { LS_PROJECTS } from "./constants";
import type { Seed } from "./types";

export function referencedMediaIds(seed: Seed): Set<string> {
  const refs = [
    ...seed.planches.flatMap((p) => p.cases.map((c) => c.image)),
    ...seed.personnages.map((p) => p.image),
    ...seed.gardiens.map((g) => g.image),
  ];
  return new Set(refs.filter((ref): ref is string => !!ref && ref.startsWith("idb://")).map((ref) => ref.slice(6)));
}

export function otherProjectMediaIds(): Set<string> {
  const ids = new Set<string>();
  try {
    const archive = JSON.parse(localStorage.getItem(LS_PROJECTS) || "null") as {
      activeId: string; projects: Array<{ id: string; seed: Seed }>;
    } | null;
    for (const project of archive?.projects || []) {
      if (project.id !== archive?.activeId) for (const id of referencedMediaIds(project.seed)) ids.add(id);
    }
  } catch { /* Legacy sessions have no project archive. */ }
  return ids;
}

export function activeProjectMedia(records: MediaRecord[], seed: Seed): MediaRecord[] {
  const other = otherProjectMediaIds();
  const current = referencedMediaIds(seed);
  return records.filter((record) => !other.has(record.id) || current.has(record.id));
}

const DB_NAME = "storyforge-v46-media";
const STORE = "media";

export interface MediaRecord {
  id: string;
  ownerType?: string;
  ownerId?: string;
  blob: Blob;
  mime?: string;
  name?: string;
  kind?: string;
  createdAt?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;
const urlCache = new Map<string, string>();

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

export async function dbPut(record: MediaRecord) {
  const db = await openDB();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function dbGet(id: string) {
  const db = await openDB();
  return new Promise<MediaRecord | undefined>((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).get(id);
    q.onsuccess = () => res(q.result as MediaRecord | undefined);
    q.onerror = () => rej(q.error);
  });
}

export async function dbDelete(id: string) {
  const db = await openDB();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function dbAll() {
  const db = await openDB();
  return new Promise<MediaRecord[]>((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).getAll();
    q.onsuccess = () => res((q.result as MediaRecord[]) || []);
    q.onerror = () => rej(q.error);
  });
}

export async function dbClear() {
  const db = await openDB();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/** Replace the media set in one transaction: an invalid write rolls back the clear too. */
export async function dbReplace(records: MediaRecord[]) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error || new Error("Restauration des images interrompue"));
    const store = tx.objectStore(STORE);
    try {
      store.clear();
      for (const record of records) store.put(record);
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
  revokeAllMediaUrls();
}

export async function mediaUrl(id: string) {
  if (urlCache.has(id)) return urlCache.get(id)!;
  const rec = await dbGet(id);
  if (!rec?.blob) return null;
  const u = URL.createObjectURL(rec.blob);
  urlCache.set(id, u);
  return u;
}

export function revokeMediaUrl(id: string) {
  const u = urlCache.get(id);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(id);
}

export function revokeAllMediaUrls() {
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
}

export async function resolveImageRef(ref: string | null | undefined) {
  if (!ref) return null;
  if (!String(ref).startsWith("idb://")) return ref;
  return mediaUrl(String(ref).slice(6));
}

export function dataUrlToBlob(data: string) {
  const match = data.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error("Image de sauvegarde invalide");
  const [, mime, body] = match;
  let bytes: string;
  try {
    bytes = atob(body);
  } catch {
    throw new Error("Image de sauvegarde invalide");
  }
  if (!bytes.length) throw new Error("Image de sauvegarde invalide");
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

export async function putImage(ownerType: string, ownerId: string, file: File) {
  if (!file.type.startsWith("image/") || !file.size) throw new Error("Choisis un fichier image non vide.");
  const mid = uid("image");
  await dbPut({
    id: mid,
    ownerType,
    ownerId,
    blob: file,
    mime: file.type || "application/octet-stream",
    name: file.name || "image",
    createdAt: new Date().toISOString(),
  });
  return `idb://${mid}`;
}

export async function putCaseImage(cid: string, file: File) {
  return putImage("case", cid, file);
}

export function imageExt(mime?: string, name = "") {
  const byMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  return byMime[mime || ""] || ((String(name).match(/\.([a-z0-9]+)$/i) || [])[1] || "img").toLowerCase();
}
