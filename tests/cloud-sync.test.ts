import assert from "node:assert/strict";
import { test } from "node:test";
import "fake-indexeddb/auto";
import { cloudSignInWithPassword, cloudSaveActiveProject, cloudSyncActiveProject, cloudRestoreProject, cloudLink, cloudUser, cloudListProjects, cloudIsSignedIn } from "../src/lib/cloud";
import { useStudio } from "../src/lib/store";
import { normalizeSeed, SEED_OFFICIEL, emptyMeta } from "../src/lib/seed";
import { dbPut, dbGet, dbReplace } from "../src/lib/media";
import { LS_PROJECTS } from "../src/lib/constants";

class MemoryStorage {
  items = new Map<string, string>();
  getItem(k: string) { return this.items.get(k) ?? null; }
  setItem(k: string, v: string) { this.items.set(k, v); }
  removeItem(k: string) { this.items.delete(k); }
}
class BlobReader {
  result: string | null = null;
  error = null;
  onload?: () => void;
  onerror?: () => void;
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then(bytes => { this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`; this.onload?.(); });
  }
}
Object.defineProperty(globalThis, "FileReader", { configurable: true, value: BlobReader });

test("bidirectional cloud sync preserves projects, media, concurrent edits and offline sessions", async () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new MemoryStorage() });
  const oldFetch = globalThis.fetch;
  const owner = "12345678-1234-4234-8234-123456789abc";
  let remote: any;
  let patchCount = 0, uploadCount = 0, refreshCount = 0;
  let offlineRefresh = false;
  let downloadGate: Promise<void> | null = null;
  let nextReadGate: { entered: () => void; wait: Promise<void> } | null = null;
  const files = new Map<string, Blob>();
  globalThis.fetch = async (resource, init) => {
    const url = new URL(String(resource));
    if (url.pathname.endsWith("/token")) {
      if (url.search.includes("refresh_token")) { refreshCount++; if (offlineRefresh) throw new TypeError("offline"); }
      return Response.json({ access_token: "access", refresh_token: "refresh-" + refreshCount, expires_in: 3600 });
    }
    if (url.pathname === "/auth/v1/user") return Response.json({ id: owner, email: "owner@example.com" });
    if (url.pathname.startsWith("/storage/v1/object/authenticated/")) {
      if (downloadGate) await downloadGate;
      const key = decodeURIComponent(url.pathname.replace("/authenticated/", "/"));
      return new Response(files.get(key), { status: files.has(key) ? 200 : 404 });
    }
    if (url.pathname.startsWith("/storage/v1/object/")) {
      uploadCount++; files.set(decodeURIComponent(url.pathname), init?.body as Blob);
      return Response.json({});
    }
    if (url.pathname === "/rest/v1/storyforge_projects") {
      if (init?.method === "POST") { remote = { ...JSON.parse(String(init.body)), revision: 1 }; return Response.json([remote]); }
      if (init?.method === "PATCH") {
        patchCount++;
        if (Number(url.searchParams.get("revision")?.slice(3)) !== remote.revision) return Response.json([]);
        remote = { ...remote, ...JSON.parse(String(init.body)) }; return Response.json([remote]);
      }
      const gate = nextReadGate; nextReadGate = null;
      if (gate) { gate.entered(); await gate.wait; }
      return Response.json(remote ? [structuredClone(remote)] : []);
    }
    throw new Error("Unexpected endpoint " + url.pathname);
  };
  try {
    await dbReplace([]);
    const seed = normalizeSeed(SEED_OFFICIEL);
    seed.personnages[0].image = "idb://image-original";
    await dbPut({ id: "image-original", blob: new Blob(["original bytes"], { type: "image/png" }), mime: "image/png" });
    await dbPut({ id: "other-project", blob: new Blob(["keep me"], { type: "image/png" }), mime: "image/png" });
    useStudio.setState({ ready: true, recoveryRequired: false, seed, meta: emptyMeta(), mediaMeta: {}, activeProjectId: "original", revision: 0, saveState: "saved", projects: [{ id: "original", title: seed.projet.titre }] });
    await cloudSignInWithPassword("owner@example.com", "password");
    await cloudSaveActiveProject();
    assert.equal(remote.revision, 1);
    assert.equal(uploadCount, 1);
    const originalCloudPath = remote.snapshot.media[0].storage_path;
    assert.match(originalCloudPath, /image-original-[0-9a-f]{64}\.png$/);
    await cloudSyncActiveProject();
    assert.equal(patchCount, 0, "Polling an unchanged project must not create revisions");
    useStudio.getState().setLibraryEntityField("personnage", seed.personnages[0].id, "nom", "Local edit");
    await cloudSyncActiveProject();
    assert.equal(remote.snapshot.seed.personnages[0].nom, "Local edit");
    assert.equal(uploadCount, 1, "Unchanged image bytes are uploaded only once");

    remote.snapshot.seed.personnages[0].nom = "Other browser";
    remote.revision++;
    useStudio.getState().setSelectedCase(useStudio.getState().seed.cases[0].id);
    useStudio.getState().setVisualPageIndex(2);
    await cloudSyncActiveProject();
    assert.equal(useStudio.getState().seed.personnages[0].nom, "Other browser", "A clean browser receives the newer cloud version");
    assert.equal(cloudLink("original")?.revision, remote.revision);
    assert.equal(useStudio.getState().selectedCaseId, seed.cases[0].id, "An automatic pull keeps the reader's open case");
    assert.equal(useStudio.getState().visualPageIndex, 2);
    assert.equal(await (await dbGet("other-project"))!.blob.text(), "keep me", "Cloud restore must not delete another project's media");
    const afterPull = remote.revision;
    await cloudSyncActiveProject();
    assert.equal(remote.revision, afterPull, "Pulling a project does not trigger a feedback upload");

    let entered!: () => void, releaseRead!: () => void;
    const reading = new Promise<void>(resolve => { entered = resolve; });
    nextReadGate = { entered, wait: new Promise<void>(resolve => { releaseRead = resolve; }) };
    const background = cloudSyncActiveProject();
    await reading;
    useStudio.getState().setLibraryEntityField("personnage", seed.personnages[0].id, "nom", "Manual save during polling");
    const manual = cloudSaveActiveProject();
    releaseRead(); await Promise.all([background, manual]);
    assert.equal(remote.snapshot.seed.personnages[0].nom, "Manual save during polling", "A background poll cannot swallow a manual save");

    useStudio.getState().setLibraryEntityField("personnage", seed.personnages[0].id, "nom", "Unsaved local conflict");
    remote.snapshot.seed.personnages[0].nom = "Remote conflict";
    remote.revision++;
    await assert.rejects(cloudSyncActiveProject, /Conflit/);
    assert.equal(useStudio.getState().seed.personnages[0].nom, "Unsaved local conflict");
    assert.equal(remote.snapshot.seed.personnages[0].nom, "Remote conflict");
    await cloudRestoreProject(remote.id);
    const archive = JSON.parse(localStorage.getItem(LS_PROJECTS)!);
    assert.ok(archive.projects.some((p: any) => p.seed.personnages[0].nom === "Unsaved local conflict"), "Opening the cloud conflict keeps a separate local copy");
    assert.equal(useStudio.getState().seed.personnages[0].nom, "Remote conflict");

    await dbPut({ id: "image-original", blob: new Blob(["edited bytes"], { type: "image/png" }), mime: "image/png" });
    await cloudSaveActiveProject();
    assert.notEqual(remote.snapshot.media[0].storage_path, originalCloudPath);
    assert.equal(await files.get("/storage/v1/object/StoryForge-Image/" + originalCloudPath)!.text(), "original bytes", "Changing image contents cannot replace a previous revision's image");

    remote.snapshot.seed.personnages[0].nom = "Download in progress"; remote.revision++;
    let release!: () => void;
    downloadGate = new Promise<void>(resolve => { release = resolve; });
    const pull = cloudSyncActiveProject();
    await new Promise(resolve => setTimeout(resolve, 30));
    useStudio.getState().setLibraryEntityField("personnage", seed.personnages[0].id, "nom", "Typed during download");
    release(); downloadGate = null;
    await assert.rejects(() => pull, /modifié le projet/);
    assert.equal(useStudio.getState().seed.personnages[0].nom, "Typed during download");

    const auth = JSON.parse(localStorage.getItem("storyforge.cloud.auth.v1")!);
    auth.expires_at = 1; localStorage.setItem("storyforge.cloud.auth.v1", JSON.stringify(auth));
    offlineRefresh = true;
    await assert.rejects(cloudUser, /momentanément inaccessible/);
    assert.equal(cloudIsSignedIn(), true, "Going offline must retain the refresh token");
    offlineRefresh = false;
    refreshCount = 0;
    await Promise.all([cloudUser(), cloudListProjects(), cloudUser()]);
    assert.equal(refreshCount, 1, "Concurrent authenticated calls must share one refresh");
  } finally { globalThis.fetch = oldFetch; await dbReplace([]); }
});
