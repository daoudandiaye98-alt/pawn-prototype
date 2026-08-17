/**
 * Teil P — der Einstiegspunkt.
 *
 *   npx tsx tools/pruefstand/lauf.ts --ziel preview
 *   npx tsx tools/pruefstand/lauf.ts --ziel live
 *   npx tsx tools/pruefstand/lauf.ts --ziel live --seiten halle
 *
 * Schreibt tools/pruefstand/artefakte/bericht.json und die Screenshots daneben.
 * Endet mit Code 1, sobald ein Launch Gate gefallen ist.
 */
import { chromium, type Browser, type Page } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  BREITEN, CHROMIUM_PFAD, DATEN_HOSTS, BLATT_ERWARTET, DREH_ERWARTET, RUHE_MS, SCHWELLEN, SEITEN, UNSINN_PFAD,
  VORGABE_ZIEL, ZIELE, type Breite, type SeitenZiel, type ZielName,
} from "./pruefstand.config";
import {
  messeBlattgeometrie, messeDrehHinweis, messeFokus, messeKnopfVerdeckung, messeKontrast, messeKopfdaten,
  messeLayout, messeTrefferflaechen, type Befund,
} from "./messen";

const ORDNER = join(process.cwd(), "tools", "pruefstand", "artefakte");

/**
 * Die Vercel-Vorschau ist standardmäßig gesperrt: JEDE Anfrage, auch die auf ein
 * `.webp`, antwortet mit 302 auf `vercel.com/sso-api`. Ein Lauf dagegen würde die
 * Anmeldeseite vermessen und lauter grüne Zahlen liefern, die nichts bedeuten.
 *
 * „Protection Bypass for Automation" hebt das auf. Das Geheimnis liegt in den
 * GitHub-Secrets, kommt über die Umgebung herein und wird NIE hier notiert. Es
 * geht als Kopfzeile an jede Anfrage des Browsers mit — auch an die Bilder,
 * nicht nur an das Dokument.
 *
 * Fehlt es, wird nichts mitgeschickt. Dann trifft der Lauf die Sperre und meldet
 * das als Umleitung, statt still etwas Falsches zu messen.
 */
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const ZUSATZ_KOPFZEILEN = BYPASS ? { "x-vercel-protection-bypass": BYPASS } : undefined;

/**
 * tsx/esbuild hängt an benannte Funktionen einen Helfer `__name`, den es im Browser
 * nicht gibt — jede `page.evaluate`-Rückrufsfunktion mit einer benannten inneren
 * Funktion stürzt sonst mit „__name is not defined" ab. Ein Zeilen-Ersatz vor jeder
 * Navigation, damit im Messcode nichts verrenkt geschrieben werden muss.
 */
async function nameHelferSetzen(page: Page) {
  await page.addInitScript(() => {
    const g = globalThis as unknown as { __name?: unknown };
    if (!g.__name) g.__name = (f: unknown) => f;
  });
}

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * `--kontrollen 3.4,3.3` misst nur diese Kontrollen. Gedacht für den Fall, dass
 * eine Zahl neu erhoben werden muss, ohne den ganzen Lauf zu wiederholen: der
 * Teillauf benutzt dieselben Messfunktionen, also sind die Zahlen dieselben.
 * Der Bericht hält fest, dass es ein Teillauf war — sonst liest ihn später
 * jemand als Gesamtbild.
 */
const NUR_KONTROLLEN = argument("kontrollen")?.split(",").map((s) => s.trim()).filter(Boolean);

function commit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unbekannt";
  }
}

/** Erkennt, ob die Adresse uns auf eine Anmeldung umgeleitet hat. */
async function istUmgeleitet(page: Page, erwartetHost: string): Promise<string | null> {
  const jetzt = new URL(page.url());
  if (jetzt.host !== erwartetHost) return page.url();
  return null;
}

/**
 * Eine leere Hülle darf nie als Ergebnis durchgehen.
 *
 * Kam die Seite nicht an ihre Daten (Anfragen an `DATEN_HOSTS` fehlgeschlagen),
 * dann zeigt der Browser ein Gerüst ohne Werke und ohne Bilder. Jede Zahl daran
 * ist wahr über das Gerüst und falsch über die Seite: der Kontrast stimmt, weil
 * nichts dasteht; die Trefferflächen stimmen, weil es keine gibt; der primäre
 * Weg ist frei, weil der Fuß nach oben gerutscht ist. Ein „bestanden" wäre
 * hier gefährlicher als ein „gefallen" — es sähe aus wie ein Beleg.
 *
 * Deshalb werden ALLE Befunde dieser Seite auf `nicht_pruefbar` gesetzt, mit
 * dem Grund und der ursprünglichen Messung in der Notiz, damit nichts verloren
 * geht.
 *
 * GRENZE: erkannt werden Transportfehler (`requestfailed`). Eine Antwort mit
 * 401 oder 500 vom Datenhost fällt hier NICHT auf — das absichtlich, weil
 * einzelne 401 auf geschützte Tabellen im Normalbetrieb vorkommen und sonst
 * jede Seite entwertet würde.
 */
function huelleMarkieren(befunde: Befund[], datenFehler: string[]): Befund[] {
  if (datenFehler.length === 0) return befunde;
  // Der Grund steht in jedem einzelnen Befund — aber wer den Lauf ansieht
  // (im Terminal oder im Protokoll der Action), soll ihn sehen, ohne erst den
  // Bericht herunterzuladen. Eine Seite, die als Hülle gewertet wird, muss
  // sagen, WORAN sie gescheitert ist.
  console.error(`    ⚠ HÜLLE — ${datenFehler.length} Anfrage(n) an ${DATEN_HOSTS.join(", ")} fehlgeschlagen:`);
  for (const zeile of datenFehler.slice(0, 3)) console.error(`      ${zeile}`);
  const grund = `Die Seite hat ihre Daten nicht bekommen: ${datenFehler.length} Anfrage(n) an `
    + `${DATEN_HOSTS.join(", ")} fehlgeschlagen (${datenFehler[0]}). Gemessen wurde eine leere `
    + "Hülle, nicht die Seite.";
  return befunde.map((b) => ({
    ...b,
    status: "nicht_pruefbar" as const,
    gemessen: null,
    notiz: `${grund} Ursprünglich gemessen: ${b.gemessen ?? "—"} (Schwelle ${b.schwelle ?? "—"})`
      + `${b.notiz ? " · " + b.notiz : ""}`,
  }));
}

async function seiteMessen(
  browser: Browser, basis: string, seite: SeitenZiel, breite: Breite,
  ruhigeBewegung = false,
): Promise<Befund[]> {
  const page = await browser.newPage({
    viewport: { width: breite.breite, height: breite.hoehe },
    hasTouch: breite.eingabe === "finger",
    isMobile: breite.eingabe === "finger",
    locale: "de-DE",
    reducedMotion: ruhigeBewegung ? "reduce" : "no-preference",
    extraHTTPHeaders: ZUSATZ_KOPFZEILEN,
  });
  await nameHelferSetzen(page);
  const befunde: Befund[] = [];

  // 4.7 Gewicht + Konsolenfehler laufen nebenher mit.
  let gewicht = 0;
  const groessen: { url: string; bytes: number }[] = [];
  const konsole: string[] = [];
  const fehlgeschlagen: string[] = [];
  /** Nur die Fehlschläge zum Datenhost — sie entwerten die ganze Seite. */
  const datenFehler: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") konsole.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => konsole.push("pageerror: " + e.message.slice(0, 160)));
  page.on("requestfailed", (r) => {
    const zeile = `${r.url().slice(0, 90)} — ${r.failure()?.errorText}`;
    fehlgeschlagen.push(zeile);
    if (DATEN_HOSTS.some((h) => r.url().includes(h))) datenFehler.push(zeile);
  });
  page.on("response", async (r) => {
    try {
      const laenge = Number(r.headers()["content-length"] ?? 0);
      const bytes = laenge > 0 ? laenge : (await r.body().catch(() => Buffer.alloc(0))).length;
      gewicht += bytes;
      groessen.push({ url: r.url().split("/").pop()?.slice(0, 48) ?? "", bytes });
    } catch { /* Antwort nicht lesbar — zählt nicht mit */ }
  });
  const adresse = basis + seite.pfad;
  try {
    const antwort = await page.goto(adresse, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(RUHE_MS);

    const umgeleitet = await istUmgeleitet(page, new URL(basis).host);
    if (umgeleitet) {
      return [{
        kontrolle: "01", gate: false, status: "nicht_pruefbar",
        seite: seite.pfad, breite: breite.breite, gemessen: page.url(), schwelle: basis,
        notiz: `Adresse leitet auf einen fremden Host um (${umgeleitet}) — es wurde nicht PAWN geladen, `
          + "deshalb wurde auf dieser Seite nichts gemessen.",
      }];
    }
    if (antwort && antwort.status() >= 400) {
      return [{
        kontrolle: "01", gate: false, status: "nicht_pruefbar",
        seite: seite.pfad, breite: breite.breite, gemessen: antwort.status(), schwelle: "< 400",
        notiz: "Seite antwortet mit Fehlerstatus — nicht messbar.",
      }];
    }

    /*
     * Gibt es diese Adresse auf DIESEM Ziel überhaupt?
     *
     * Hinter der SPA-Umschreibung antwortet der Server auf jede Adresse mit 200
     * und liefert dieselbe Anwendung. Kennt die Anwendung den Weg nicht, zeigt
     * sie die 404-Seite — mit demselben Kopf, demselben Fuß, denselben kleinen
     * Links. Der Prüfstand misst dann diese Ersatzseite und schreibt die Befunde
     * der angeforderten Adresse zu. Genau das ist beim ersten Lauf mit der Hülle
     * in der Liste passiert: `/heft/umschlag` liegt noch im Zweig, nicht auf
     * pawn.vision, und `X.dreh` meldete „kein Hinweis" — richtig gemessen,
     * falsch zugeordnet.
     *
     * Erkannt wird das am Kennzeichen `data-nicht-gefunden`, das die 404-Seite
     * selbst trägt. Kein Ratespiel: die Anwendung sagt damit ausdrücklich „das
     * hier ist keine Seite".
     *
     * NICHT am `noindex`, obwohl das zuerst naheliegt — die Hülle setzt es
     * ebenfalls, weil sie noch nicht indexiert werden soll. Eine Gegenprobe
     * gegen den lokalen Stand hat die Hülle prompt für nicht vorhanden erklärt
     * und damit still stummgeschaltet. Der Unterschied kostete eine Zeile und
     * hätte sonst jede Zahl über die Hülle verschluckt.
     *
     * Die absichtlich erfundene Adresse für 4.5 ist ausgenommen — dort ist
     * genau die Ersatzseite das Messziel.
     *
     * Folge ist immer `nicht_pruefbar`, nie „gefallen". Eine Seite, die es auf
     * diesem Ziel noch nicht gibt, ist kein Befund — so wenig wie eine leere
     * Hülle einer ist.
     */
    const nichtVorhanden = seite.pfad !== UNSINN_PFAD && await page.evaluate(
      () => document.querySelector("[data-nicht-gefunden]") !== null);
    if (nichtVorhanden) {
      await page.close();
      return [{
        kontrolle: "01", gate: false, status: "nicht_pruefbar",
        seite: seite.pfad, breite: breite.breite, gemessen: "404-Ersatzseite", schwelle: "die Seite selbst",
        notiz: "Diese Adresse kennt das gemessene Ziel nicht — geliefert wurde die 404-Seite. "
          + "Auf diesem Stand ist über die Adresse nichts zu sagen.",
      }];
    }

    /*
     * Dieselbe Regel für Seiten, deren Inhalt aus der Datenbank kommt.
     *
     * Das Verzeichnis (X6) kennzeichnet sich selbst mit `data-daten-fehlen`, solange
     * es lädt oder die Abfrage gescheitert ist. Ohne diese Zeile hätte der Lauf den
     * Fehlersatz für den Inhalt gehalten und das Blatt als „bestanden" gezählt —
     * gemessen richtig, über den Katalog aber nichts gesagt.
     *
     * Wichtig ist der Unterschied zu einem LEEREN Katalog: der ist ein echter
     * Zustand mit einem echten Satz und wird gemessen. Gekennzeichnet wird nur,
     * wenn die Daten NICHT ANGEKOMMEN sind.
     */
    const datenFehlen = await page.evaluate(
      () => document.querySelector("[data-daten-fehlen]") !== null);
    if (datenFehlen) {
      await page.close();
      return [{
        kontrolle: "01", gate: false, status: "nicht_pruefbar",
        seite: seite.pfad, breite: breite.breite,
        gemessen: "Seite ohne ihre Daten", schwelle: "Seite mit ihren Daten",
        notiz: "Die Seite holt ihren Inhalt aus der Datenbank und hat ihn nicht bekommen. "
          + "Gegen eine lokale Vorschau ist das der Normalfall (der Browser läuft dort ohne "
          + "Proxy, siehe Kommentar am Proxy) — gemessen werden muss sie gegen ein "
          + "ausgeliefertes Ziel.",
      }];
    }

    if (ruhigeBewegung) {
      // 3.9: hier zählt nur, dass die Seite trägt und der Hauptweg erreichbar bleibt.
      befunde.push(...await messeKnopfVerdeckung(page, seite.pfad, breite.breite));
      befunde[befunde.length - 1] = { ...befunde[befunde.length - 1], kontrolle: "3.9", gate: false };
      await page.close();
      return huelleMarkieren(befunde, datenFehler);
    }

    // Jede Kontrolle sagt, wie lange sie gebraucht hat — damit „das dauert lange"
    // eine Zahl bekommt statt eines Gefühls.
    const mitUhr = async (name: string, f: () => Promise<Befund[]>) => {
      if (NUR_KONTROLLEN && !NUR_KONTROLLEN.includes(name)) return;
      const t = Date.now();
      const r = await f();
      process.stderr.write(`    ${name} ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
      befunde.push(...r);
    };
    await mitUhr("3.8", () => messeLayout(page, seite.pfad, breite.breite));
    await mitUhr("3.5", () => messeTrefferflaechen(page, seite.pfad, breite));
    await mitUhr("X.dreh", () => messeDrehHinweis(page, seite.pfad, breite, DREH_ERWARTET));
    await mitUhr("X.blatt", () => messeBlattgeometrie(page, seite.pfad, breite, BLATT_ERWARTET));
    await mitUhr("3.10", () => messeKnopfVerdeckung(page, seite.pfad, breite.breite));
    await mitUhr("5.x", () => messeKopfdaten(page, seite.pfad, breite.breite));
    await mitUhr("3.4", () => messeFokus(page, seite.pfad, breite.breite));
    // Kontrast zuletzt: er stellt Bewegung still und färbt Glyphen um.
    await mitUhr("3.3", () => messeKontrast(page, seite.pfad, breite.breite));

    // 3.7 — die Aufnahme, gegen die jede Zahl gegengelesen werden kann.
    // Bei einem Teillauf entfällt sie: sie gehört zum Gesamtbild, nicht zu einer
    // einzelnen Kontrolle, und auf langen Seiten kostet sie am meisten Zeit.
    if (!NUR_KONTROLLEN) {
      mkdirSync(ORDNER, { recursive: true });
      await page.screenshot({
        path: join(ORDNER, `${seite.name}--${breite.name.replace(/\s+/g, "-")}.png`),
        fullPage: true,
      });
    }

    groessen.sort((a, b) => b.bytes - a.bytes);
    befunde.push({
      kontrolle: "4.7", gate: true,
      status: gewicht > SCHWELLEN.gewicht_seite ? "gefallen" : "bestanden",
      seite: seite.pfad, breite: breite.breite,
      auswahl: groessen.slice(0, SCHWELLEN.liste_laenge).map((g) => `${g.url} ${Math.round(g.bytes / 1024)}kB`).join(" · "),
      gemessen: gewicht, schwelle: SCHWELLEN.gewicht_seite,
      notiz: `Gesamtgewicht der Seite in Byte über ${groessen.length} Antworten`,
    });
    befunde.push({
      kontrolle: "—", gate: false,
      status: konsole.length + fehlgeschlagen.length > 0 ? "gefallen" : "bestanden",
      seite: seite.pfad, breite: breite.breite,
      auswahl: [...konsole.slice(0, 5), ...fehlgeschlagen.slice(0, 5)].join(" · ") || undefined,
      gemessen: konsole.length + fehlgeschlagen.length, schwelle: 0,
      notiz: `${konsole.length} Konsolenfehler, ${fehlgeschlagen.length} fehlgeschlagene Anfragen`,
    });
  } catch (e) {
    befunde.push({
      kontrolle: "01", gate: false, status: "nicht_pruefbar",
      seite: seite.pfad, breite: breite.breite, gemessen: null, schwelle: null,
      notiz: `Messung abgebrochen: ${(e as Error).message}`,
    });
  } finally {
    await page.close();
  }
  return huelleMarkieren(befunde, datenFehler);
}

/** 4.3 Wege · 4.5 404 — beides über echte Anfragen, einmal je Lauf. */
async function wegeUnd404(browser: Browser, basis: string): Promise<Befund[]> {
  const befunde: Befund[] = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "de-DE" });
  await nameHelferSetzen(page);
  try {
    await page.goto(basis + "/", { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(RUHE_MS);
    const links = await page.evaluate((host) => {
      const intern: string[] = [];
      const extern: string[] = [];
      const post: string[] = [];
      for (const a of Array.from(document.querySelectorAll("a[href]"))) {
        const href = (a as HTMLAnchorElement).href;
        if (/^(mailto|tel):/i.test(href)) post.push(href);
        else if (href.startsWith("http") && new URL(href).host !== host) extern.push(href);
        else if (href.startsWith("http")) intern.push(new URL(href).pathname);
      }
      return {
        intern: [...new Set(intern)], extern: [...new Set(extern)].slice(0, 20), post: [...new Set(post)],
      };
    }, new URL(basis).host);

    // Interne Wege: eine SPA beantwortet jede Adresse mit 200 und der Hülle. Deshalb
    // wird zusätzlich geprüft, ob die Anwendung dort ihre 404-Ansicht zeigt.
    const schlecht: string[] = [];
    for (const pfad of links.intern.slice(0, 40)) {
      const antwort = await page.goto(basis + pfad, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
      await page.waitForTimeout(400);
      const status = antwort?.status() ?? 0;
      const zeigt404 = await page.evaluate(() => /404|nicht gefunden|not found/i.test(document.body.innerText.slice(0, 400)));
      if (status >= 400 || zeigt404) schlecht.push(`${pfad} (${status}${zeigt404 ? ", 404-Ansicht" : ""})`);
    }
    befunde.push({
      kontrolle: "4.3", gate: true, status: schlecht.length > 0 ? "gefallen" : "bestanden",
      seite: "/", breite: 1280,
      auswahl: schlecht.slice(0, SCHWELLEN.liste_laenge).join(" · ") || undefined,
      gemessen: schlecht.length, schwelle: 0,
      notiz: `${links.intern.length} interne Wege gefunden, ${Math.min(links.intern.length, 40)} angesteuert · `
        + `${links.extern.length} externe Adressen und ${links.post.length} mailto/tel wurden nicht angefasst `
        + "(externe Ziele gehören nicht in einen automatischen Lauf).",
    });

    const unsinn = await page.goto(basis + UNSINN_PFAD, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
    await page.waitForTimeout(1200);
    const zurueck = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).some((a) => {
        const h = (a as HTMLAnchorElement).getAttribute("href") ?? "";
        return h === "/" || h.endsWith("/");
      }));
    const status = unsinn?.status() ?? 0;
    /*
     * Die Spur der Middleware, direkt an der Antwort abgelesen.
     *
     * Ohne diese Zeile sagt ein gefallenes 4.5 nur „Status 200" — und das sieht
     * bei drei verschiedenen Ursachen gleich aus: die Middleware lief gar nicht,
     * sie lief und hielt die Adresse für bekannt, oder sie lief und kam nicht an
     * die Hülle. Drei Ursachen, drei Behebungen. `middleware.ts` setzt deshalb
     * `x-pawn-404` auf JEDEM Weg; hier wird der Kopf gelesen, statt ihn in einem
     * eigenen curl-Schritt zu suchen, dessen Ausgabe niemand mehr findet.
     */
    const koepfe = unsinn?.headers() ?? {};
    const spur = koepfe["x-pawn-404"];
    befunde.push({
      kontrolle: "4.5", gate: true,
      status: status === 404 && zurueck ? "bestanden" : "gefallen",
      seite: UNSINN_PFAD, breite: 1280,
      gemessen: `Status ${status}, Weg zurück ${zurueck ? "vorhanden" : "fehlt"}`,
      schwelle: "Status 404 und ein Weg zurück",
      notiz: [
        spur
          ? `Spur x-pawn-404: „${spur}" — die Middleware lief.`
          : "Keine Kopfzeile x-pawn-404: die Middleware lief für diese Anfrage nicht.",
        status === 200
          ? "Die Adresse antwortet mit 200. Bei einer SPA mit Rewrite ist das die Hülle — für "
            + "Suchmaschinen ist eine erfundene Adresse damit eine gültige Seite."
          : null,
      ].filter(Boolean).join(" "),
    });
  } catch (e) {
    befunde.push({
      kontrolle: "4.3", gate: true, status: "nicht_pruefbar", seite: "/", breite: 1280,
      gemessen: null, schwelle: null, notiz: `Wege-Prüfung abgebrochen: ${(e as Error).message}`,
    });
  } finally {
    await page.close();
  }
  // Hier gilt die Hüllen-Regel NICHT: 4.3 und 4.5 lesen HTTP-Antworten, nicht
  // den Inhalt einer Seite. Ob Supabase geantwortet hat, ändert weder den
  // Statuscode eines Weges noch den einer erfundenen Adresse.
  //
  // Diese Zeile ist eine Fehlerkorrektur, nicht nur eine Aufräumung: stand hier
  // `huelleMarkieren(befunde, datenFehler)`, brach JEDER Lauf mit
  // `ReferenceError: datenFehler is not defined` ab — nach der vollständigen
  // Messung, aber vor dem Schreiben von `bericht.json`. Sie kam aus zwei
  // Zweigen zugleich (#173 und #174) und ist beim Zusammenführen einmal
  // übrig geblieben, wie es sein soll.
  return befunde;
}

async function haupt() {
  /*
   * `--adresse https://…` misst eine frei übergebene Adresse.
   *
   * Nötig für die Vercel-Vorschau: ihr Name enthält einen gekürzten Zweignamen
   * („…-git-claude-357453-…"), der sich aus dem Zweig NICHT verlässlich ableiten
   * lässt. Ihn zu erraten wäre eine Fehlerquelle, die niemand findet — also wird
   * er übergeben. Die benannten Ziele bleiben unverändert.
   */
  const freieAdresse = argument("adresse") ?? process.env.PRUEFSTAND_ADRESSE?.trim();
  const zielName = (freieAdresse ? "vorschau" : (argument("ziel") ?? VORGABE_ZIEL)) as ZielName;
  const ziel = freieAdresse
    ? { adresse: freieAdresse.replace(/\/+$/, ""), hinweis: "frei übergebene Adresse" }
    : ZIELE[zielName];
  if (!ziel) {
    console.error(`Unbekanntes Ziel „${zielName}". Bekannt: ${Object.keys(ZIELE).join(", ")}`);
    process.exit(2);
  }
  const nurSeiten = argument("seiten")?.split(",").map((s) => s.trim());
  const seiten = nurSeiten ? SEITEN.filter((s) => nurSeiten.includes(s.name)) : SEITEN;
  const nurBreiten = argument("breiten")?.split(",").map((b) => Number(b.trim()));
  const breiten = nurBreiten ? BREITEN.filter((b) => nurBreiten.includes(b.breite)) : BREITEN;

  /*
   * Steht ein Ausgangs-Proxy in der Umgebung (Container, CI), muss der Browser ihn
   * benutzen — sonst misst er nur einen Verbindungsfehler. Für ein lokales Ziel gilt
   * das nicht: die Umleitung über den Proxy beantwortet 127.0.0.1 mit 405.
   *
   * Der Preis dieses Sonderfalls ist gemessen und bekannt: ohne Proxy erreicht der
   * Browser auch die Datenbank nicht (`ERR_CONNECTION_RESET`). Gegen eine lokale
   * Vorschau ist eine Seite, die ihre Stücke aus der Datenbank holt, deshalb NICHT
   * prüfbar — sie zeigt dort ihren Fehlersatz. Vier Bypass-Schreibweisen wurden
   * durchprobiert (keine, `127.0.0.1,localhost,::1`, `<local>`, mit Port): alle vier
   * ergaben lokal 405 UND außen einen Verbindungsabbruch. Es gibt hier also keine
   * Einstellung, die beides kann.
   *
   * Damit daraus kein falsches „bestanden" wird, kennzeichnen die betroffenen Seiten
   * ihren datenlosen Zustand selbst (`data-daten-fehlen`), und der Lauf zählt sie als
   * nicht prüfbar — dieselbe Hüllen-Regel wie bei `data-nicht-gefunden`.
   */
  const lokalesZiel = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(ziel.adresse).hostname);
  const proxyServer = lokalesZiel ? undefined : (process.env.HTTPS_PROXY ?? process.env.https_proxy);
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PFAD,
    // Chromium versteht die üblichen NO_PROXY-Listen mit CIDR und Sternchen nicht;
    // eine falsch geparste Liste schaltet den Proxy stillschweigend ganz ab.
    proxy: proxyServer ? { server: proxyServer, bypass: "localhost,127.0.0.1,::1" } : undefined,
  });
  const befunde: Befund[] = [];
  for (const seite of seiten) {
    for (const breite of breiten) {
      process.stderr.write(`… ${seite.pfad} @ ${breite.name}\n`);
      befunde.push(...await seiteMessen(browser, ziel.adresse, seite, breite));
    }
  }
  /*
   * 3.9 — zweiter Durchlauf mit „Bewegung reduzieren".
   *
   * Zwei Lagen, nicht eine. Hochkant steht auf der Hülle der Dreh-Hinweis — dort
   * läuft überhaupt keine Bewegung, die Prüfung wäre leer. Gemessen wird deshalb
   * auch quer, wo das Heft wirklich blättert. Die hochkante Lage bleibt trotzdem
   * drin: die übrigen Seiten animieren dort sehr wohl.
   */
  const bewegungsLagen = [
    BREITEN[0],
    BREITEN.find((b) => b.breite > b.hoehe && b.eingabe === "finger") ?? BREITEN[0],
  ].filter((b, i, alle) => alle.indexOf(b) === i);
  for (const seite of seiten) {
    for (const lage of bewegungsLagen) {
      process.stderr.write(`… ${seite.pfad} @ ${lage.name} (Bewegung reduziert)\n`);
      befunde.push(...await seiteMessen(browser, ziel.adresse, seite, lage, true));
    }
  }
  process.stderr.write("… Wege und 404\n");
  // Wege und 404 gehören zum Gesamtbild, nicht zu einer einzelnen Kontrolle.
  if (!NUR_KONTROLLEN) befunde.push(...await wegeUnd404(browser, ziel.adresse));
  await browser.close();

  const gates = befunde.filter((b) => b.gate);
  const bericht = {
    ziel: zielName,
    adresse: ziel.adresse,
    zeitpunkt: new Date().toISOString(),
    commit: commit(),
    // Steht hier etwas, war es ein Teillauf: die Gate-Zahlen unten zählen dann
    // nur diese Kontrollen und sind kein Gesamtstand.
    nur_kontrollen: NUR_KONTROLLEN ?? null,
    gates: {
      bestanden: gates.filter((b) => b.status === "bestanden").length,
      gefallen: gates.filter((b) => b.status === "gefallen").length,
      nicht_pruefbar: gates.filter((b) => b.status === "nicht_pruefbar").length,
    },
    befunde,
  };

  mkdirSync(ORDNER, { recursive: true });
  writeFileSync(join(ORDNER, "bericht.json"), JSON.stringify(bericht, null, 2));

  const gefallen = bericht.gates.gefallen;
  process.stderr.write(
    `\n${zielName} · ${ziel.adresse}\n`
    + (NUR_KONTROLLEN ? `TEILLAUF — nur ${NUR_KONTROLLEN.join(", ")}\n` : "")
    + `Gates: ${bericht.gates.bestanden} bestanden · ${gefallen} gefallen · `
    + `${bericht.gates.nicht_pruefbar} nicht prüfbar\n`
    + `Bericht: tools/pruefstand/artefakte/bericht.json\n`,
  );

  /*
   * Die gefallenen Gates einzeln ins Log.
   *
   * Bisher stand am Ende nur eine Zahl. Wer den Lauf nicht auf der eigenen
   * Maschine wiederholen kann — und das gilt für jeden, der nur die Ausgabe des
   * Runners sieht —, wusste damit, DASS 26 Gates gefallen sind, aber nicht
   * welche. Eine Zahl ohne Fundstelle ist kein Befund, sondern eine Behauptung.
   *
   * `bericht.json` liegt als Artefakt bei und bleibt die vollständige Quelle;
   * diese Liste ist der Auszug, den man ohne Download lesen kann. Gekürzt auf
   * 60 Zeilen, damit ein durchgefallener Lauf das Log nicht zuschüttet.
   */
  /*
   * Im Teillauf: ALLE Befunde der gefragten Kontrollen, auch die bestandenen.
   *
   * Wer ausdrücklich nach drei Kontrollen fragt, will ihre Zahlen sehen und
   * nicht ihr Urteil. „Kein Gate gefallen" beantwortet nicht die Frage, ob das
   * Blatt 0,72 misst — es sagt nur, dass niemand widersprochen hat. Genau
   * daran ist die Ausnahme A1 hängen geblieben: gemessen wurde, aber die Zahl
   * stand nur in `bericht.json`, und das Artefakt lässt sich aus dem Container
   * nicht herunterladen.
   */
  if (NUR_KONTROLLEN) {
    const gefragt = befunde.filter((b) => NUR_KONTROLLEN.includes(b.kontrolle));
    process.stderr.write(`\nBefunde der gefragten Kontrollen (${gefragt.length}):\n`);
    for (const b of gefragt.slice(0, 200)) {
      const ort = `${b.seite} @ ${b.breite}px`;
      const beleg = [
        b.gemessen !== null ? `gemessen ${b.gemessen}` : null,
        b.schwelle !== null ? `soll ${b.schwelle}` : null,
        b.notiz,
      ].filter(Boolean).join(" · ");
      process.stderr.write(
        `  ${b.status.padEnd(14)} ${b.kontrolle.padEnd(8)} ${ort.padEnd(34)} ${beleg}\n`,
      );
    }
  }

  if (gefallen > 0) {
    const liste = gates.filter((b) => b.status === "gefallen");
    process.stderr.write(`\nGefallene Gates (${liste.length}):\n`);
    for (const b of liste.slice(0, 60)) {
      const ort = `${b.seite} @ ${b.breite}px`;
      // Der Beleg: was gemessen wurde, wogegen, und wo genau. Ohne diese drei
      // Angaben ist eine Zeile hier so wenig wert wie die Zahl allein.
      const beleg = [
        b.auswahl,
        b.gemessen !== null ? `gemessen ${b.gemessen}` : null,
        b.schwelle !== null ? `soll ${b.schwelle}` : null,
        b.notiz,
      ].filter(Boolean).join(" · ");
      process.stderr.write(`  ${b.kontrolle.padEnd(5)} ${ort.padEnd(44)} ${beleg}\n`);
    }
    if (liste.length > 60) {
      process.stderr.write(`  … ${liste.length - 60} weitere, vollständig in bericht.json\n`);
    }
  }

  process.exit(gefallen > 0 ? 1 : 0);
}

void haupt();
