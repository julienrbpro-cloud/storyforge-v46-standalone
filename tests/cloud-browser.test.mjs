import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.STORYFORGE_TEST_URL || "http://127.0.0.1:8080";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Run only against the local branch build");
assert.ok(process.env.STORYFORGE_CLOUD_QA_ACCOUNT, "A separately provisioned, disposable QA account is required");
const account = JSON.parse(await readFile(process.env.STORYFORGE_CLOUD_QA_ACCOUNT, "utf8"));
assert.match(account.email, /^storyforge-qa-[0-9a-f-]+@example\.test$/);
assert.equal(account.email, `storyforge-qa-${account.id}@example.test`);
const output = process.env.STORYFORGE_TEST_OUTPUT || "/workspace/screenshots/storyforge-cloud";
await mkdir(output, { recursive: true });
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=", "base64");
const browsers = [];
const pages = [];
const errors = [], authRequests = [], results = [];
const pass = (name) => { results.push(name); console.log("PASS " + name); };
async function fresh(width) {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.STORYFORGE_CHROMIUM ? { executablePath: process.env.STORYFORGE_CHROMIUM } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-zygote", "--single-process", "--disable-vulkan", "--ignore-certificate-errors"] });
  browsers.push(browser);
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  // Optional transport relay for sandboxes that block Chromium's external sockets.
  // Every response still comes from the real Supabase Auth/REST/Storage service.
  if (process.env.STORYFORGE_CLOUD_HTTP_RELAY === "1") {
    let offline = false;
    const setOffline = context.setOffline.bind(context);
    context.setOffline = async (value) => { offline = value; await setOffline(value); };
    await context.route("https://zqwsqblhnhemamppaoss.supabase.co/**", async route => {
      if (offline) { await route.abort("internetdisconnected"); return; }
      const request = route.request();
      const cors = { "access-control-allow-origin": new URL(base).origin,
        "access-control-allow-headers": "apikey,authorization,content-type,x-upsert,prefer",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
      if (request.method() === "OPTIONS") { await route.fulfill({ status: 204, headers: cors }); return; }
      const response = await fetch(request.url(), { method: request.method(), headers: request.headers(),
        body: request.postDataBuffer(), signal: AbortSignal.timeout(30000) });
      const headers = Object.fromEntries(response.headers);
      for (const key of ["content-encoding", "content-length", "transfer-encoding"]) delete headers[key];
      await route.fulfill({ status: response.status, headers: { ...headers, ...cors }, body: Buffer.from(await response.arrayBuffer()) });
    });
  }
  const page = await context.newPage(); pages.push(page); page.setDefaultTimeout(15000);
  page.on("pageerror", e => errors.push(e.message));
  page.on("requestfailed", r => { if (r.url().includes("supabase.co")) console.log("NETWORK", new URL(r.url()).pathname, r.failure()?.errorText); });
  page.on("request", r => { if (r.url().includes("/auth/v1/")) authRequests.push(new URL(r.url()).pathname); });
  page.on("dialog", d => d.accept());
  return { page, context };
}
const panel = page => page.getByRole("region", { name: "Sauvegarde cloud", exact: true });
async function login(page, password = account.password) {
  await page.goto(base + "/donnees", { waitUntil: "domcontentloaded" });
  await panel(page).getByLabel("Courriel StoryForge", { exact: true }).fill(account.email);
  await panel(page).getByLabel("Mot de passe StoryForge", { exact: true }).fill(password);
  await panel(page).getByRole("button", { name: "Se connecter", exact: true }).click();
  await panel(page).getByRole("button", { name: "Déconnexion", exact: true }).waitFor();
}
async function upload(page, button, name) {
  const chooser = page.waitForEvent("filechooser"); await button.click();
  await (await chooser).setFiles({ name, mimeType: "image/png", buffer: pixel });
}
async function waitSeed(page, field, expected) {
  await page.waitForFunction(({ field, expected }) => {
    const seed = JSON.parse(localStorage.getItem("sf46-seed") || "null");
    const actual = field === "caseTitle" ? seed?.cases?.[0]?.titre : seed?.personnages?.[0]?.[field];
    return actual === expected;
  }, { field, expected }, { timeout: 30000 });
}
async function mediaCount(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("storyforge-v46-media", 1);
    request.onsuccess = () => {
      const db = request.result, all = db.transaction("media").objectStore("media").getAll();
      all.onsuccess = () => { resolve(all.result.length); db.close(); }; all.onerror = () => reject(all.error);
    }; request.onerror = () => reject(request.error);
  }));
}
async function openCloud(page, title) {
  await page.goto(base + "/donnees");
  const row = panel(page).locator("div.rounded-lg").filter({ has: page.locator("span").filter({ hasText: title }) }).first();
  await row.getByRole("button", { name: "Ouvrir", exact: true }).click();
  await page.waitForFunction(title => JSON.parse(localStorage.getItem("sf46-seed"))?.projet.titre === title, title);
  await panel(page).getByText("Projet et images à jour", { exact: true }).waitFor();
}
try {
  const a = await fresh(1280), b = await fresh(390);
  await a.page.goto(base + "/");
  await a.page.getByRole("button", { name: "Mes sauvegardes cloud", exact: true }).click();
  await panel(a.page).getByLabel("Courriel StoryForge", { exact: true }).fill(account.email);
  await panel(a.page).getByLabel("Mot de passe StoryForge", { exact: true }).fill("wrong-password");
  await panel(a.page).getByRole("button", { name: "Se connecter", exact: true }).click();
  await panel(a.page).getByRole("alert").filter({ hasText: "Courriel ou mot de passe incorrect" }).waitFor();
  await login(a.page);
  pass("Home access, wrong-password error and real Supabase password sign-in without email");

  await a.page.goto(base + "/projet");
  await a.page.getByRole("button", { name: "Planche 1", exact: true }).click();
  await a.page.locator(".visual-grid button").first().click();
  const editor = a.page.getByRole("dialog", { name: "Case 1", exact: true });
  await editor.getByLabel("Titre", { exact: true }).fill("Cloud QA case");
  await editor.getByLabel("Note", { exact: true }).fill("Note conservée entre navigateurs");
  await upload(a.page, editor.getByRole("button", { name: "Remplacer l’image", exact: true }), "case.png");
  await editor.locator(".case-canvas img").evaluate(img => img.decode());
  await editor.getByRole("button", { name: "Fermer", exact: true }).click();
  await a.page.goto(base + "/bibliotheque");
  await upload(a.page, a.page.locator("#personnages article").first().getByRole("button", { name: "Remplacer l’image", exact: true }), "character.png");
  await a.page.getByText("Image de référence enregistrée", { exact: true }).waitFor();
  await upload(a.page, a.page.locator("#gardiens article").first().getByRole("button", { name: "Remplacer l’image", exact: true }), "guardian.png");
  await a.page.goto(base + "/donnees");
  await panel(a.page).getByRole("button", { name: "Sauvegarder maintenant", exact: true }).click();
  await panel(a.page).getByText("Projet et images sauvegardés", { exact: true }).waitFor();
  assert.equal(await mediaCount(a.page), 3);
  pass("Real cloud upload of manuscript, note, case image, character reference and guardian reference");

  await login(b.page);
  await openCloud(b.page, "Nous, malgré nous");
  await waitSeed(b.page, "caseTitle", "Cloud QA case");
  assert.equal(await mediaCount(b.page), 3);
  const archive = await b.page.evaluate(() => JSON.parse(localStorage.getItem("sf46-projects-v1")));
  assert.ok(archive.projects.some(p => p.id === "original"), "Opening a cloud project preserves the local project");
  await b.page.reload();
  await panel(b.page).getByRole("button", { name: "Déconnexion", exact: true }).waitFor();
  await b.page.goto(base + "/projet");
  await b.page.getByRole("button", { name: "Planche 1", exact: true }).click();
  await b.page.locator(".visual-grid button").first().click();
  const bEditor = b.page.getByRole("dialog", { name: "Case 1", exact: true });
  assert.equal(await bEditor.getByLabel("Titre", { exact: true }).inputValue(), "Cloud QA case");
  assert.equal(await bEditor.getByLabel("Note", { exact: true }).inputValue(), "Note conservée entre navigateurs");
  await bEditor.locator(".case-canvas img").evaluate(img => img.decode());
  await b.page.screenshot({ path: output + "/restored-case-mobile.png", fullPage: true });
  await bEditor.getByLabel("Titre", { exact: true }).fill("B vers A");
  await bEditor.getByRole("button", { name: "Fermer", exact: true }).click();
  await waitSeed(a.page, "caseTitle", "B vers A");
  pass("Fresh second browser restores images and notes; B changes automatically arrive in A");

  await a.page.goto(base + "/bibliotheque");
  await a.page.locator("#personnages article").first().getByLabel("Nom", { exact: true }).fill("A vers B");
  await waitSeed(b.page, "nom", "A vers B");
  await b.page.goto(base + "/bibliotheque");
  assert.equal(await b.page.locator("#personnages article").first().getByLabel("Nom", { exact: true }).inputValue(), "A vers B");
  for (const section of ["#personnages", "#gardiens"]) {
    const images = b.page.locator(section + " article img");
    assert.equal(await images.count(), section === "#personnages" ? 3 : 2, "Built-in references remain visible after cloud restoration");
    for (const img of await images.all()) await img.evaluate(img => img.decode());
  }
  assert.equal(await b.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await b.page.screenshot({ path: output + "/references-mobile.png", fullPage: true });
  pass("A changes automatically arrive in B; character and guardian images render on mobile");

  await a.page.goto(base + "/donnees");
  await panel(a.page).getByText("Changer mon mot de passe", { exact: true }).click();
  const newPassword = account.password + "-new";
  await panel(a.page).getByLabel("Nouveau mot de passe", { exact: true }).fill(newPassword);
  await panel(a.page).getByLabel("Confirmer le mot de passe", { exact: true }).fill(newPassword);
  await panel(a.page).getByRole("button", { name: "Enregistrer mon mot de passe", exact: true }).click();
  await panel(a.page).getByRole("alert").filter({ hasText: "Mot de passe enregistré" }).waitFor();
  account.password = newPassword;
  await writeFile(process.env.STORYFORGE_CLOUD_QA_ACCOUNT, JSON.stringify(account), { mode: 0o600 });
  await b.page.goto(base + "/donnees");
  // Supabase may revoke the other browser's session when the password changes.
  await b.page.waitForFunction(email => {
    const region = document.querySelector('[aria-label="Sauvegarde cloud"]');
    return region?.textContent?.includes("Se connecter") || region?.textContent?.includes(email);
  }, account.email);
  const signOut = panel(b.page).getByRole("button", { name: "Déconnexion", exact: true });
  if (await signOut.count()) await signOut.click();
  await panel(b.page).getByRole("button", { name: "Se connecter", exact: true }).waitFor();
  await login(b.page, newPassword);
  await signOut.click();
  await panel(b.page).getByRole("button", { name: "Se connecter", exact: true }).waitFor();
  await login(b.page, newPassword);
  pass("Real password change, server sign-out and sign-in from the second browser, without emails");

  await a.page.goto(base + "/bibliotheque");
  await a.context.setOffline(true);
  await a.page.locator("#personnages article").first().getByLabel("Description", { exact: true }).fill("Modification conservée hors ligne");
  await a.page.waitForFunction(() => JSON.parse(localStorage.getItem("sf46-seed"))?.personnages[0].note === "Modification conservée hors ligne");
  await a.page.waitForTimeout(2000);
  assert.ok(await a.page.evaluate(() => !!localStorage.getItem("storyforge.cloud.auth.v1")), "An outage must retain the login");
  await a.context.setOffline(false);
  await waitSeed(b.page, "note", "Modification conservée hors ligne");
  pass("Offline local edit remains saved and sync resumes when connectivity returns");

  await a.page.goto(base + "/");
  await a.page.getByRole("button", { name: "Nouveau projet", exact: true }).click();
  await a.page.getByRole("dialog").getByLabel("Nom du projet").fill("Deuxième projet QA");
  await a.page.getByRole("dialog").getByRole("button", { name: "Créer le projet", exact: true }).click();
  await a.page.goto(base + "/donnees");
  await panel(a.page).getByRole("button", { name: "Sauvegarder maintenant", exact: true }).click();
  await panel(a.page).getByText("Projet et images sauvegardés", { exact: true }).waitFor();
  await openCloud(b.page, "Deuxième projet QA");
  assert.equal(await mediaCount(b.page), 3, "Opening the second project preserves the first project's media");
  const projects = await b.page.evaluate(() => JSON.parse(localStorage.getItem("sf46-projects-v1")).projects);
  assert.ok(projects.some(p => p.seed.cases?.[0]?.titre === "B vers A"));
  assert.ok(projects.some(p => p.seed.projet.titre === "Deuxième projet QA"));
  await a.page.screenshot({ path: output + "/cloud-desktop.png", fullPage: true });
  pass("Multiple cloud projects can be opened without deleting existing projects or media");
  assert.ok(authRequests.every(path => !path.endsWith("/otp") && !path.endsWith("/verify") && !path.endsWith("/recover")));
  assert.deepEqual(errors, []);
  pass("No email/code endpoints or uncaught JavaScript errors in either browser");
  await writeFile(output + "/verdict.json", JSON.stringify({ passed: results.length, results, accountId: account.id, base, engines: "Two independent Chromium processes", transportRelay: process.env.STORYFORGE_CLOUD_HTTP_RELAY === "1", errors }, null, 2));
} catch (error) {
  for (let i = 0; i < pages.length; i++) if (!pages[i].isClosed()) {
    await pages[i].screenshot({ path: output + "/failure-" + i + ".png", fullPage: true }).catch(() => {});
    console.error("PAGE " + i, (await pages[i].locator("body").innerText().catch(() => "")).slice(-6000));
  }
  throw error;
} finally { await Promise.all(browsers.map(b => b.close())); }
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
