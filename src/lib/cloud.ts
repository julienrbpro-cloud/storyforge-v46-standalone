import { activeProjectMedia, blobToDataUrl, dbAll, imageExt, referencedMediaIds } from "./media";
import { useStudio } from "./store";
import type { MediaRecord } from "./media";

const URL_BASE = "https://zqwsqblhnhemamppaoss.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_K6yK_miV_uZKJDi7bDAZGA_pwDt3Rl8";
const BUCKET = "StoryForge-Image";
const AUTH_KEY = "storyforge.cloud.auth.v1";
const LINKS_KEY = "storyforge.cloud.links.v1";
const UPLOADS_KEY = "storyforge.cloud.uploads.v1";
export const CLOUD_EVENT = "storyforge:cloud-changed";

type AuthTokens = { access_token: string; refresh_token: string; expires_at: number };
type Link = { id: string; revision: number };
type MediaManifest = Omit<MediaRecord, "blob"> & { storage_path: string };
type CloudSnapshot = {
  format: "storyforge-cloud-v1";
  seed: unknown;
  meta: unknown;
  media_meta: unknown;
  media: MediaManifest[];
};
export type CloudProject = { id: string; title: string; revision: number; updated_at: string; snapshot?: CloudSnapshot };

function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CLOUD_EVENT));
}
function storageRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}
function sessionRead(): AuthTokens | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) as AuthTokens : null;
  } catch { return null; }
}
function sessionWrite(tokens: AuthTokens | null) {
  if (tokens) sessionStorage.setItem(AUTH_KEY, JSON.stringify(tokens));
  else sessionStorage.removeItem(AUTH_KEY);
  announce();
}
function saveTokens(response: { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number }) {
  if (!response.access_token || !response.refresh_token) throw new Error("Session Supabase incomplète");
  sessionWrite({
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: response.expires_at || Math.floor(Date.now() / 1000) + (response.expires_in || 3600),
  });
}
async function request(path: string, init: RequestInit = {}, accessToken?: string) {
  const headers = new Headers(init.headers);
  headers.set("apikey", PUBLISHABLE_KEY);
  if (accessToken) headers.set("Authorization", "Bearer " + accessToken);
  const response = await fetch(URL_BASE + path, { ...init, headers });
  if (!response.ok) {
    let msg = "Erreur Supabase (" + response.status + ")";
    try {
      const body = await response.json() as { msg?: string; error_description?: string; message?: string; error?: string };
      msg = body.msg || body.error_description || body.message || body.error || msg;
    } catch { /* Error has no JSON body. */ }
    throw new Error(msg);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) as unknown : null;
}
async function accessToken(): Promise<string> {
  const session = sessionRead();
  if (!session) throw new Error("Connecte-toi à Supabase.");
  if (session.expires_at > Date.now() / 1000 + 60) return session.access_token;
  try {
    const body = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }) as { access_token: string; refresh_token: string; expires_in: number };
    saveTokens(body);
    return body.access_token;
  } catch (error) {
    sessionWrite(null);
    throw error;
  }
}
export function cloudIsSignedIn() { return !!sessionRead(); }
export function cloudSignOut() { sessionWrite(null); }
export async function cloudSendLogin(email: string) {
  const redirect = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  await request("/auth/v1/otp?redirect_to=" + encodeURIComponent(redirect), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), create_user: true }),
  });
}
export async function cloudVerifyCode(email: string, code: string) {
  const response = await request("/auth/v1/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "email", email: email.trim(), token: code.trim() }),
  }) as { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number };
  saveTokens(response);
}
export function cloudConsumeLoginRedirect() {
  if (typeof window === "undefined" || !window.location.hash.includes("access_token=")) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("access_token");
  const refresh = params.get("refresh_token");
  if (!token || !refresh) return false;
  saveTokens({
    access_token: token, refresh_token: refresh,
    expires_in: Number(params.get("expires_in") || 3600),
  });
  // Remove access tokens from browser history immediately.
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  return true;
}
export async function cloudUser() {
  const token = await accessToken();
  const user = await request("/auth/v1/user", {}, token) as { id: string; email?: string };
  if (!user?.id) throw new Error("Identité Supabase indisponible.");
  return user;
}
function readLinks(): Record<string, Link> { return storageRead(LINKS_KEY, {}); }
export function cloudLink(localProjectId: string): Link | null { return readLinks()[localProjectId] || null; }
function saveLink(localProjectId: string, link: Link) {
  const links = readLinks();
  links[localProjectId] = link;
  localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  announce();
}
function readUploads(): Record<string, Record<string, string>> { return storageRead(UPLOADS_KEY, {}); }
function saveUpload(projectId: string, mediaId: string, fingerprint: string) {
  const cache = readUploads();
  (cache[projectId] ||= {})[mediaId] = fingerprint;
  localStorage.setItem(UPLOADS_KEY, JSON.stringify(cache));
}
function encodePath(path: string) { return path.split("/").map(encodeURIComponent).join("/"); }
async function rest(path: string, init: RequestInit = {}) {
  return request("/rest/v1/" + path, {
    ...init, headers: { "Content-Type": "application/json", ...init.headers },
  }, await accessToken());
}
async function uploadMedia(userId: string, projectId: string, records: MediaRecord[]) {
  const uploaded = readUploads()[projectId] || {};
  const entries: MediaManifest[] = [];
  for (const record of records) {
    const storagePath = userId + "/" + projectId + "/" + record.id + "." + imageExt(record.mime, record.name);
    const fingerprint = record.blob.size + ":" + record.blob.type + ":" + (record.createdAt || "");
    if (uploaded[record.id] !== fingerprint) {
      const token = await accessToken();
      await request("/storage/v1/object/" + encodeURIComponent(BUCKET) + "/" + encodePath(storagePath), {
        method: "POST",
        headers: { "Content-Type": record.mime || record.blob.type || "application/octet-stream", "x-upsert": "true" },
        body: record.blob,
      }, token);
      saveUpload(projectId, record.id, fingerprint);
    }
    const { blob: _blob, ...details } = record;
    void _blob;
    entries.push({ ...details, storage_path: storagePath });
  }
  return entries;
}
let running: Promise<void> | null = null;
let restoring = false;
export function cloudSyncInProgress() { return !!running || restoring; }

async function saveActiveProject() {
  if (restoring) return;
  const state = useStudio.getState();
  if (!state.ready || state.recoveryRequired) throw new Error("Une restauration locale est nécessaire avant la synchronisation.");
  state.persistNow();
  if (useStudio.getState().saveState === "error") throw new Error("Échec de la sauvegarde locale. Aucune synchronisation effectuée.");
  const localId = state.activeProjectId;
  // Immutable snapshot BEFORE awaiting asynchronous image uploads.
  const seed = structuredClone(state.seed);
  const meta = structuredClone(state.meta);
  const media_meta = structuredClone(state.mediaMeta);
  const records = activeProjectMedia(await dbAll(), seed);
  const available = new Set(records.map(r => r.id));
  for (const id of referencedMediaIds(seed)) {
    if (!available.has(id)) throw new Error("Image locale manquante (" + id + "). Le cloud n'a pas été modifié.");
  }
  const user = await cloudUser();
  const previous = cloudLink(localId);
  const cloudId = previous?.id || crypto.randomUUID();
  const media = await uploadMedia(user.id, cloudId, records);
  const snapshot: CloudSnapshot = { format: "storyforge-cloud-v1", seed, meta, media_meta, media };
  const title = seed.projet.titre;
  if (!previous) {
    const rows = await rest("storyforge_projects?select=id,revision", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ id: cloudId, title, snapshot }),
    }) as Array<{ id: string; revision: number }>;
    if (!rows?.[0]) throw new Error("La sauvegarde cloud n'a pas été confirmée.");
    saveLink(localId, rows[0]);
  } else {
    const rows = await rest("storyforge_projects?id=eq." + encodeURIComponent(previous.id) +
      "&revision=eq." + previous.revision + "&select=id,revision", {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ title, snapshot, revision: previous.revision + 1, updated_at: new Date().toISOString() }),
    }) as Array<{ id: string; revision: number }>;
    if (!rows?.[0]) throw new Error("Conflit : le projet cloud a changé sur un autre appareil. Charge sa version avant de réessayer.");
    saveLink(localId, rows[0]);
  }
  announce();
}
export function cloudSaveActiveProject(): Promise<void> {
  if (!running) {
    running = saveActiveProject().finally(() => { running = null; announce(); });
    announce();
  }
  return running;
}
export async function cloudListProjects(): Promise<CloudProject[]> {
  const rows = await rest("storyforge_projects?select=id,title,revision,updated_at&order=updated_at.desc");
  return rows as CloudProject[];
}
export async function cloudRestoreProject(cloudId: string) {
  if (running || restoring) throw new Error("Attends la fin de la synchronisation.");
  restoring = true;
  announce();
  try {
    const result = await rest("storyforge_projects?id=eq." + encodeURIComponent(cloudId) +
      "&select=id,title,revision,snapshot") as CloudProject[];
    const project = result?.[0];
    const snap = project?.snapshot;
    if (!project || snap?.format !== "storyforge-cloud-v1" || !Array.isArray(snap.media))
      throw new Error("Sauvegarde cloud absente ou incompatible.");
    const user = await cloudUser();
    const media: Array<Omit<MediaRecord, "blob"> & { data: string }> = [];
    for (const record of snap.media) {
      if (!record.storage_path.startsWith(user.id + "/" + project.id + "/"))
        throw new Error("Chemin d'image non autorisé.");
      const response = await fetch(URL_BASE + "/storage/v1/object/authenticated/" +
        encodeURIComponent(BUCKET) + "/" + encodePath(record.storage_path), {
          headers: { apikey: PUBLISHABLE_KEY, Authorization: "Bearer " + await accessToken() },
        });
      if (!response.ok) throw new Error("Impossible de récupérer l'image " + record.id);
      const { storage_path: _path, ...details } = record;
      void _path;
      media.push({ ...details, data: await blobToDataUrl(await response.blob()) });
    }
    // parseSession validates all image references before changing local state.
    const session = { seed: snap.seed, meta: snap.meta, media_meta: snap.media_meta, media };
    const localId = useStudio.getState().activeProjectId;
    await useStudio.getState().importSessionJson(session);
    saveLink(localId, { id: project.id, revision: project.revision });
  } finally {
    restoring = false;
    announce();
  }
}
