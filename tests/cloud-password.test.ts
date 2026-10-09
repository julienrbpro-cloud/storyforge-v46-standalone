import assert from "node:assert/strict";
import { test } from "node:test";
import { cloudIsSignedIn, cloudSetPassword, cloudSignInWithPassword, cloudSignOut } from "../src/lib/cloud";

class MemoryStorage {
  private entries = new Map<string, string>();
  getItem(key: string) { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string) { this.entries.set(key, value); }
  removeItem(key: string) { this.entries.delete(key); }
}

test("password sign-in and setup need no OTP, email delivery or redirect", async () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new MemoryStorage() });
  const requests: { url: string; method: string; body: unknown }[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (resource: string | URL | Request, options?: RequestInit) => {
    const url = String(resource);
    requests.push({ url, method: options?.method || "GET",
      body: typeof options?.body === "string" ? JSON.parse(options.body) : null });
    if (url.includes("grant_type=password"))
      return Response.json({ access_token: "token", refresh_token: "refresh", expires_in: 3600 });
    if (url.endsWith("/auth/v1/user") && options?.method === "PUT")
      return Response.json({ id: "test-user" });
    if (url.includes("/auth/v1/logout")) return new Response(null, { status: 204 });
    throw new Error("Unexpected Auth endpoint");
  };
  try {
    assert.equal(cloudIsSignedIn(), false);
    await cloudSignInWithPassword(" writer@example.com ", "example-password");
    assert.equal(cloudIsSignedIn(), true);
    assert.equal(requests[0].method, "POST");
    assert.equal((requests[0].body as { email: string }).email, "writer@example.com");
    await cloudSetPassword("new-password");
    assert.equal(requests[1].method, "PUT");
    assert.equal((requests[1].body as { password: string }).password, "new-password");
    await assert.rejects(() => cloudSetPassword("123"), /6 caractères/);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(r => !r.url.includes("/otp") && !r.url.includes("/verify")));
    await cloudSignOut();
    assert.equal(cloudIsSignedIn(), false);
  } finally {
    globalThis.fetch = previous;
  }
});
