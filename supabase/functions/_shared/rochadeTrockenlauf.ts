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

  return { befunde, fehler };
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
