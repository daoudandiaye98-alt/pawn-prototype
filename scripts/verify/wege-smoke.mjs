// Echter Produktionsbau im Browser; alle Backend-Antworten bleiben isolierte Test-Fixtures.
// Keine Konten, Zahlungen, KI-Auftraege oder Testdaten in einer echten Datenbank.
import { preview } from "vite";
import { chromium } from "playwright";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { zeilen } from "../../src/heft03/fixtures/zeilen.mjs";

const out = resolve("tools/pruefstand/artefakte/smoke");
mkdirSync(out, { recursive: true });
const startedAt = new Date().toISOString();
writeFileSync(resolve(out, "bericht.json"), JSON.stringify({ status: "running", startedAt }));
const server = await preview({ preview: { host: "127.0.0.1", port: 4187, strictPort: true } });
const origin = "http://127.0.0.1:4187";
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32" && !existsSync(chromium.executablePath()) ? { channel: "msedge" } : {}),
  args: ["--enable-unsafe-swiftshader"],
});
const fixture = JSON.parse(JSON.stringify(zeilen).replaceAll("./assets/", origin + "/heft/assets/"));
const errors = [], results = [];
let postedDNA = null, uploads = 0;
let opaqueCutout = false;
const user = { id: "11111111-1111-4111-8111-111111111111", email: "test@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-09-01T00:00:00Z" };
const expires = Math.floor(Date.now() / 1000) + 3600;
const jwt = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." +
  Buffer.from(JSON.stringify({ sub: user.id, exp: expires, aud: "authenticated" })).toString("base64url") + ".test-signature";
const session = { access_token: jwt, refresh_token: "isolated-test", token_type: "bearer", expires_in: 3600, expires_at: expires, user };
let signedIn = false;

async function context(viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", locale: "de-DE" });
  await ctx.route("**/*", async route => {
    const request = route.request(), u = new URL(request.url());
    const send = body => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (u.origin === origin) {
      if (opaqueCutout && u.pathname.endsWith("/cutout-noir.webp") && request.resourceType() === "fetch") {
        return route.fulfill({ status: 200, contentType: "image/webp", body: readFileSync("public/heft/assets/mode-stange-894.webp") });
      }
      return route.continue();
    }
    if (!u.hostname.endsWith(".supabase.co")) return route.abort();
    if (u.pathname.includes("/auth/v1/token")) { signedIn = true; return send(session); }
    if (u.pathname.includes("/auth/v1/user")) return send(user);
    if (u.pathname.includes("/auth/v1/")) return send({});
    if (u.pathname.includes("/storage/v1/object/public/designer-media/")) {
      return route.fulfill({ status: 200, contentType: "image/webp", body: "" });
    }
    if (u.pathname.includes("/storage/v1/object/designer-media/") && request.method() === "POST") {
      uploads++; return send({ Key: "test" });
    }
    if (u.pathname.includes("/rest/v1/")) {
      const table = u.pathname.split("/").pop();
      const name = ({ heft_produkte: "products", heft_haeuser: "designers" })[table] || table;
      if (request.method() === "PATCH" && name === "products") {
        postedDNA = request.postDataJSON().product_dna;
        return send({ id: "p-1" });
      }
      if (!["GET", "HEAD"].includes(request.method())) return send(null);
      const studio = u.searchParams.has("user_id");
      const rows = {
        products: fixture.products.filter(p => p.status === "published"),
        designers: studio ? [{ ...fixture.designers[0], user_id: user.id, onboarding_state: {}, dismissed_suggestions: {} }] : fixture.designers,
        designer_page_blocks: fixture.blocks, house_themes: fixture.themes,
        media_assets: signedIn ? [{ id: "m-cutout", designer_id: "d-1", kind: "bild", origin: "upload", url: origin + "/heft/assets/cutout-noir.webp", title: "Transparenter Aufsteller", note: null, usages: [], review_status: "privat" }] : fixture.media,
        curated_collections: [fixture.collection], collection_items: fixture.items,
        profiles: [{ id: user.id, display_name: "Test", locale: "de-DE" }],
        user_roles: [{ role: "designer" }],
      }[name] || [];
      if (name === "products" && u.searchParams.get("select") === "product_dna") return send({ product_dna: fixture.products[0].product_dna });
      const single = request.headers().accept?.includes("vnd.pgrst.object");
      // maybeSingle fuer GET fordert ein Array an und waehlt im Client die einzelne Zeile.
      return send(single ? rows[0] || null : rows);
    }
    return send({});
  });
  return ctx;
}

try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    signedIn = false;
    const ctx = await context(viewport);
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    page.on("pageerror", e => errors.push(e.message));
    const loaded = [];
    page.on("request", r => { if (r.url().includes("/assets/")) loaded.push(r.url()); });
    await page.goto(origin + "/suche?q=Mantel", { waitUntil: "domcontentloaded" });
    await page.locator('[data-product="p-1"]:visible').first().waitFor();
    if (await page.locator("#rotate").isVisible()) {
      await page.getByRole("button", { name: /Trotzdem hochkant lesen/ }).click();
    }
    assert.equal(loaded.some(u => /\/(Studio|Admin)[^/]*\.js/.test(u)), false, "Der Shop darf keine Verwaltungsseiten vorladen");
    await page.locator('[data-product="p-1"]:visible').first().click();
    await page.waitForURL(/\/werk\/lind-mantel-01/);
    await page.locator('#drawer [data-house="haus-lind"]:visible').first().click();
    await page.waitForURL(/\/haus\/haus-lind/);
    if (viewport.width === 390) {
      const separated = await page.evaluate(() => {
        const id = document.querySelector("footer .page-id").getBoundingClientRect();
        const hint = document.querySelector("#scroll-hint").getBoundingClientRect();
        return id.bottom <= hint.top;
      });
      assert.ok(separated, "Kapitel und Lesehinweis duerfen sich im Hochformat nicht ueberlagern");
    }
    await page.screenshot({ path: resolve(out, "haus-" + viewport.width + ".png") });
    results.push({ viewport: viewport.width, searchProductHouse: true, noAdminChunks: true });
    await page.goto(origin + "/konto", { waitUntil: "domcontentloaded" });
    await page.locator('[data-zugang-form="anmelden"]:visible').first().waitFor();
    if (await page.locator("#rotate").isVisible()) {
      await page.getByRole("button", { name: /Trotzdem hochkant lesen/ }).click();
    }
    await page.screenshot({ path: resolve(out, "konto-" + viewport.width + ".png") });
    results.at(-1).loginForm = true;
    if (viewport.width === 1440) {
      const form = page.locator('[data-zugang-form="anmelden"]:visible').first();
      await form.locator('input[type="email"]').fill(user.email);
      await form.locator('input[type="password"]').fill("isolated-test-password");
      await form.locator('button[type="submit"]').click();
      await page.waitForURL(/\/(studio|konto)/);
      await page.goto(origin + "/studio/werke/bilder", { waitUntil: "domcontentloaded" });
      const chooser = page.getByLabel("Als Aufsteller im Heft veröffentlichen");
      await chooser.waitFor();
      const necessary = page.getByRole("button", { name: /Nur notwendige/i });
      if (await necessary.isVisible()) await necessary.click();
      await chooser.scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(out, "mediathek-1440.png") });
      opaqueCutout = true;
      await chooser.selectOption("p-1");
      await page.getByText(/Dieses Bild braucht einen transparenten Hintergrund/).waitFor();
      assert.equal(uploads, 0, "Ein opakes Bild darf nicht hochgeladen werden");
      assert.equal(postedDNA, null, "Ein opakes Bild darf kein Produkt veraendern");
      results.at(-1).opaqueImageRejected = true;
      opaqueCutout = false;
      await chooser.selectOption("p-1");
      await page.getByText("Der Aufsteller ist mit dem Produkt verbunden.", { exact: true }).waitFor();
      assert.ok(uploads > 0);
      assert.equal(postedDNA.materials[0], "Wolle");
      assert.equal(postedDNA.heft.hoehe, 2.9);
      assert.match(postedDNA.heft.cutout_url, /\/storage\/v1\/object\/public\/designer-media\//);
      results.at(-1).loginAndCutout = true;
    }
    await ctx.close();
  }
  assert.deepEqual(errors, [], "Keine unbehandelten JavaScript-Fehler");
  writeFileSync(resolve(out, "bericht.json"), JSON.stringify({ status: "passed", startedAt, backend: "isolierte Fixtures, keine Live-Abnahme", results, errors }, null, 2));
  console.log(JSON.stringify(results));
} catch (e) {
  writeFileSync(resolve(out, "bericht.json"), JSON.stringify({ status: "failed", startedAt, results, errors, failure: e.message }, null, 2));
  for (const ctx of browser.contexts()) for (const page of ctx.pages()) {
    await page.screenshot({ path: resolve(out, "fehler.png") }).catch(() => {});
    writeFileSync(resolve(out, "fehler.txt"), e.stack + "\n" + errors.join("\n") + "\n" + (await page.locator("body").innerText()).slice(0,10000));
  }
  throw e;
} finally {
  await browser.close();
  await new Promise(r => server.httpServer.close(r));
}
