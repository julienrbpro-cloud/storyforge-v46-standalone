import { blobToDataUrl, dbAll, imageExt, referencedMediaIds, type MediaRecord } from "./media";
import { parseSession } from "./session";
import { useStudio } from "./store";
import { LS_PROJECTS } from "./constants";
import { storyCases } from "./sequence";
import type { Seed } from "./types";

const URL_BASE = "https://zqwsqblhnhemamppaoss.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_K6yK_miV_uZKJDi7bDAZGA_pwDt3Rl8";
const BUCKET = "StoryForge-Image";
const AUTH_KEY = "storyforge.cloud.auth.v1";
const LINKS_KEY = "storyforge.cloud.links.v1";
const UPLOADS_KEY = "storyforge.cloud.uploads.v1";
export const CLOUD_EVENT = "storyforge:cloud-changed";

type AuthTokens = { access_token: string; refresh_token: string; expires_at: number };
type TokenResponse = { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number };
type Link = { id: string; revision: number; ownerId?: string; baseline?: string };
type MediaManifest = Omit<MediaRecord, "blob"> & { storage_path: string; content_sha256?: string };
type CloudSnapshot = { format: "storyforge-cloud-v1"; seed: unknown; meta: unknown; media_meta: unknown; media: MediaManifest[] };
export type CloudProject = { id: string; title: string; revision: number; updated_at: string; snapshot?: CloudSnapshot };
export type CloudStatus = { state: "idle" | "syncing" | "synced" | "error" | "conflict"; message: string };
const statuses = new Map<string, CloudStatus>();
const refreshes = new Map<string, Promise<string>>();
let running: Promise<void> | null = null;

class CloudError extends Error {
  constructor(message: string, public status: number, public code = "") { super(message); }
}
function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CLOUD_EVENT));
}
function status(localId: string, value: CloudStatus) {
  if (JSON.stringify(statuses.get(localId)) === JSON.stringify(value)) return;
  statuses.set(localId, value); announce();
}
export function cloudStatus(localId: string): CloudStatus {
  return statuses.get(localId) || { state: "idle", message: "" };
}
function storageRead<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
}
function sessionRead(): AuthTokens | null {
  const s = storageRead<AuthTokens | null>(AUTH_KEY, null);
  return s && typeof s.access_token === "string" && typeof s.refresh_token === "string" &&
    Number.isFinite(s.expires_at) ? s : null;
}
function sessionWrite(tokens: AuthTokens | null) {
  if (tokens) localStorage.setItem(AUTH_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(AUTH_KEY);
  announce();
}
function saveTokens(response: TokenResponse) {
  if (!response?.access_token || !response.refresh_token) throw new Error("Session cloud incomplète. Réessaie la connexion.");
  sessionWrite({ access_token: response.access_token, refresh_token: response.refresh_token,
    expires_at: response.expires_at || Math.floor(Date.now() / 1000) + (response.expires_in || 3600) });
}
async function responseError(response: Response): Promise<CloudError> {
  let message = "Erreur cloud (" + response.status + ")";
  let code = "";
  try {
    const body = await response.json() as { msg?: string; error_description?: string; message?: string; error?: string; error_code?: string; code?: string };
    message = body.msg || body.error_description || body.message || body.error || message;
    code = body.error_code || body.code || body.error || "";
  } catch { /* Response is not JSON. */ }
  if (code === "invalid_credentials") message = "Courriel ou mot de passe incorrect. Utilise le mot de passe de ton compte StoryForge.";
  if (code === "email_not_confirmed") message = "Ce compte StoryForge n’est pas encore activé.";
  if (response.status === 429) message = "Trop de tentatives rapprochées. Attends un moment avant de réessayer.";
  return new CloudError(message, response.status, code);
}
async function cloudFetch(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  headers.set("apikey", PUBLISHABLE_KEY);
  if (token) headers.set("Authorization", "Bearer " + token);
  try {
    const response = await fetch(URL_BASE + path, { ...init, headers, signal: init.signal || AbortSignal.timeout(30000) });
    if (!response.ok) throw await responseError(response);
    return response;
  } catch (error) {
    if (error instanceof CloudError) throw error;
    throw new Error("Le cloud est momentanément inaccessible. Tes données locales et ta connexion sont conservées.");
  }
}
async function request(path: string, init: RequestInit = {}, token?: string): Promise<unknown> {
  const response = await cloudFetch(path, init, token);
  const body = response.status === 204 ? "" : await response.text();
  return body ? JSON.parse(body) as unknown : null;
}
async function accessToken(): Promise<string> {
  const session = sessionRead();
  if (!session) throw new Error("Connecte-toi à ton compte StoryForge.");
  if (session.expires_at > Date.now() / 1000 + 60) return session.access_token;
  const existing = refreshes.get(session.refresh_token);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const body = await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      }) as TokenResponse;
      if (sessionRead()?.refresh_token !== session.refresh_token)
        throw new Error("La connexion a changé pendant la synchronisation. Réessaie.");
      saveTokens(body);
      return body.access_token;
    } catch (error) {
      // A network outage must not discard a reusable login. Only an invalid session does.
      if (error instanceof CloudError && [400, 401, 403].includes(error.status) &&
          sessionRead()?.refresh_token === session.refresh_token) sessionWrite(null);
      throw error;
    } finally { refreshes.delete(session.refresh_token); }
  })();
  refreshes.set(session.refresh_token, promise);
  return promise;
}
export async function cloudSetPassword(password: string): Promise<void> {
  if (password.length < 6) throw new Error("Utilise au moins 6 caractères.");
  await request("/auth/v1/user", { method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }) }, await accessToken());
}
export async function cloudSignInWithPassword(email: string, password: string): Promise<void> {
  email = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password)
    throw new Error("Entre ton courriel et ton mot de passe StoryForge.");
  const tokens = await request("/auth/v1/token?grant_type=password", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  }) as TokenResponse;
  saveTokens(tokens);
}
export function cloudIsSignedIn() { return !!sessionRead(); }
export function cloudSignOut(): Promise<void> {
  const token = sessionRead()?.access_token;
  sessionWrite(null); statuses.clear(); announce();
  return token ? request("/auth/v1/logout?scope=local", { method: "POST" }, token).then(() => {}, () => {}) : Promise.resolve();
}
/** Accept old login redirects for compatibility; the interface no longer sends email links. */
export function cloudConsumeLoginRedirect() {
  if (typeof window === "undefined" || !window.location.hash.includes("access_token=")) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("access_token"), refresh = params.get("refresh_token");
  if (!token || !refresh) return false;
  saveTokens({ access_token: token, refresh_token: refresh, expires_in: Number(params.get("expires_in") || 3600) });
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  return true;
}
export async function cloudUser() {
  const token = await accessToken();
  let user: { id: string; email?: string };
  try { user = await request("/auth/v1/user", {}, token) as { id: string; email?: string }; }
  catch (error) {
    if (error instanceof CloudError && [401, 403].includes(error.status) && sessionRead()?.access_token === token) {
      sessionWrite(null);
      throw new Error("Ta connexion a expiré. Reconnecte-toi ; tes projets locaux sont conservés.");
    }
    throw error;
  }
  if (!user?.id) throw new Error("Identité cloud indisponible.");
  return user;
}
function readLinks(): Record<string, Link> { return storageRead(LINKS_KEY, {}); }
export function cloudLink(localId: string): Link | null { return readLinks()[localId] || null; }
function saveLink(localId: string, link: Link) {
  const links = readLinks(); links[localId] = link;
  localStorage.setItem(LINKS_KEY, JSON.stringify(links)); announce();
}
function encodePath(path: string) { return path.split("/").map(encodeURIComponent).join("/"); }
async function sha256(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function mediaFingerprint(blob: Blob) { return sha256(await blob.arrayBuffer()); }
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}
async function fingerprint(seed: unknown, meta: unknown, media_meta: unknown, records: MediaRecord[]) {
  const media = await Promise.all(records.map(async ({ blob, ...record }) => ({ ...record, hash: await mediaFingerprint(blob) })));
  media.sort((a, b) => a.id.localeCompare(b.id));
  return sha256(new TextEncoder().encode(JSON.stringify(stable({ seed, meta, media_meta, media }))));
}
async function capture() {
  const state = useStudio.getState();
  if (!state.ready || state.recoveryRequired) throw new Error("Restaure d’abord ta sauvegarde locale. Le cloud est conservé.");
  state.persistNow();
  if (useStudio.getState().saveState === "error") throw new Error("Échec de la sauvegarde locale. Le cloud est conservé.");
  const seed = structuredClone(state.seed), meta = structuredClone(state.meta), media_meta = structuredClone(state.mediaMeta);
  const referenced = referencedMediaIds(seed);
  const records = (await dbAll()).filter(r => referenced.has(r.id));
  if (records.length !== referenced.size) throw new Error("Une image locale manque. Le cloud n’a pas été modifié.");
  return { localId: state.activeProjectId, revision: state.revision, seed, meta, media_meta, records,
    baseline: await fingerprint(seed, meta, media_meta, records) };
}
async function rest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set("Content-Type", "application/json");
  return request("/rest/v1/" + path, { ...init, headers }, await accessToken());
}
async function uploadMedia(userId: string, projectId: string, records: MediaRecord[]) {
  const entries: MediaManifest[] = [];
  const cache = storageRead<Record<string, Record<string, string>>>(UPLOADS_KEY, {});
  for (const { blob, ...record } of records) {
    const hash = await mediaFingerprint(blob);
    // Immutable objects: a stale browser can never replace an image from the current cloud revision.
    const path = userId + "/" + projectId + "/" + record.id + "-" + hash + "." + imageExt(record.mime, record.name);
    if (cache[projectId]?.[path] !== hash) {
      await request("/storage/v1/object/" + encodeURIComponent(BUCKET) + "/" + encodePath(path), {
        method: "POST", headers: { "Content-Type": record.mime || blob.type || "application/octet-stream", "x-upsert": "true" }, body: blob,
      }, await accessToken());
      (cache[projectId] ||= {})[path] = hash;
      localStorage.setItem(UPLOADS_KEY, JSON.stringify(cache));
    }
    entries.push({ ...record, storage_path: path, content_sha256: hash });
  }
  return entries;
}
export function cloudSyncInProgress() { return !!running; }
function operation(action: () => Promise<void>): Promise<void> {
  if (running) return running;
  const localId = useStudio.getState().activeProjectId;
  status(localId, { state: "syncing", message: "Synchronisation en cours…" });
  running = action().catch((error: Error) => {
    status(localId, { state: error.message.startsWith("Conflit") ? "conflict" : "error", message: error.message });
    throw error;
  }).finally(() => {
    running = null;
    if (useStudio.getState().activeProjectId !== localId && cloudStatus(localId).state === "syncing")
      status(localId, { state: "idle", message: "" });
    announce();
  });
  announce();
  return running;
}
async function manualOperation(action: () => Promise<void>): Promise<void> {
  // A user action must run even if a background poll started just before the click.
  while (running) { try { await running; } catch { /* The requested action can resolve the prior error. */ } }
  return operation(action);
}
async function remoteProject(id: string, includeSnapshot = false) {
  const rows = await rest("storyforge_projects?id=eq." + encodeURIComponent(id) +
    "&select=id,title,revision,updated_at" + (includeSnapshot ? ",snapshot" : "")) as CloudProject[];
  if (!rows?.[0]) throw new Error("Ce projet cloud n’est pas accessible depuis ce compte. Tes données locales sont conservées.");
  return rows[0];
}
async function download(project: CloudProject, userId: string) {
  const snap = project.snapshot;
  if (snap?.format !== "storyforge-cloud-v1" || !Array.isArray(snap.media)) throw new Error("Sauvegarde cloud incompatible. Tes projets locaux sont conservés.");
  const media = [];
  for (const record of snap.media) {
    if (!record.storage_path?.startsWith(userId + "/" + project.id + "/")) throw new Error("Chemin d’image non autorisé.");
    const response = await cloudFetch("/storage/v1/object/authenticated/" + encodeURIComponent(BUCKET) + "/" + encodePath(record.storage_path), {}, await accessToken());
    const blob = await response.blob();
    if (record.content_sha256 && await mediaFingerprint(blob) !== record.content_sha256) throw new Error("Image cloud incomplète. Tes projets locaux sont conservés.");
    const { storage_path: _path, content_sha256: _hash, ...details } = record;
    void _path; void _hash;
    media.push({ ...details, data: await blobToDataUrl(blob) });
  }
  return parseSession({ seed: snap.seed, meta: snap.meta, media_meta: snap.media_meta, media });
}
async function applyDownloaded(project: CloudProject, userId: string, localId: string, expected: { activeId: string; revision: number; keepView?: boolean }, keepExisting = false) {
  const restored = await download(project, userId);
  const existing = new Map((await dbAll()).map(r => [r.id, r]));
  // Old backups may share IDs with a different local project. Retain both images.
  for (const record of restored.records) {
    const old = existing.get(record.id);
    if (old && await mediaFingerprint(old.blob) !== await mediaFingerprint(record.blob)) {
      const id = record.id + "-cloud-" + (await mediaFingerprint(record.blob)).slice(0,16);
      const from = "idb://" + record.id, to = "idb://" + id;
      for (const entity of [...storyCases(restored.seed), ...restored.seed.personnages, ...restored.seed.gardiens]) if (entity.image === from) entity.image = to;
      record.id = id;
    }
  }
  if (await cloudUser().then(u => u.id) !== userId) throw new Error("Le compte cloud a changé. Tes projets locaux sont conservés.");
  const session = { seed: restored.seed, meta: restored.meta, media_meta: restored.mediaMeta,
    media: await Promise.all(restored.records.map(async ({ blob, ...r }) => ({ ...r, data: await blobToDataUrl(blob) }))) };
  await useStudio.getState().importCloudSession(session, localId, { ...expected, keepExisting });
  const state = useStudio.getState();
  const baseline = await fingerprint(structuredClone(state.seed), structuredClone(state.meta), structuredClone(state.mediaMeta), restored.records);
  saveLink(localId, { id: project.id, revision: project.revision, ownerId: userId, baseline });
  status(localId, { state: "synced", message: "Projet et images à jour" });
}
async function syncActive(create: boolean, asCopy = false) {
  const local = await capture();
  const previous = asCopy ? null : cloudLink(local.localId);
  if (!previous && !create) return;
  const user = await cloudUser();
  if (previous?.ownerId && previous.ownerId !== user.id) throw new Error("Ce projet est lié à un autre compte cloud.");
  if (previous) {
    const remote = await remoteProject(previous.id);
    if (remote.revision !== previous.revision) {
      if (previous.baseline && local.baseline === previous.baseline) {
        await applyDownloaded(await remoteProject(previous.id, true), user.id, local.localId,
          { activeId: local.localId, revision: local.revision, keepView: true });
        return;
      }
      throw new Error("Conflit : des modifications existent sur deux appareils. Ouvre la version cloud pour conserver aussi une copie de tes changements locaux, ou sauvegarde ta version comme autre projet.");
    }
    if (previous.baseline === local.baseline) { status(local.localId, { state: "synced", message: "Projet et images à jour" }); return; }
  }
  const id = previous?.id || crypto.randomUUID();
  const media = await uploadMedia(user.id, id, local.records);
  if (await cloudUser().then(u => u.id) !== user.id) throw new Error("Le compte cloud a changé. Le projet n’a pas été envoyé.");
  const snapshot: CloudSnapshot = { format: "storyforge-cloud-v1", seed: local.seed, meta: local.meta, media_meta: local.media_meta, media };
  const rows = await rest(previous ? "storyforge_projects?id=eq." + encodeURIComponent(id) + "&revision=eq." + previous.revision + "&select=id,revision" : "storyforge_projects?select=id,revision", {
    method: previous ? "PATCH" : "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...(previous ? { revision: previous.revision + 1, updated_at: new Date().toISOString() } : { id }), title: local.seed.projet.titre, snapshot }),
  }) as Array<{ id: string; revision: number }>;
  if (!rows?.[0]) throw new Error("Conflit : le projet a changé pendant l’envoi. Tes modifications locales sont conservées. Ouvre la version cloud pour garder les deux copies.");
  saveLink(local.localId, { ...rows[0], ownerId: user.id, baseline: local.baseline });
  status(local.localId, { state: "synced", message: "Projet et images sauvegardés" });
}
export function cloudSaveActiveProject(): Promise<void> { return manualOperation(() => syncActive(true)); }
export function cloudSyncActiveProject(): Promise<void> { return operation(() => syncActive(false)); }
export function cloudSaveActiveProjectAsCopy(): Promise<void> { return manualOperation(() => syncActive(true, true)); }
export async function cloudListProjects(): Promise<CloudProject[]> {
  return await rest("storyforge_projects?select=id,title,revision,updated_at&order=updated_at.desc") as CloudProject[];
}
export function cloudRestoreProject(cloudId: string): Promise<void> {
  return manualOperation(async () => {
    const state = useStudio.getState();
    const expected = { activeId: state.activeProjectId, revision: state.revision };
    const user = await cloudUser();
    const project = await remoteProject(cloudId, true);
    const match = Object.entries(readLinks()).find(([, l]) => l.id === cloudId && (!l.ownerId || l.ownerId === user.id));
    const localId = match?.[0] || "cloud-" + cloudId;
    let keepExisting = false;
    if (match) {
      if (localId === state.activeProjectId) keepExisting = (await capture()).baseline !== match[1].baseline;
      else {
        const archive = storageRead<{ projects: Array<{ id: string; seed: Seed; meta: unknown; mediaMeta: unknown }> }>(LS_PROJECTS, { projects: [] });
        const old = archive.projects.find(p => p.id === localId);
        if (old) {
          const ids = referencedMediaIds(old.seed);
          keepExisting = await fingerprint(old.seed, old.meta, old.mediaMeta, (await dbAll()).filter(r => ids.has(r.id))) !== match[1].baseline;
        }
      }
    }
    await applyDownloaded(project, user.id, localId, expected, keepExisting);
  });
}
