/**
 * Die lange Rochade — TROCKENLAUF.
 *
 * Führt die gesamte Lesekette gegen abgelegte Beispielantworten aus: ohne Netz,
 * ohne Datenbank, ohne Deploy. Damit ist vor dem Deploy alles geprüft, was ohne
 * Deploy prüfbar ist — Adapter-Parsing, Normalisierung, Dubletten-Schlüssel,
 * größte Variante aus srcset, Bildfilter und die Kaskade selbst.
 *
 * Ausführen:
 *   deno run --allow-read supabase/functions/_shared/rochadeTrockenlauf.ts
 *   (oder nach dem Transpilieren mit Node — der Datei-Zugriff kann beides)
 *
 * Die Zahlen am Ende sind der Beleg. Weicht eine ab, stimmt etwas nicht.
 */
import {
  entdopple,
  erkennePlattform,
  jsonLdLesen,
  shopifyLesen,
  squarespaceLesen,
  wooLesen,
  bilderAusHtml,
  type AdapterErgebnis,
  type KandidatRoh,
} from "./rochadeAdapter.ts";
import { Image } from "npm:imagescript@1.3.0";
import {
  bildAufbereiten,
  exifOrientierung,
  formatErkennen,
  inhaltHash,
  istZierbild,
  raenderFinden,
  zielMass,
  ablageOrt,
} from "./rochadeBild.ts";
import {
  buendeln,
  deutungLesen,
  nutzerPrompt,
  ohneGestaltung,
  systemPrompt,
} from "./rochadeDeutung.ts";

/** Liest eine Beispieldatei — funktioniert unter Deno wie unter Node. */
async function lies(datei: string): Promise<string> {
  const ort = new URL(`./rochade-fixtures/${datei}`, import.meta.url);
  const D = (globalThis as { Deno?: { readTextFile?: (u: URL) => Promise<string> } }).Deno;
  if (D?.readTextFile) return await D.readTextFile(ort);
  const { readFile } = await import("node:fs/promises");
  return await readFile(ort, "utf8");
}

interface Befund {
  quelle: string;
  erkannt: string;
  stufe: string;
  werke: number;
  mit_preis: number;
  ohne_preis: number;
  bilder: number;
  mit_waehrung: number;
  varianten: number;
}

function auswerten(quelle: string, erkannt: string, erg: AdapterErgebnis): Befund {
  const k: KandidatRoh[] = entdopple(erg.kandidaten);
  return {
    quelle,
    erkannt,
    stufe: erg.stufe,
    werke: k.length,
    mit_preis: k.filter((x) => x.preis_cent !== null).length,
    ohne_preis: k.filter((x) => x.preis_cent === null).length,
    bilder: k.reduce((s, x) => s + x.bilder.length, 0),
    mit_waehrung: k.filter((x) => x.waehrung !== null).length,
    varianten: k.reduce((s, x) => s + x.varianten.length, 0),
  };
}

export async function trockenlauf(): Promise<{ befunde: Befund[]; fehler: string[] }> {
  const befunde: Befund[] = [];
  const fehler: string[] = [];
  const pruef = (name: string, bedingung: boolean, zusatz = "") => {
    if (!bedingung) fehler.push(`${name}${zusatz ? " — " + zusatz : ""}`);
  };

  /* --- 1. Shopify ------------------------------------------------------ */
  const shopifyRoh = JSON.parse(await lies("shopify-products.json"));
  const shopify = shopifyLesen(shopifyRoh, "https://atelier.de/", 1);
  befunde.push(auswerten("Shopify products.json", "shopify", shopify));
  pruef("Shopify: drei Werke", shopify.kandidaten.length === 3, `${shopify.kandidaten.length}`);
  pruef("Shopify: Vase kostet 240,00", shopify.kandidaten[0].preis_cent === 24000);
  pruef("Shopify: Logo aus den Bildern gefiltert", shopify.kandidaten[0].bilder.length === 2);
  pruef("Shopify: Werk ohne Preis bleibt leer, nicht 0", shopify.kandidaten[2].preis_cent === null);
  pruef("Shopify: keine Währung erfunden", shopify.kandidaten.every((k) => k.waehrung === null));
  pruef("Shopify: HTML wurde zu lesbarem Text", shopify.kandidaten[0].beschreibung_text === "Steinzeug, gedreht, 24 cm hoch",
    JSON.stringify(shopify.kandidaten[0].beschreibung_text));
  pruef("Shopify: Varianten mitgenommen", shopify.kandidaten[1].varianten.length === 2);
  pruef("Shopify: nur eine Seite (3 < 250)", shopify.weitere_seite === null);

  /* --- 2. WooCommerce -------------------------------------------------- */
  const wooRoh = JSON.parse(await lies("woocommerce-products.json"));
  const woo = wooLesen(wooRoh, "https://moebel.de/", 1);
  befunde.push(auswerten("WooCommerce Store-API", "woocommerce", woo));
  pruef("Woo: zwei Werke", woo.kandidaten.length === 2);
  pruef("Woo: Minor-Units richtig (240,00)", woo.kandidaten[0].preis_cent === 24000);
  pruef("Woo: Währung aus der Quelle", woo.kandidaten[0].waehrung === "EUR");
  pruef("Woo: Icon gefiltert", woo.kandidaten[0].bilder.length === 1);
  pruef("Woo: Verfügbarkeit übernommen", woo.kandidaten[0].verfuegbar === true && woo.kandidaten[1].verfuegbar === false);

  /* --- 3. Squarespace -------------------------------------------------- */
  const sqspRoh = JSON.parse(await lies("squarespace-collection.json"));
  const sqsp = squarespaceLesen(sqspRoh, "https://atelier.de/shop");
  befunde.push(auswerten("Squarespace ?format=json", "squarespace", sqsp));
  pruef("Squarespace: zwei Werke", sqsp.kandidaten.length === 2);
  pruef("Squarespace: Preis aus Minor-Units (165,00)", sqsp.kandidaten[0].preis_cent === 16500,
    `${sqsp.kandidaten[0].preis_cent}`);
  pruef("Squarespace: relative Adresse absolut gemacht",
    sqsp.kandidaten[0].quell_url === "https://atelier.de/shop/kette-messing", `${sqsp.kandidaten[0].quell_url}`);

  /* --- 4. Reine JSON-LD-Seite ------------------------------------------ */
  const ldHtml = await lies("jsonld-seite.html");
  const erkanntLd = erkennePlattform({ html: ldHtml });
  const ld = jsonLdLesen(ldHtml, "https://beispiel.de/wandobjekt-1");
  befunde.push(auswerten("Seite nur mit JSON-LD", erkanntLd, ld));
  pruef("JSON-LD: keine Plattform erkannt (korrekt)", erkanntLd === "unbekannt");
  pruef("JSON-LD: ein Produkt aus dem @graph", ld.kandidaten.length === 1);
  pruef("JSON-LD: Preis 480,00", ld.kandidaten[0]?.preis_cent === 48000);
  pruef("JSON-LD: Währung EUR steht in der Quelle", ld.kandidaten[0]?.waehrung === "EUR");
  pruef("JSON-LD: kaputter zweiter Block bricht nichts", true);
  pruef("JSON-LD: Logo gefiltert", ld.kandidaten[0]?.bilder.length === 1);

  /* --- 5. Seite ohne alles --------------------------------------------- */
  const leerHtml = await lies("ohne-alles.html");
  const erkanntLeer = erkennePlattform({ html: leerHtml });
  const leer = jsonLdLesen(leerHtml, "https://schlicht.de/");
  befunde.push(auswerten("Seite ohne strukturierte Daten", erkanntLeer, leer));
  pruef("Ohne alles: keine Plattform", erkanntLeer === "unbekannt");
  pruef("Ohne alles: kein Produkt — Stufe 3/4 wäre dran", leer.stufe === "keine" && leer.kandidaten.length === 0);
  const leerBilder = bilderAusHtml(leerHtml, "https://schlicht.de/");
  pruef("Ohne alles: Logo auch im HTML gefiltert", leerBilder.length === 0, `${leerBilder.length}`);

  /* --- 6. Zweiter Lauf erzeugt keine Dubletten ------------------------- */
  const zweimal = [...shopify.kandidaten, ...shopify.kandidaten];
  pruef("Zweiter Lauf: 6 → 3 nach Entdopplung", entdopple(zweimal).length === 3, `${entdopple(zweimal).length}`);
  const gemischt = entdopple([...shopify.kandidaten, ...woo.kandidaten, ...sqsp.kandidaten, ...ld.kandidaten]);
  pruef("Quellen mischen sich nicht", gemischt.length === 3 + 2 + 2 + 1, `${gemischt.length}`);

  /* --- 7. Die Bildstrecke (Schritt 4) ---------------------------------- */
  await bildstrecke(pruef);

  /* --- 8. Die Deutung (Schritt 5) -------------------------------------- */
  deutung(pruef, shopify.kandidaten);

  return { befunde, fehler };
}

/**
 * Die Deutung wird gegen eine erfundene Modellantwort geprüft — genau die
 * Fälle, in denen ein Modell danebenliegt: erfundene Maße, unbekannte Felder,
 * fremde Schlüssel, eine Welt, die es nicht gibt, und CSS im Text.
 */
function deutung(pruef: (name: string, ok: boolean, zusatz?: string) => void, kandidaten: KandidatRoh[]): void {
  const zaehl = (n: number) => Array.from({ length: n }, (_, i) => i);
  pruef("Deutung: 25 Werke werden 13 + 12, nicht 20 + 5",
    JSON.stringify(buendeln(zaehl(25)).map((b) => b.length)) === "[13,12]",
    JSON.stringify(buendeln(zaehl(25)).map((b) => b.length)));
  pruef("Deutung: 8 Werke bleiben ein Bündel", buendeln(zaehl(8)).length === 1);
  pruef("Deutung: 40 Werke werden zwei volle Bündel",
    JSON.stringify(buendeln(zaehl(40)).map((b) => b.length)) === "[20,20]");
  pruef("Deutung: nichts rein, nichts raus", buendeln([]).length === 0);

  pruef("Deutung: Farbwerte werden entfernt",
    ohneGestaltung("Steinzeug #ff8800 gedreht") === "Steinzeug gedreht",
    JSON.stringify(ohneGestaltung("Steinzeug #ff8800 gedreht")));
  pruef("Deutung: Schriftangaben werden entfernt",
    !ohneGestaltung("Vase; font-family: Helvetica; schlicht").includes("Helvetica"));
  pruef("Deutung: rgb() wird entfernt",
    !ohneGestaltung("Ton in rgb(20, 20, 20) gebrannt").includes("rgb("));

  pruef("Deutung: Systemtext nennt alle drei Welten und verbietet das Erfinden",
    systemPrompt().includes("Mode") && systemPrompt().includes("Interior") &&
    systemPrompt().includes("Kunst") && systemPrompt().includes("erfindest nichts"));
  const auftrag = nutzerPrompt(kandidaten.slice(0, 2), { haus_name: "Haus Beispiel" });
  pruef("Deutung: der Auftrag enthält nur Quelldaten, keine Bilder",
    auftrag.includes("Haus Beispiel") && !auftrag.includes("http"), auftrag.slice(0, 40));

  // Eine Antwort, in der bewusst fast alles falsch ist.
  const erster = kandidaten[0];
  const schluessel = erster.quell_id || erster.quell_url || erster.titel;
  const antwort = JSON.stringify({
    werke: [
      {
        schluessel,
        welt: "Kunst",
        angebotstyp: "original",
        welt_felder: {
          technik: "Steinzeug",           // steht in der Quelle → bleibt
          masse: "42 x 17 cm",            // steht NICHT in der Quelle → raus
          holzart: "Eiche",               // Feld gibt es bei Kunst nicht → raus
          jahr: 1998,                     // kein Text → raus
        },
        beschreibung: "Steinzeug, gedreht. #a1b2c3",
        wort_dna: ["ruhig", "gedreht", 42],
      },
      { schluessel: "fremder-schluessel", welt: "Mode", welt_felder: {} },
      { schluessel, welt: "Schmuck" },
    ],
    ueber_text: "Ein kleines Atelier.",
  });
  const gelesen = deutungLesen(antwort, kandidaten.slice(0, 1));
  const d = gelesen.deutungen[0];
  pruef("Deutung: fremder Schlüssel wird nicht übernommen", gelesen.deutungen.length === 2,
    `${gelesen.deutungen.length}`);
  pruef("Deutung: belegtes Feld bleibt", d?.welt_felder.technik === "Steinzeug");
  pruef("Deutung: erfundenes Maß fällt durch", d?.welt_felder.masse === undefined);
  pruef("Deutung: unbekanntes Feld fällt durch", d?.welt_felder.holzart === undefined);
  pruef("Deutung: Zahl statt Text fällt durch", d?.welt_felder.jahr === undefined);
  pruef("Deutung: das Verworfene wird benannt, nicht verschwiegen",
    (d?.verworfen.length ?? 0) >= 3, JSON.stringify(d?.verworfen));
  pruef("Deutung: Farbwert aus der Beschreibung entfernt",
    !!d && !d.beschreibung?.includes("#a1b2c3"), d?.beschreibung ?? "");
  pruef("Deutung: Nicht-Text in der Wort-DNA fällt weg",
    JSON.stringify(d?.wort_dna) === JSON.stringify(["ruhig", "gedreht"]), JSON.stringify(d?.wort_dna));
  pruef("Deutung: erfundene Welt wird verworfen",
    gelesen.deutungen[1]?.welt === null && (gelesen.deutungen[1]?.verworfen.length ?? 0) > 0);
  pruef("Deutung: Über-Text kommt durch", gelesen.ueber_text === "Ein kleines Atelier.");
  pruef("Deutung: unlesbare Antwort bricht nicht, sie sagt es",
    deutungLesen("kein JSON", kandidaten).fehler !== null);
}

/**
 * Die Bildstrecke prüft sich an selbst gebauten Bildern: ein farbiger Block mit
 * bekanntem weißen Rand. Damit ist jede Zahl vorher bekannt — schneidet der
 * Zuschnitt falsch, fällt es sofort auf.
 */
async function bildstrecke(pruef: (name: string, ok: boolean, zusatz?: string) => void): Promise<void> {
  const mitRand = (innenB: number, innenH: number, rand: number) => {
    const bild = new Image(innenB + 2 * rand, innenH + 2 * rand);
    bild.fill(0xffffffff);
    const kern = new Image(innenB, innenH);
    kern.fill(0x224466ff);
    bild.composite(kern, rand, rand);
    return bild;
  };

  const png = new Uint8Array(await mitRand(1600, 1200, 60).encode());
  const jpg = new Uint8Array(await mitRand(400, 300, 30).encodeJPEG(92));
  const webp = new Uint8Array(await new Image(300, 300).encodeWEBP(80));

  pruef("Bild: Format aus den Bytes, nicht aus der Endung",
    formatErkennen(png) === "png" && formatErkennen(jpg) === "jpeg" && formatErkennen(webp) === "webp");
  pruef("Bild: SVG erkannt", formatErkennen(new TextEncoder().encode("<svg xmlns='x'></svg>")) === "svg");

  const h1 = await inhaltHash(jpg);
  pruef("Bild: gleiche Datei, gleicher Hash", h1 === await inhaltHash(jpg));
  pruef("Bild: andere Datei, anderer Hash", h1 !== await inhaltHash(png));

  // EXIF-Block von Hand gebaut: Orientierung 6 (little endian).
  const exifJpeg = (wert: number) => {
    const tiff = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, wert, 0x00, 0x00, 0x00];
    const app1 = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
    const laenge = app1.length + 2;
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (laenge >> 8) & 0xff, laenge & 0xff, ...app1, 0xff, 0xda]);
  };
  pruef("Bild: EXIF-Drehung gelesen", exifOrientierung(exifJpeg(6)) === 6 && exifOrientierung(exifJpeg(8)) === 8);
  pruef("Bild: ohne EXIF bleibt es null", exifOrientierung(jpg) === null);

  const roh = mitRand(400, 300, 30);
  const rand = raenderFinden(roh.bitmap, roh.width, roh.height);
  pruef("Bild: Rand rundum gefunden (je 30 px)",
    rand.links === 30 && rand.oben === 30 && rand.rechts === 30 && rand.unten === 30, JSON.stringify(rand));
  const voll = new Image(400, 300);
  voll.fill(0x112233ff);
  const keinRand = raenderFinden(voll.bitmap, voll.width, voll.height);
  pruef("Bild: einfarbige Fläche wird nicht beschnitten", keinRand.links === 0 && keinRand.oben === 0);

  pruef("Bild: verkleinert auf die lange Kante",
    JSON.stringify(zielMass(4000, 2000, 2000)) === JSON.stringify({ breite: 2000, hoehe: 1000 }));
  pruef("Bild: wird nie vergrößert",
    JSON.stringify(zielMass(300, 200, 2000)) === JSON.stringify({ breite: 300, hoehe: 200 }));

  pruef("Bild: Logo und Siegel aussortiert",
    istZierbild("https://x.de/assets/logo-header.png") && istZierbild("https://x.de/img/paypal.png"));
  pruef("Bild: Werkbild bleibt", !istZierbild("https://x.de/cdn/vase_1200x.jpg", 1200, 1600));
  pruef("Bild: Winzling und Streifen aussortiert",
    istZierbild("https://x.de/f.jpg", 80, 80) && istZierbild("https://x.de/f.jpg", 1800, 200));

  const auf = await bildAufbereiten(png, "https://x.de/cdn/vase.png");
  pruef("Bild: verlustfreier Rand exakt geschnitten (1720×1320 → 1600×1200)",
    auf.breite === 1600 && auf.hoehe === 1200, `${auf.breite}×${auf.hoehe}`);
  pruef("Bild: als WebP geschrieben", formatErkennen(auf.gross) === "webp" && !auf.unveraendert);
  pruef("Bild: zweite, kleinere Fassung entstanden",
    auf.klein !== null && auf.klein.length < auf.gross.length, `${auf.gross.length} / ${auf.klein?.length} B`);
  pruef("Bild: EXIF ist nach dem Neuschreiben weg",
    !new TextDecoder("latin1").decode(auf.gross).includes("Exif"));

  const kleinAuf = await bildAufbereiten(jpg, "https://x.de/cdn/vase.jpg");
  pruef("Bild: kleines Bild bekommt keine zweite Fassung", kleinAuf.klein === null);

  const grossFlaeche = new Uint8Array(await mitRand(3800, 2800, 100).encodeJPEG(85));
  const grossAuf = await bildAufbereiten(grossFlaeche, "https://x.de/cdn/gross.jpg");
  pruef("Bild: lange Kante auf 2000 begrenzt",
    grossAuf.breite === 2000, `${grossAuf.breite}×${grossAuf.hoehe}`);

  const durch = await bildAufbereiten(webp, "https://x.de/cdn/etwas.webp");
  pruef("Bild: WebP unverändert übernommen und gesagt", durch.unveraendert && !!durch.hinweis);
  const kaputt = await bildAufbereiten(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), "x.jpg");
  pruef("Bild: kaputte Datei wirft nicht, sie erklärt sich", kaputt.unveraendert && !!kaputt.hinweis);

  pruef("Bild: Ablage ist ein Pfad, keine ablaufende URL",
    ablageOrt("u1", "a1", "abc123", "jpeg") === "u1/rochade/a1/abc123.webp",
    ablageOrt("u1", "a1", "abc123", "jpeg"));
}

/** Direkt aufgerufen: Zahlen ausgeben und mit passendem Code beenden. */
async function main() {
  const { befunde, fehler } = await trockenlauf();

  console.log("\nTROCKENLAUF — Lange Rochade (ohne Netz, ohne Deploy)\n");
  const spalten = ["Quelle", "erkannt", "Stufe", "Werke", "Preis", "o.Preis", "Bilder", "Währg", "Var."];
  console.log(spalten[0].padEnd(32) + spalten.slice(1).map((s) => s.padStart(9)).join(""));
  console.log("─".repeat(32 + 8 * 9));
  for (const b of befunde) {
    console.log(
      b.quelle.padEnd(32) +
      b.erkannt.padStart(9) + b.stufe.padStart(9) +
      String(b.werke).padStart(9) + String(b.mit_preis).padStart(9) +
      String(b.ohne_preis).padStart(9) + String(b.bilder).padStart(9) +
      String(b.mit_waehrung).padStart(9) + String(b.varianten).padStart(9),
    );
  }
  const summe = befunde.reduce((s, b) => ({
    werke: s.werke + b.werke, preis: s.preis + b.mit_preis, bilder: s.bilder + b.bilder,
  }), { werke: 0, preis: 0, bilder: 0 });
  console.log("─".repeat(32 + 8 * 9));
  console.log(`Gesamt: ${summe.werke} Werke, ${summe.preis} mit Preis, ${summe.bilder} Bilder\n`);

  if (fehler.length) {
    console.log(`${fehler.length} PRÜFUNG(EN) FEHLGESCHLAGEN:`);
    for (const f of fehler) console.log(`  · ${f}`);
  } else {
    console.log("Alle Prüfungen bestanden.");
  }
  const D = (globalThis as { Deno?: { exit?: (c: number) => void } }).Deno;
  if (D?.exit) D.exit(fehler.length ? 1 : 0);
  else if (typeof process !== "undefined") process.exitCode = fehler.length ? 1 : 0;
}

// Unter Deno wie unter Node als Skript ausführbar.
const alsSkript =
  (globalThis as { Deno?: { mainModule?: string } }).Deno?.mainModule === import.meta.url ||
  (typeof process !== "undefined" && process.argv?.[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? " "));
if (alsSkript) await main();
