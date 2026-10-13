import assert from "node:assert/strict";
import { test } from "node:test";
import "fake-indexeddb/auto";
import { cloudLink, cloudRestoreProject, cloudSaveActiveProject, cloudSignInWithPassword, cloudSyncActiveProject } from "../src/lib/cloud";
import { useStudio } from "../src/lib/store";
import { emptyMeta, normalizeSeed, SEED_OFFICIEL } from "../src/lib/seed";
import { dbReplace } from "../src/lib/media";
import { LS_PROJECTS } from "../src/lib/constants";

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) { this.items.set(key, value); }
  removeItem(key: string) { this.items.delete(key); }
}

function resetStudio() {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new MemoryStorage() });
  const seed = normalizeSeed(SEED_OFFICIEL);
  useStudio.setState({ seed, meta: emptyMeta(), mediaMeta: {}, ready: true, recoveryRequired: false,
    activeProjectId: "original", revision: 0, saveState: "saved", projects: [{ id: "original", title: seed.projet.titre }] });
  return seed;
}

function cloudServer() {
  const rows = new Map<string, any>();
  let loseCreateReply = false;
  let loseUpdateReply = false;
  let failCreate = false;
  const owner = "12345678-1234-4234-8234-123456789abc";
  const fetch: typeof globalThis.fetch = async (resource, init) => {
    const url = new URL(String(resource));
    if (url.pathname.endsWith("/token")) return Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600 });
    if (url.pathname === "/auth/v1/user") return Response.json({ id: owner });
    assert.equal(url.pathname, "/rest/v1/storyforge_projects");
    const id = url.searchParams.get("id")?.slice(3);
    if (init?.method === "POST") {
      if (failCreate) { failCreate = false; throw new TypeError("Offline before the database committed"); }
      const row = { ...JSON.parse(String(init.body)), revision: 1 };
      if (rows.has(row.id)) return Response.json({ code: "23505" }, { status: 409 });
      rows.set(row.id, row);
      if (loseCreateReply) { loseCreateReply = false; throw new TypeError("Reply lost after the database committed"); }
      return Response.json([row]);
    }
    if (init?.method === "PATCH") {
      const row = rows.get(id!);
      if (!row || Number(url.searchParams.get("revision")?.slice(3)) !== row.revision) return Response.json([]);
      const next = { ...row, ...JSON.parse(String(init.body)) };
      rows.set(id!, next);
      if (loseUpdateReply) { loseUpdateReply = false; throw new TypeError("Reply lost after the update committed"); }
      return Response.json([next]);
    }
    return Response.json(id ? (rows.has(id) ? [structuredClone(rows.get(id))] : []) : [...rows.values()]);
  };
  return { rows, fetch, loseNextCreateReply() { loseCreateReply = true; },
    loseNextUpdateReply() { loseUpdateReply = true; }, failNextCreate() { failCreate = true; } };
}

test("retry after a committed cloud create loses its reply does not duplicate the project", async () => {
  await dbReplace([]);
  const seed = resetStudio(), server = cloudServer(), originalFetch = globalThis.fetch;
  globalThis.fetch = server.fetch;
  try {
    await cloudSignInWithPassword("qa@example.com", "password");
    server.loseNextCreateReply();
    await assert.rejects(cloudSaveActiveProject, /momentanément inaccessible/);
    assert.equal(server.rows.size, 1);
    useStudio.getState().setLibraryEntityField("personnage", seed.personnages[0].id, "nom", "Edited after the lost reply");
    await cloudSaveActiveProject();
    assert.equal(server.rows.size, 1, "Retry must reuse the original remote project ID");
    const row = [...server.rows.values()][0];
    assert.equal(row.snapshot.seed.personnages[0].nom, "Edited after the lost reply");
    assert.equal(cloudLink("original")?.revision, row.revision);
    await cloudSyncActiveProject();
    assert.equal(server.rows.size, 1);
  } finally { globalThis.fetch = originalFetch; await dbReplace([]); }
});

test("a lost update reply is acknowledged without a false conflict or an extra revision", async () => {
  await dbReplace([]);
  const seed = resetStudio(), server = cloudServer(), originalFetch = globalThis.fetch;
  globalThis.fetch = server.fetch;
  try {
    await cloudSignInWithPassword("qa@example.com", "password");
    await cloudSaveActiveProject();
    const id = cloudLink("original")!.id;
    useStudio.getState().setLibraryEntityField("personnage", seed.personnages[0].id, "nom", "Committed update");
    server.loseNextUpdateReply();
    await assert.rejects(cloudSaveActiveProject, /momentanément inaccessible/);
    const revision = server.rows.get(id).revision;
    await cloudSyncActiveProject();
    assert.equal(cloudLink("original")?.revision, revision);
    assert.equal(server.rows.get(id).revision, revision);
    useStudio.getState().setLibraryEntityField("personnage", seed.personnages[0].id, "nom", "Another committed update");
    server.loseNextUpdateReply();
    await assert.rejects(cloudSaveActiveProject, /momentanément inaccessible/);
    useStudio.getState().setLibraryEntityField("personnage", seed.personnages[0].id, "nom", "Typed before retrying");
    await cloudSyncActiveProject();
    assert.equal(server.rows.get(id).snapshot.seed.personnages[0].nom, "Typed before retrying");
  } finally { globalThis.fetch = originalFetch; await dbReplace([]); }
});

test("an interrupted creation retries before commit but preserves a conflicting committed version", async () => {
  await dbReplace([]);
  const seed = resetStudio(), server = cloudServer(), originalFetch = globalThis.fetch;
  globalThis.fetch = server.fetch;
  try {
    await cloudSignInWithPassword("qa@example.com", "password");
    server.failNextCreate();
    await assert.rejects(cloudSaveActiveProject, /momentanément inaccessible/);
    assert.equal(server.rows.size, 0);
    await cloudSyncActiveProject();
    assert.equal(server.rows.size, 1);
    localStorage.removeItem("storyforge.cloud.links.v1");
    server.loseNextCreateReply();
    await assert.rejects(cloudSaveActiveProject, /momentanément inaccessible/);
    const pending = cloudLink("original")!;
    server.rows.get(pending.id).snapshot.seed.personnages[0].nom = "Different remote work";
    await assert.rejects(cloudSyncActiveProject, /Conflit/);
    const localName = useStudio.getState().seed.personnages[0].nom;
    await cloudRestoreProject(pending.id);
    const archive = JSON.parse(localStorage.getItem(LS_PROJECTS)!);
    assert.ok(archive.projects.some((p: any) => p.id !== "original" && p.seed.personnages[0].nom === localName));
    assert.equal(useStudio.getState().seed.personnages[0].nom, "Different remote work");
    assert.equal(seed.personnages[0].nom, localName);
  } finally { globalThis.fetch = originalFetch; await dbReplace([]); }
});

test("restoring after losing a cloud link keeps a changed local copy and avoids copying identical data", async () => {
  await dbReplace([]);
  const seed = resetStudio(), server = cloudServer(), originalFetch = globalThis.fetch;
  globalThis.fetch = server.fetch;
  try {
    await cloudSignInWithPassword("qa@example.com", "password");
    await cloudSaveActiveProject();
    const id = cloudLink("original")!.id;
    localStorage.removeItem("storyforge.cloud.links.v1");
    await cloudRestoreProject(id);
    assert.equal(useStudio.getState().activeProjectId, "cloud-" + id);
    const count = useStudio.getState().projects.length;
    localStorage.removeItem("storyforge.cloud.links.v1");
    await cloudRestoreProject(id);
    assert.equal(useStudio.getState().projects.length, count, "Identical restored data needs no extra local copy");
    const remoteName = useStudio.getState().seed.personnages[0].nom;
    useStudio.getState().setLibraryEntityField("personnage", seed.personnages[0].id, "nom", "Unsynced local work");
    localStorage.removeItem("storyforge.cloud.links.v1");
    await cloudRestoreProject(id);
    const archive = JSON.parse(localStorage.getItem(LS_PROJECTS)!);
    assert.ok(archive.projects.some((p: any) => p.seed.personnages[0].nom === "Unsynced local work"), "A lost link must not cause local work to be overwritten");
    assert.equal(useStudio.getState().seed.personnages[0].nom, remoteName);
  } finally { globalThis.fetch = originalFetch; await dbReplace([]); }
});
