import assert from "node:assert/strict";
import { test } from "node:test";
import "fake-indexeddb/auto";
import { cloudLink, cloudSaveActiveProject, cloudVerifyCode } from "../src/lib/cloud";
import { useStudio } from "../src/lib/store";
import { SEED_OFFICIEL, normalizeSeed, emptyMeta } from "../src/lib/seed";
import { dbPut, dbReplace } from "../src/lib/media";
import { LS_SEED } from "../src/lib/constants";

class MemoryStorage {
  private contents = new Map<string, string>();
  getItem(key: string) { return this.contents.get(key) ?? null; }
  setItem(key: string, value: string) { this.contents.set(key, value); }
  removeItem(key: string) { this.contents.delete(key); }
  clear() { this.contents.clear(); }
}

test("cloud backup uploads images, preserves local data and rejects stale revisions", async () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new MemoryStorage() });
  await dbReplace([]);
  const seed = normalizeSeed(SEED_OFFICIEL);
  seed.personnages[0].image = "idb://unit-test-photo";
  await dbPut({ id: "unit-test-photo", blob: new Blob(["image bytes"], { type: "image/png" }), ownerType: "personnage",
    ownerId: seed.personnages[0].id, mime: "image/png", createdAt: "2026-10-08T00:00:00Z" });
  useStudio.setState({
    ready: true, recoveryRequired: false, seed, meta: emptyMeta(), mediaMeta: {},
    activeProjectId: "original", saveState: "saved",
  });
  const requests: Array<{ method: string; url: string; body: string }> = [];
  let nextRevision = 1;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (resource: string | URL | Request, init?: RequestInit) => {
    const url = String(resource);
    const method = init?.method || "GET";
    requests.push({ method, url, body: typeof init?.body === "string" ? init.body : "" });
    let response: unknown = {};
    if (url.includes("/auth/v1/verify")) response = { access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600 };
    else if (url.includes("/auth/v1/user")) response = { id: "12345678-1234-4234-8234-123456789abc", email: "owner@example.com" };
    else if (url.includes("/rest/v1/storyforge_projects")) {
      if (method === "POST") response = [{ id: JSON.parse(String(init?.body)).id, revision: 1 }];
      else if (method === "PATCH") response = nextRevision === 0 ? [] : [
        { id: url.match(/id=eq\.([^&]+)/)?.[1], revision: ++nextRevision },
      ];
    }
    return Response.json(response);
  };
  try {
    await cloudVerifyCode("owner@example.com", "123456");
    await cloudSaveActiveProject();
    assert.equal(cloudLink("original")?.revision, 1);
    assert.equal(requests.filter(x => x.url.includes("/storage/v1/object/")).length, 1);
    const create = requests.find(x => x.url.includes("/rest/v1/storyforge_projects") && x.method === "POST");
    assert.ok(create, "Cloud project must be inserted after images have uploaded");
    const snapshot = JSON.parse(create.body).snapshot;
    assert.equal(snapshot.media.length, 1);
    assert.equal(snapshot.media[0].id, "unit-test-photo");
    assert.equal(snapshot.seed.personnages[0].image, "idb://unit-test-photo");
    assert.ok(localStorage.getItem(LS_SEED), "Local manuscript must remain saved");
    await cloudSaveActiveProject();
    assert.equal(cloudLink("original")?.revision, 2);
    assert.equal(requests.filter(x => x.url.includes("/storage/v1/object/")).length, 1,
      "Unchanged images must not be uploaded again");
    nextRevision = 0;
    await assert.rejects(() => cloudSaveActiveProject(), /Conflit/);
    assert.equal(cloudLink("original")?.revision, 2, "Conflict must preserve the last acknowledged revision");
  } finally {
    globalThis.fetch = originalFetch;
    await dbReplace([]);
  }
});
