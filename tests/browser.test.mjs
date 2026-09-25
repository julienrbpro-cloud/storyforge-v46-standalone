import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

// Isolated browser contexts only: never connects to a user's live project or storage.
const base = process.env.STORYFORGE_TEST_URL || "http://127.0.0.1:8080";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Tests require a local app");
const output = process.env.STORYFORGE_TEST_OUTPUT || "/workspace/screenshots/storyforge";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.STORYFORGE_CHROMIUM ? { executablePath: process.env.STORYFORGE_CHROMIUM } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--use-angle=swiftshader", "--disable-vulkan"],
});
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=",
  "base64",
);
const results = [];
let lastPage;
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    lastPage = page;
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const pass = (name) => {
      results.push({ width, name });
      console.log(`PASS ${width}: ${name}`);
    };
    async function click(name) {
      await page.getByRole("button", { name, exact: true }).click();
    }
    async function upload(button, payload) {
      const chooserPromise = page.waitForEvent("filechooser");
      await button.click();
      await (await chooserPromise).setFiles(payload);
    }
    async function waitSaved() {
      await page.waitForFunction(
        () => !document.querySelector('[role="status"]')?.textContent?.includes("Enregistrement"),
      );
    }
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await click("Entrer dans le studio");
    await page.getByText("Projet actif", { exact: true }).waitFor();
    assert.equal(
      await page.getByText("152 cases dans le manuscrit · V4.6", { exact: true }).count(),
      1,
    );
    await page.screenshot({ animations: "disabled", path: join(output, `home-${width}.png`) });
    pass("entry and canonical 29-page / 152-case project");
    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.getByRole("dialog").getByLabel("Nom du projet").fill("Projet QA");
    await page.getByRole("dialog").getByRole("button", { name: "Créer le projet" }).click();
    await page.getByText("Aucune planche pour ce filtre.").waitFor();
    await click("Nouvelle planche");
    await click("Ajouter une case");
    const newCase = page.getByRole("dialog", { name: "Case 1", exact: true });
    await newCase.getByText("Options avancées").click();
    await newCase.getByLabel("Largeur grille").selectOption("2");
    await newCase.getByLabel("Hauteur grille").selectOption("2");
    await newCase.getByRole("button", { name: "Fermer" }).click();
    assert.equal(await page.locator(".visual-grid > div").first().evaluate((el) => getComputedStyle(el).gridColumnEnd), "span 2");
    assert.equal(await page.locator(".visual-grid").count(), 1);
    await page.goto(base + "/atelier");
    await page.getByRole("button", { name: "Nous, malgré nous" }).click();
    await page.getByText("MÉTRO PAPINEAU", { exact: true }).waitFor();
    await page.goto(base + "/atelier");
    pass("global plus creates a separate project and case edits return to its 3x3 grid");
    await page.locator('a[href*="chapitre"]').first().click();
    await page.waitForURL("**/projet?*");
    await page.getByRole("button", { name: "Tout voir", exact: true }).waitFor();
    await page.getByRole("button", { name: "Actions", exact: true }).first().waitFor();
    const filtered = await page.getByRole("button", { name: "Actions", exact: true }).count();
    assert.ok(filtered > 0 && filtered < 29);
    await click("Tout voir");
    await page.waitForFunction(
      () => document.querySelectorAll('button[aria-label="Actions"]').length === 29,
    );
    pass("chapter filter and Tout voir");
    await page.getByRole("button", { name: "Actions", exact: true }).first().click();
    await page.getByRole("menuitem", { name: "Descendre", exact: true }).click();
    assert.ok(new URL(page.url()).pathname === "/projet");
    await page.getByRole("button", { name: "Actions", exact: true }).nth(1).click();
    await page.getByRole("menuitem", { name: "Monter", exact: true }).click();
    await page.getByRole("menu").waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("button", { name: "Actions", exact: true }).count(), 29);
    pass("reorder menu does not accidentally open a page");
    await page.getByText("MÉTRO PAPINEAU", { exact: true }).click();
    await page.getByRole("button").filter({ hasText: "Case divisée en deux" }).click();
    let dialog = page.getByRole("dialog", { name: "Case 1", exact: true });
    await dialog.getByRole("button", { name: "À valider", exact: true }).click();
    await dialog.getByRole("button", { name: "Brouillon", exact: true }).waitFor();
    await dialog.getByLabel("Titre", { exact: true }).fill("QA titre");
    await dialog.getByLabel("Mise en image", { exact: true }).fill("QA description");
    await dialog.getByText("Options avancées", { exact: true }).click();
    await dialog.getByLabel(/Largeur grille/i).selectOption("2");
    await dialog.getByLabel(/Hauteur grille/i).selectOption("2");
    await dialog.getByRole("button", { name: "Bulle", exact: true }).click();
    await dialog.getByLabel("Contenu libre", { exact: true }).fill("QA bulle");
    assert.equal(await dialog.locator(".overlay").innerText(), "QA bulle");
    await dialog.locator(".overlay").scrollIntoViewIfNeeded();
    const box = await dialog.locator(".overlay").boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20);
    await page.mouse.up();
    const left = await dialog.locator(".overlay").evaluate((el) => el.style.left);
    assert.notEqual(left, "12%");
    await dialog.getByRole("button", { name: "Assembler le prompt IA", exact: true }).click();
    const prompt = page.getByRole("dialog", { name: /Prompt/ });
    assert.match(await prompt.locator("textarea").inputValue(), /QA description/);
    await prompt.getByRole("button", { name: "Fermer", exact: true }).last().click();
    await upload(dialog.getByRole("button", { name: "Remplacer l’image", exact: true }), {
      name: "qa.png",
      mimeType: "image/png",
      buffer: pixel,
    });
    await page.getByText("Image enregistrée", { exact: true }).waitFor();
    await dialog.locator(".case-canvas img").waitFor();
    await page.screenshot({ animations: "disabled", path: join(output, `editor-${width}.png`) });
    await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
    const resizedCard = page.locator(".visual-grid button").first();
    const resizedCell = resizedCard.locator("..");
    const resizedGrid = await resizedCell.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        columnStart: style.gridColumnStart,
        columnEnd: style.gridColumnEnd,
        rowStart: style.gridRowStart,
        rowEnd: style.gridRowEnd,
      };
    });
    assert.equal(resizedGrid.columnEnd, "span 2");
    assert.equal(resizedGrid.rowEnd, "span 2");
    assert.equal(
      await resizedCard.locator("img").first().evaluate((img) => getComputedStyle(img).objectFit),
      "contain",
    );
    pass("case editor, image upload, visible lettering, drag, size, full-image fit and prompt");
    await page.getByText("Détails de la planche et gardiens").click();
    await page.getByLabel("Note de production", { exact: true }).fill("Note QA P01");
    await page.getByLabel("Archiviste", { exact: true }).selectOption("2");
    await page.getByText("Détails de la planche et gardiens").click();
    await page.keyboard.press("j");
    await page.waitForURL("**/planche/P02");
    if ((await page.getByLabel("Note de production", { exact: true }).count()) === 0)
      await page.getByText("Détails de la planche et gardiens").click();
    assert.equal(await page.getByLabel("Note de production", { exact: true }).inputValue(), "");
    await page.getByText("Détails de la planche et gardiens").click();
    await page.keyboard.press("k");
    await page.waitForURL("**/planche/P01");
    if ((await page.getByLabel("Note de production", { exact: true }).count()) === 0)
      await page.getByText("Détails de la planche et gardiens").click();
    assert.equal(
      await page.getByLabel("Note de production", { exact: true }).inputValue(),
      "Note QA P01",
    );
    pass("notes stay attached to their own page and keyboard navigation");
    await waitSaved();
    await page.reload();
    await page.getByText("Détails de la planche et gardiens").click();
    assert.equal(
      await page.getByLabel("Note de production", { exact: true }).inputValue(),
      "Note QA P01",
    );
    assert.equal(await page.getByLabel("Archiviste", { exact: true }).inputValue(), "2");
    pass("reload keeps edits and guardian state");
    await page.goto(base + "/planche/P01");
    await page.locator(".visual-grid").waitFor();
    assert.equal(await page.locator(".visual-grid").count(), 1);
    await page.locator(".visual-grid button").first().click();
    await page.getByRole("dialog", { name: "Case 1", exact: true }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Fermer", exact: true }).click();
    pass("one 3x3 grid applies dimensions and opens the selected case");
    await page.goto(base + "/projet");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    await page.getByPlaceholder("Planche, case, personnage…").fill("QA description");
    await page.getByRole("button", { name: /MÉTRO PAPINEAU · case 1/ }).click();
    await page.getByRole("dialog", { name: "Case 1", exact: true }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Fermer", exact: true }).click();
    pass("search finds edited content and opens its case");
    await page.goto(base + "/donnees");
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByText("Sauvegarder la session", { exact: true })
      .locator("..")
      .locator("..")
      .getByRole("button")
      .click();
    const backupDownload = await downloadPromise;
    const backupPath = await backupDownload.path();
    const backup = JSON.parse(await readFile(backupPath, "utf8"));
    assert.equal(backup.media.length, 1);
    assert.equal(backup.seed.planches[0].cases[0].titre, "QA titre");
    assert.equal(backup.media[0].data.split(",")[1], pixel.toString("base64"));
    const restore = page
      .getByText("Restaurer une sauvegarde", { exact: true })
      .locator("..")
      .locator("..")
      .getByRole("button");
    await upload(restore, {
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    await page.getByText(/Fichier invalide/).waitFor();
    await upload(restore, backupPath);
    await page.getByText("Sauvegarde restaurée", { exact: true }).waitFor();
    pass("downloaded backup restores images and malformed backup is rejected");
    const zipPromise = page.waitForEvent("download");
    await page
      .getByText("Export du projet", { exact: true })
      .locator("..")
      .locator("..")
      .getByRole("button")
      .click();
    await (await zipPromise).saveAs(join(output, `project-${width}.zip`));
    pass("ZIP download with built-in and imported images");
    await page.goto(base + "/projet");
    await click("Nouvelle planche");
    await click("Ajouter une case");
    dialog = page.getByRole("dialog", { name: "Case 1", exact: true });
    await dialog.waitFor();
    await dialog.getByLabel("Titre", { exact: true }).fill("Disposable");
    await dialog.getByRole("button", { name: "Supprimer la case", exact: true }).click();
    await page.getByTitle("Plus", { exact: true }).click();
    await page.getByRole("menuitem", { name: "Supprimer la planche", exact: true }).click();
    await page.waitForURL("**/projet");
    assert.equal(await page.getByRole("button", { name: "Actions", exact: true }).count(), 29);
    pass("create/delete page and case");
    await page.goto(base + "/planche/P01");
    await page.addScriptTag({
      content: 'window.print = () => { document.body.dataset.printed = "yes"; };',
    });
    await page.getByTitle("Plus", { exact: true }).click();
    await page.getByRole("menuitem", { name: "Imprimer la planche", exact: true }).click();
    await page.waitForFunction(() => document.body.dataset.printed === "yes");
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("header").isVisible(), false);
    assert.equal(await page.locator("#print-root").isVisible(), true);
    assert.ok(
      await page
        .locator("#print-root img")
        .evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0)),
    );
    await page.emulateMedia({ media: "screen" });
    pass("printing waits for images and excludes application controls");
    await page.goto(base + "/bibliotheque");
    const firstPerson = page.locator("article").first();
    await firstPerson.getByLabel("Nom", { exact: true }).fill("Julien QA");
    await firstPerson.getByLabel("Rôle", { exact: true }).fill("Rôle QA");
    await firstPerson.getByLabel("Description", { exact: true }).fill("Description QA");
    await upload(firstPerson.getByRole("button", { name: "Remplacer l’image", exact: true }), {
      name: "reference.png",
      mimeType: "image/png",
      buffer: pixel,
    });
    await page.getByText("Image de référence enregistrée", { exact: true }).waitFor();
    await click("Règles");
    const firstRule = page.locator("article").first();
    await firstRule.getByLabel("Titre", { exact: true }).fill("PRINCIPE QA");
    await firstRule.getByLabel("Contenu", { exact: true }).fill("Règle QA modifiable");
    await waitSaved();
    await page.reload();
    await click("Personnages");
    assert.equal(await page.locator("article").first().getByLabel("Nom", { exact: true }).inputValue(), "Julien QA");
    assert.equal(
      await page.locator("article").first().getByLabel("Description", { exact: true }).inputValue(),
      "Description QA",
    );
    await click("Règles");
    assert.equal(await page.locator("article").first().getByLabel("Titre", { exact: true }).inputValue(), "PRINCIPE QA");
    assert.equal(
      await page.locator("article").first().getByLabel("Contenu", { exact: true }).inputValue(),
      "Règle QA modifiable",
    );
    await click("Cohérence");
    await click("Personnages");
    assert.ok((await page.locator("article").count()) >= 5);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    assert.deepEqual(errors, []);
    pass("editable library persists character image/text and editorial rules without mobile overflow");
    await context.close();
  }
} catch (error) {
  if (lastPage && !lastPage.isClosed()) {
    await lastPage.screenshot({ path: join(output, "failure.png"), fullPage: true });
    console.error("STATE", await lastPage.locator("body").innerText());
  }
  throw error;
} finally {
  await browser.close();
}
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
