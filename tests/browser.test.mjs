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
    await page.getByRole("button", { name: "Nous, malgré nous", exact: true }).waitFor();
    await page.locator('img[src="/assets/nous-malgre-nous-cover.png"]').first().waitFor();
    assert.equal(await page.getByRole("link", { name: "Accueil", exact: true }).count(), 0);
    assert.equal(await page.getByRole("link", { name: "Projets", exact: true }).count(), 0);
    assert.equal(await page.getByRole("link", { name: "Bibliothèque", exact: true }).count(), 0);
    assert.equal(await page.getByRole("link", { name: "Profil", exact: true }).count(), 0);
    await page.screenshot({ animations: "disabled", path: join(output, `home-${width}.png`) });
    pass("projects list without the old navigation");
    await page.getByRole("button", { name: "Nouveau projet" }).click();
    await page.getByRole("dialog").getByLabel("Nom du projet").fill("Projet QA");
    await page.getByRole("dialog").getByRole("button", { name: "Créer le projet" }).click();
    await page.getByText("Aucune planche.", { exact: true }).waitFor();
    await click("Ajouter une case");
    const newCase = page.getByRole("dialog", { name: "Case 1", exact: true });
    await newCase.getByText("Options avancées").click();
    await newCase.getByLabel("Largeur grille").selectOption("2");
    await newCase.getByLabel("Hauteur grille").selectOption("2");
    await newCase.getByRole("button", { name: "Fermer" }).click();
    assert.equal(await page.locator(".visual-grid > div").first().evaluate((el) => getComputedStyle(el).gridColumnEnd), "span 2");
    assert.equal(await page.locator(".visual-grid").count(), 1);
    await page.goto(base + "/");
    await page.getByRole("button", { name: "Nous, malgré nous", exact: true }).click();
    await page.locator('img[src="/assets/nous-malgre-nous-cover.png"]').first().waitFor();
    assert.match(await page.getByText(/planches visuelles · 152 cases/).innerText(), /planches visuelles · 152 cases/);
    assert.ok((await page.getByRole("button", { name: /^Planche \d+$/ }).count()) > 1);
    assert.equal(await page.locator(".visual-grid").count(), 0);
    assert.equal(await page.getByText(/CHAPITRE/).count(), 0);
    assert.equal(await page.getByRole("link", { name: "Personnages & règles", exact: true }).count(), 1);
    assert.equal(await page.getByRole("link", { name: "Exporter", exact: true }).count(), 1);
    pass("global plus creates a project; opening one shows every visual planche");
    await page.getByRole("button", { name: "Planche 1", exact: true }).click();
    await page.locator(".visual-grid").waitFor();
    assert.equal(await page.locator(".visual-grid").count(), 1);
    await page.locator(".visual-grid button").first().click();
    let orderDialog = page.getByRole("dialog", { name: "Case 1", exact: true });
    await orderDialog.getByRole("button", { name: "Descendre", exact: true }).click();
    orderDialog = page.getByRole("dialog", { name: "Case 2", exact: true });
    await orderDialog.waitFor();
    await orderDialog.getByRole("button", { name: "Monter", exact: true }).click();
    await page.getByRole("dialog", { name: "Case 1", exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/projet");
    await page.getByRole("dialog", { name: "Case 1", exact: true }).getByRole("button", { name: "Fermer", exact: true }).click();
    pass("reorder menu does not accidentally open a page");
    await page.getByRole("button").filter({ hasText: "Case divisée en deux" }).click();
    let dialog = page.getByRole("dialog", { name: "Case 1", exact: true });
    await dialog.getByRole("button", { name: "À valider", exact: true }).click();
    await dialog.getByRole("button", { name: "Brouillon", exact: true }).waitFor();
    await dialog.getByLabel("Titre", { exact: true }).fill("QA titre");
    await dialog.getByLabel("Mise en image", { exact: true }).fill("QA description");
    await dialog.getByLabel("Note", { exact: true }).fill("Note QA P01");
    await dialog.getByText("Options avancées", { exact: true }).click();
    assert.equal(await dialog.getByRole("combobox", { name: "Archiviste", exact: true }).inputValue(), "absent");
    await dialog.getByRole("combobox", { name: "Archiviste", exact: true }).selectOption("2");
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
    const promptValue = await prompt.locator("textarea").inputValue();
    assert.match(promptValue, /QA description/);
    assert.match(promptValue, /Case 1/);
    assert.match(promptValue, /Planche visuelle/);
    assert.match(promptValue, /Archiviste: présent, niveau 2/);
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
      "cover",
    );
    pass("case editor, image upload, visible lettering, drag, size, full-image fit and prompt");
    await waitSaved();
    await page.reload();
    await page.locator('img[src="/assets/nous-malgre-nous-cover.png"]').first().waitFor();
    assert.ok((await page.getByRole("button", { name: /^Planche \d+$/ }).count()) > 1);
    await page.getByRole("button", { name: "Planche 1", exact: true }).click();
    await page.locator(".visual-grid button").first().click();
    dialog = page.getByRole("dialog", { name: "Case 1", exact: true });
    assert.equal(await dialog.getByLabel("Note", { exact: true }).inputValue(), "Note QA P01");
    await dialog.getByText("Options avancées", { exact: true }).click();
    assert.equal(await dialog.getByRole("combobox", { name: "Archiviste", exact: true }).inputValue(), "2");
    await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
    pass("reload keeps the case note and its own guardian state");
    await page.goto(base + "/projet");
    await page.getByRole("button", { name: "Planche 1", exact: true }).click();
    await page.locator(".visual-grid").waitFor();
    assert.equal(await page.locator(".visual-grid").count(), 1);
    await page.locator(".visual-grid button").first().click();
    await page.getByRole("dialog", { name: "Case 1", exact: true }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Fermer", exact: true }).click();
    assert.equal(await page.getByLabel("Planche visuelle").inputValue(), "0");
    pass("one 3x4 grid applies dimensions and opens the selected case");
    await page.goto(base + "/projet");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    await page.getByPlaceholder("Planche, case, personnage…").fill("QA description");
    await page.getByRole("button", { name: /^Case 1\b/ }).click();
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
    assert.equal(backup.seed.cases[0].titre, "QA titre");
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
    await click("Ajouter une case");
    dialog = page.getByRole("dialog", { name: "Case 153", exact: true });
    await dialog.waitFor();
    await dialog.getByLabel("Titre", { exact: true }).fill("Disposable");
    await dialog.getByRole("button", { name: "Premier", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Case 1", exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.getByLabel("Titre", { exact: true }).inputValue(), "Disposable");
    await dialog.getByRole("button", { name: "Dernier", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Case 153", exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.getByLabel("Titre", { exact: true }).inputValue(), "Disposable");
    await dialog.getByRole("button", { name: "Déplacer", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Case 1", exact: true });
    await dialog.waitFor();
    assert.equal(await dialog.getByLabel("Titre", { exact: true }).inputValue(), "Disposable");
    await dialog.getByRole("button", { name: "Supprimer la case", exact: true }).click();
    await page.getByText(/planches visuelles · 152 cases/).waitFor();
    pass("move a case before case 1, then delete that case and planche");
    await page.getByLabel("Planche visuelle").selectOption("1");
    await page.locator(".visual-grid button").first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Titre", { exact: true }).fill("Retour QA");
    await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
    assert.equal(await page.getByLabel("Planche visuelle").inputValue(), "1");
    await page.locator(".visual-grid button").first().click();
    dialog = page.getByRole("dialog");
    assert.equal(await dialog.getByLabel("Titre", { exact: true }).inputValue(), "Retour QA");
    await dialog.getByRole("button", { name: "Premier", exact: true }).click();
    await page.getByRole("dialog", { name: "Case 1", exact: true }).getByRole("button", { name: "Fermer", exact: true }).click();
    assert.equal(await page.getByLabel("Planche visuelle").inputValue(), "0");
    assert.match(await page.locator(".visual-grid button").first().innerText(), /Retour QA/);
    pass("editor returns to the visual page of the case");
    await page.goto(base + "/projet");
    await page.getByRole("button", { name: "Planche 1", exact: true }).click();
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
    const firstPerson = page.locator("#personnages article").first();
    await firstPerson.getByLabel("Nom", { exact: true }).fill("Julien QA");
    await firstPerson.getByLabel("Rôle", { exact: true }).fill("Rôle QA");
    await firstPerson.getByLabel("Description", { exact: true }).fill("Description QA");
    await upload(firstPerson.getByRole("button", { name: "Remplacer l’image", exact: true }), {
      name: "reference.png",
      mimeType: "image/png",
      buffer: pixel,
    });
    await page.getByText("Image de référence enregistrée", { exact: true }).waitFor();
    const firstRule = page.locator("#regles article").first();
    await firstRule.getByLabel("Titre", { exact: true }).fill("PRINCIPE QA");
    await firstRule.getByLabel("Contenu", { exact: true }).fill("Règle QA modifiable");
    const firstGuardian = page.locator("#gardiens article").first();
    await firstGuardian.getByLabel("Nom", { exact: true }).fill("Archiviste QA");
    await waitSaved();
    await page.reload();
    assert.equal(await page.locator("#personnages article").first().getByLabel("Nom", { exact: true }).inputValue(), "Julien QA");
    assert.equal(
      await page.locator("#personnages article").first().getByLabel("Description", { exact: true }).inputValue(),
      "Description QA",
    );
    assert.equal(await page.locator("#regles article").first().getByLabel("Titre", { exact: true }).inputValue(), "PRINCIPE QA");
    assert.equal(
      await page.locator("#regles article").first().getByLabel("Contenu", { exact: true }).inputValue(),
      "Règle QA modifiable",
    );
    assert.equal(
      await page.locator("#gardiens article").first().getByLabel("Nom", { exact: true }).inputValue(),
      "Archiviste QA",
    );
    assert.equal(
      await page.locator("#personnages img").first().evaluate((img) => getComputedStyle(img).objectFit),
      "contain",
    );
    assert.equal(
      await page.locator("#gardiens img").first().evaluate((img) => getComputedStyle(img).objectFit),
      "contain",
    );
    assert.ok((await page.locator("#personnages article").count()) >= 3);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    assert.deepEqual(errors, []);
    pass("editable characters, guardians and rules keep full images without mobile overflow");
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
