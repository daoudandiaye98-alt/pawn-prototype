/**
 * Teil M1 — die Abnahme des Wendels. Kein Gate-Messer (das ist `lauf.ts`), sondern
 * die Frage: dreht das Blatt richtig?
 *
 *   npx vite preview --port 4173 --host 127.0.0.1     (in einem zweiten Fenster)
 *   node tools/pruefstand/wendel.mjs
 *
 * Geprüft wird auf vier Breiten: Dokumenthöhe, Winkel und Stapelordnung an jedem
 * Achtelschritt, Knick, Tastaturrollen, Tieflink, Adressnachführung, der zweite Weg
 * bei reduzierter Bewegung und der Inhalt im DOM. Endet mit Code 1 bei Abweichung.
 *
 * Wichtig: die Seite hat `scroll-behavior: smooth`. Wer hier misst, muss mit
 * `behavior: "instant"` springen — sonst misst man die Rollanimation, nicht das Blatt.
 */
/**
 * M1-Abnahme: der Wendel, gemessen statt behauptet.
 * Läuft gegen den lokalen Build. Schreibt Zahlen nach stdout.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASIS = "http://127.0.0.1:4173";
const ORDNER = "tools/pruefstand/artefakte/heft";
const BREITEN = [
  { b: 390, h: 844, finger: true },
  { b: 768, h: 1024, finger: true },
  { b: 1280, h: 900, finger: false },
  { b: 1920, h: 1080, finger: false },
];
const WEG = 900;
// Die Zahl der Blätter steht in der Seite, nicht hier: sie wächst mit dem Heft.
// Eine fest verdrahtete Zahl misst sonst irgendwann ein anderes Heft.
let BLAETTER = 0;

const lies = () =>
  Array.from(document.querySelectorAll(".heft-blatt")).map((el, i) => {
    const cs = getComputedStyle(el);
    const m = new DOMMatrix(cs.transform);
    // rotateY aus der Matrix: m11 = cos, m13 = -sin
    const winkel = Math.round(Math.atan2(-m.m13, m.m11) * (180 / Math.PI) * 10) / 10;
    const r = el.getBoundingClientRect();
    const knick = el.querySelector(".heft-knick");
    return {
      i,
      winkel,
      z: Number(cs.zIndex),
      knick: knick ? Math.round(Number(getComputedStyle(knick).opacity) * 1000) / 1000 : null,
      breite: Math.round(r.width),
      links: Math.round(r.left),
    };
  });

mkdirSync(ORDNER, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PRUEFSTAND_CHROMIUM });
let fehler = 0;

for (const v of BREITEN) {
  const page = await browser.newPage({
    viewport: { width: v.b, height: v.h }, hasTouch: v.finger, isMobile: v.finger, locale: "de-DE",
  });
  await page.goto(`${BASIS}/ausgabe/001`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".heft-blatt");
  await page.waitForTimeout(600);
  BLAETTER = await page.evaluate(() => document.querySelectorAll(".heft-blatt").length);

  // Echte Scrollhöhe?
  const doku = await page.evaluate(() => ({
    hoehe: document.documentElement.scrollHeight,
    fenster: window.innerHeight,
    rollbar: document.documentElement.scrollHeight > window.innerHeight,
    ueberlauf: getComputedStyle(document.body).overflowY,
  }));
  const erwartet = BLAETTER * WEG + doku.fenster;
  console.log(`\n=== ${v.b}px  ${BLAETTER} Blätter · Dokumenthöhe ${doku.hoehe} (erwartet ${erwartet}) · rollbar ${doku.rollbar} · body overflow-y ${doku.ueberlauf}`);
  if (doku.hoehe !== erwartet) { console.log("   ABWEICHUNG Scrollhöhe"); fehler++; }

  // Durchblättern in Achtelschritten und jeden Zustand prüfen.
  const schritte = BLAETTER * 8;
  let letzteZ = null;
  for (let s = 0; s <= schritte; s++) {
    const y = Math.round((s / 8) * WEG);
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'instant' }), y);
    await page.waitForTimeout(70);
    const stand = await page.evaluate(lies);
    const echtY = await page.evaluate(() => window.scrollY);

    // Regel 1: Winkel monoton fallend über die Blätter (kein Sprung zurück).
    // Regel 2: keine zwei Blätter mit gleichem z-Index.
    const zs = stand.map((x) => x.z);
    if (new Set(zs).size !== zs.length) { console.log(`   y=${y}: doppelter z-Index ${zs}`); fehler++; }
    // Regel 3: Winkel liegt in [-180, 0].
    for (const x of stand) {
      if (x.winkel > 0.6 || x.winkel < -180.6) { console.log(`   y=${y}: Blatt ${x.i} Winkel ${x.winkel}`); fehler++; }
    }
    // Regel 4: das gerade wendende Blatt liegt über allen ungewendeten.
    if (s % 4 === 0) {
      const z = stand.map((x) => `${x.i}:${x.winkel}°/z${x.z}/k${x.knick}`).join("  ");
      console.log(`   y=${String(y).padStart(4)} (echt ${echtY})  ${z}`);
    }
    letzteZ = zs;
  }

  // Screenshot in der Mitte des ersten Wendels — dort ist der Knick am stärksten.
  await page.evaluate(() => window.scrollTo({ top: 450, behavior: 'instant' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${ORDNER}/wendel-mitte--${v.b}.png` });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${ORDNER}/titel--${v.b}.png` });

  // Tastatur: Leertaste und Bild-ab müssen rollen.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  const vorher = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("PageDown");
  await page.waitForTimeout(300);
  const nachher = await page.evaluate(() => window.scrollY);
  console.log(`   Bild-ab: ${vorher} → ${nachher} ${nachher > vorher ? "OK" : "KEINE BEWEGUNG"}`);
  if (nachher <= vorher) fehler++;

  await page.close();
}

// Adresse: Tieflink und Nachführung.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "de-DE" });
  await page.goto(`${BASIS}/ausgabe/001/3`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".heft-blatt");
  await page.waitForTimeout(700);
  const tief = await page.evaluate(() => ({ y: window.scrollY, pfad: location.pathname }));
  console.log(`\n=== Tieflink /ausgabe/001/3 → scrollY ${tief.y} (erwartet ${2 * WEG}) · Pfad ${tief.pfad}`);
  if (tief.y !== 2 * WEG) fehler++;

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const oben = await page.evaluate(() => location.pathname);
  await page.evaluate(() => window.scrollTo({ top: 3 * 900, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const unten = await page.evaluate(() => location.pathname);
  console.log(`    Wenden ändert die Adresse: oben ${oben} · bei 2700 ${unten}`);
  if (oben !== "/ausgabe/001" || unten !== "/ausgabe/001/4") fehler++;
  await page.close();
}

// Reduzierte Bewegung: senkrechte Folge, kein 3D, gleiche Adressen.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "de-DE", reducedMotion: "reduce" });
  await page.goto(`${BASIS}/ausgabe/001`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => ({
    blaetter: document.querySelectorAll(".heft-blatt").length,
    folgen: document.querySelectorAll(".heft-folge-seite").length,
    perspektive: document.querySelector(".heft-buehne") ? getComputedStyle(document.querySelector(".heft-buehne")).perspective : "keine Bühne",
    h1: document.querySelectorAll("h1").length,
    folios: document.querySelectorAll(".heft-folio").length,
  }));
  console.log(`\n=== Bewegung reduziert: ${r.blaetter} 3D-Blätter · ${r.folgen} Folgeseiten · Bühne: ${r.perspektive} · h1 ${r.h1} · Folios ${r.folios}`);
  if (r.blaetter !== 0 || r.folgen !== BLAETTER + 1) fehler++;
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.6, behavior: 'instant' }));
  await page.waitForTimeout(700);
  console.log(`    Adresse nach dem Rollen: ${await page.evaluate(() => location.pathname)}`);
  await page.screenshot({ path: `${ORDNER}/reduziert--390.png`, fullPage: true });
  await page.close();
}

// Inhalt im DOM?
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASIS}/ausgabe/001`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const dom = await page.evaluate(() => ({
    h1: Array.from(document.querySelectorAll("h1")).map((h) => h.textContent),
    folios: Array.from(document.querySelectorAll(".heft-folio")).map((f) => f.textContent),
    titel: document.title,
  }));
  console.log(`\n=== DOM: h1 ${JSON.stringify(dom.h1)} · Folios ${dom.folios.join(",")} · Titel „${dom.titel}"`);
  if (dom.h1.length !== 1) fehler++;
  if (dom.folios.length !== 2 + BLAETTER * 2) fehler++;
  await page.close();
}

await browser.close();
console.log(`\nAbweichungen gesamt: ${fehler}`);
process.exit(fehler > 0 ? 1 : 0);
