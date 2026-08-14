// Die lange Rochade — Regressionstests für Sicherheit und Adapter.
// Ausführen mit: deno test supabase/functions/_shared/rochade.test.ts
//
// Diese beiden Module sind bewusst ohne Netz- und Datenbankzugriff geschrieben,
// damit genau das hier möglich ist: die Kaskade und der SSRF-Schutz sind prüfbar,
// nicht nur behauptet.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { aufloesen, istPrivateAdresse, pruefeZiel } from "./rochadeSicherheit.ts";
import {
  entdopple,
  erkennePlattform,
  groessteAusSrcset,
  bilderAusHtml,
  jsonLdLesen,
  preisZuCent,
  produktEndpunkt,
  shopifyLesen,
  sitemapAdressen,
  wooLesen,
} from "./rochadeAdapter.ts";
import {
  exifOrientierung,
  formatErkennen,
  istZierbild,
  raenderFinden,
  zielMass,
  ablageOrt,
} from "./rochadeBild.ts";

/* ------------------------------------------------------------ Sicherheit */

Deno.test("SSRF: private und reservierte Bereiche gelten als privat", () => {
  for (const ip of [
    "127.0.0.1", "10.1.2.3", "172.16.5.5", "172.31.255.255", "192.168.1.1",
    "169.254.169.254", "0.0.0.0", "::1", "fc00::1", "fe80::1", "::ffff:10.0.0.1",
  ]) {
    assertEquals(istPrivateAdresse(ip), true, `${ip} müsste privat sein`);
  }
});

Deno.test("SSRF: öffentliche Adressen bleiben erlaubt", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34", "2606:2800::1"]) {
    assertEquals(istPrivateAdresse(ip), false, `${ip} müsste öffentlich sein`);
  }
});

Deno.test("SSRF: pruefeZiel lehnt die klassischen Angriffsziele ab", async () => {
  const faelle: [string, string][] = [
    ["http://example.com", "kein_https"],
    ["https://127.0.0.1/x", "private_adresse"],
    ["https://192.168.0.5/", "private_adresse"],
    ["https://169.254.169.254/latest/meta-data/", "private_adresse"], // Cloud-Metadaten
    ["https://localhost/", "unerlaubter_host"],
    ["https://dienst.internal/", "unerlaubter_host"],
    ["https://[::1]/", "private_adresse"],
  ];
  for (const [url, grund] of faelle) {
    const r = await pruefeZiel(url);
    assertEquals(r.ok, false, `${url} hätte abgelehnt werden müssen`);
    assertEquals(r.grund, grund, url);
  }
});

Deno.test("SSRF: nur Port 443", async () => {
  assertEquals((await pruefeZiel("https://example.com:8080/")).grund, "falscher_port");
  assertEquals((await pruefeZiel("https://example.com:443/")).ok, true);
  assertEquals((await pruefeZiel("https://example.com/")).ok, true);
});

// Diese beiden Dienste sind echte, öffentlich auflösbare Domains, die absichtlich
// auf private Adressen zeigen — der klassische Weg, eine reine Namensprüfung zu
// umgehen. Sie sind hier der Beleg, dass wirklich aufgelöst wird.
Deno.test("SSRF: Name mit privatem A-Record wird geblockt (Netz nötig)", async () => {
  for (const url of ["https://localtest.me/", "https://127-0-0-1.nip.io/", "https://192-168-1-1.nip.io/"]) {
    const r = await pruefeZiel(url);
    assertEquals(r.ok, false, `${url} hätte geblockt werden müssen`);
    assertEquals(r.grund, "private_adresse", url);
  }
});

Deno.test("SSRF: nicht auflösbarer Name lädt nicht (fail closed)", async () => {
  const r = await pruefeZiel("https://gibt-es-garantiert-nicht-xyz123abc.example/");
  assertEquals(r.ok, false);
});

Deno.test("Auflösung: liefert Adressen für einen echten Namen (Netz nötig)", async () => {
  const a = await aufloesen("example.com");
  assertEquals(Array.isArray(a) && a.length > 0, true);
});

/* ------------------------------------------------------ Nichts erfinden */

Deno.test("Preis: fehlende Angabe bleibt leer, wird nie zu 0", () => {
  assertEquals(preisZuCent(""), null);
  assertEquals(preisZuCent(null), null);
  assertEquals(preisZuCent("auf Anfrage"), null);
  assertEquals(preisZuCent("Preis auf Nachfrage"), null);
});

Deno.test("Preis: deutsche und englische Schreibweise", () => {
  assertEquals(preisZuCent("19.90"), 1990);
  assertEquals(preisZuCent("19,90"), 1990);
  assertEquals(preisZuCent("1.234,56"), 123456);
  assertEquals(preisZuCent("1,234.56"), 123456);
});

Deno.test("Text: Inline-Tags hinterlassen kein Leerzeichen vor dem Komma", () => {
  // Vom Trockenlauf gefunden: "<b>gedreht</b>, 24 cm" wurde zu "gedreht , 24 cm".
  const erg = shopifyLesen(
    { products: [{ id: 1, handle: "x", title: "X", body_html: "<p>Steinzeug, <b>gedreht</b>, 24 cm hoch</p>", variants: [], images: [] }] },
    "https://a.de/", 1,
  );
  assertEquals(erg.kandidaten[0].beschreibung_text, "Steinzeug, gedreht, 24 cm hoch");
});

/* --------------------------------------------------------------- Bilder */

Deno.test("Bilder: größte Variante, data-src, und Logos fliegen raus", () => {
  assertEquals(groessteAusSrcset("a.jpg 400w, b.jpg 1600w, c.jpg 800w"), "b.jpg");
  const html = `<img src="/logo.svg"><img data-src="/werk-1.jpg">` +
    `<img srcset="/klein.jpg 400w, /gross.jpg 2000w"><img src="data:image/png;base64,xx">`;
  const bilder = bilderAusHtml(html, "https://beispiel.de/shop");
  assertEquals(bilder.length, 2);
  assertEquals(bilder[0], "https://beispiel.de/werk-1.jpg");
  assertEquals(bilder[1], "https://beispiel.de/gross.jpg");
});

/* -------------------------------------------------- Plattform erkennen */

Deno.test("Erkennung: Signaturen der gängigen Baukästen", () => {
  assertEquals(erkennePlattform({ header: { "x-shopify-stage": "production" } }), "shopify");
  assertEquals(erkennePlattform({ html: '<img src="https://cdn.shopify.com/x.jpg">' }), "shopify");
  assertEquals(erkennePlattform({ html: '<body class="woocommerce-page">' }), "woocommerce");
  assertEquals(erkennePlattform({ html: '<link href="https://static1.squarespace.com/a.css">' }), "squarespace");
  assertEquals(erkennePlattform({ html: "<html><body>Nur Text</body></html>" }), "unbekannt");
});

Deno.test("Erkennung: Shopify-Endpunkt ist paginierbar", () => {
  assertEquals(
    produktEndpunkt("shopify", "https://x.de/eine/seite", 2),
    "https://x.de/products.json?limit=250&page=2",
  );
  assertEquals(produktEndpunkt("unbekannt", "https://x.de/", 1), null);
});

/* ------------------------------------------------------ Shopify-Adapter */

Deno.test("Shopify: liest Titel, Preis, Bilder und Varianten — erfindet keine Währung", () => {
  const antwort = {
    products: [{
      id: 111, handle: "vase-drei", title: "Vase Nr. 3",
      body_html: "<p>Steinzeug, <b>gedreht</b></p>",
      product_type: "Keramik", tags: "unikat, steinzeug",
      variants: [{ title: "Standard", price: "240.00", available: true }],
      images: [{ src: "https://cdn.shopify.com/v3-a.jpg" }, { src: "https://cdn.shopify.com/logo.png" }],
    }],
  };
  const erg = shopifyLesen(antwort, "https://atelier.de/", 1);
  assertEquals(erg.stufe, "adapter");
  assertEquals(erg.kandidaten.length, 1);
  const k = erg.kandidaten[0];
  assertEquals(k.titel, "Vase Nr. 3");
  assertEquals(k.preis_cent, 24000);
  assertEquals(k.waehrung, null); // products.json nennt die Währung nicht — also nicht raten
  assertEquals(k.beschreibung_text, "Steinzeug, gedreht");
  assertEquals(k.bilder.length, 1); // Logo gefiltert
  assertEquals(k.quell_url, "https://atelier.de/products/vase-drei");
  assertEquals(k.kategorien, ["Keramik", "unikat", "steinzeug"]);
  assertEquals(erg.weitere_seite, null); // nur ein Produkt = keine volle Seite
});

/* -------------------------------------------------- WooCommerce-Adapter */

Deno.test("WooCommerce: rechnet Minor-Units korrekt um", () => {
  // Die Store-API liefert den Preis in der kleinsten Einheit plus die Stellenzahl.
  const antwort = [{
    id: 42, name: "Eichenhocker", permalink: "https://moebel.de/hocker",
    description: "<p>Massive Eiche, geölt</p>",
    prices: { price: "24000", currency_code: "EUR", currency_minor_unit: 2 },
    images: [{ src: "https://moebel.de/hocker.jpg" }],
    categories: [{ name: "Sitzmöbel" }],
    is_in_stock: true,
  }];
  const erg = wooLesen(antwort, "https://moebel.de/", 1);
  assertEquals(erg.kandidaten.length, 1);
  const k = erg.kandidaten[0];
  assertEquals(k.preis_cent, 24000);
  assertEquals(k.waehrung, "EUR");
  assertEquals(k.verfuegbar, true);
  assertEquals(k.kategorien, ["Sitzmöbel"]);
});

Deno.test("WooCommerce: Shops mit drei Nachkommastellen rechnen ebenfalls richtig", () => {
  const antwort = [{
    id: 7, name: "Test", prices: { price: "240000", currency_code: "TND", currency_minor_unit: 3 },
  }];
  const k = wooLesen(antwort, "https://x.tn/", 1).kandidaten[0];
  assertEquals(k.preis_cent, 24000); // 240,000 Millimes = 240,00 → 24000 Cent
});

/* --------------------------------------------------------------- JSON-LD */

Deno.test("JSON-LD: findet Product auch im @graph und übersteht kaputte Blöcke", () => {
  const html = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"Organization","name":"Atelier"},
 {"@type":"Product","name":"Vase Nr. 3","sku":"V3","description":"Steinzeug, gedreht",
  "image":["https://beispiel.de/v3-a.jpg","https://beispiel.de/logo.png"],
  "offers":{"@type":"Offer","price":"240.00","priceCurrency":"EUR",
            "availability":"https://schema.org/InStock"}}]}</script>
<script type="application/ld+json">{das ist kaputt</script>
</head></html>`;
  const erg = jsonLdLesen(html, "https://beispiel.de/vase-3");
  assertEquals(erg.stufe, "jsonld");
  assertEquals(erg.kandidaten.length, 1);
  const k = erg.kandidaten[0];
  assertEquals(k.preis_cent, 24000);
  assertEquals(k.waehrung, "EUR"); // hier steht sie in der Quelle — also übernehmen
  assertEquals(k.verfuegbar, true);
  assertEquals(k.bilder.length, 1);
});

Deno.test("JSON-LD: ohne Produkt bleibt die Stufe leer (dann greift HTML+KI)", () => {
  const erg = jsonLdLesen("<html><body>Hallo</body></html>", "https://x.de/");
  assertEquals(erg.stufe, "keine");
  assertEquals(erg.kandidaten.length, 0);
});

/* ------------------------------------------------------------- Dubletten */

Deno.test("Zweiter Lauf derselben Quelle erzeugt keine Dubletten", () => {
  const erg = jsonLdLesen(
    `<script type="application/ld+json">{"@type":"Product","name":"A","sku":"S1",
      "offers":{"price":"10","priceCurrency":"EUR"}}</script>`,
    "https://x.de/a",
  );
  const dreimal = [...erg.kandidaten, ...erg.kandidaten, ...erg.kandidaten];
  assertEquals(dreimal.length, 3);
  assertEquals(entdopple(dreimal).length, 1);
});

/* --------------------------------------------------------------- Sitemap */

Deno.test("Sitemap: Index und Seitenliste werden unterschieden", () => {
  const index = sitemapAdressen("<sitemapindex><sitemap><loc>https://x.de/s1.xml</loc></sitemap></sitemapindex>");
  assertEquals(index.weitereSitemaps.length, 1);
  assertEquals(index.seiten.length, 0);

  const liste = sitemapAdressen("<urlset><url><loc>https://x.de/a</loc></url><url><loc>https://x.de/b</loc></url></urlset>");
  assertEquals(liste.seiten.length, 2);
});


/* --------------------------------------------------------- Bildstrecke */
// Die volle Bildstrecke (Laden, Zuschnitt, WebP) läuft im Trockenlauf gegen
// selbst gebaute Bilder — hier stehen die reinen Byte- und Rechenfunktionen.

Deno.test("Bild: Format kommt aus den Bytes, nicht aus der Endung", () => {
  assertEquals(formatErkennen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), "jpeg");
  assertEquals(formatErkennen(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])), "png");
  assertEquals(formatErkennen(new TextEncoder().encode("<svg xmlns='x'></svg>")), "svg");
  assertEquals(formatErkennen(new Uint8Array([1, 2, 3])), "unbekannt");
});

Deno.test("Bild: EXIF-Orientierung wird gelesen, sonst null", () => {
  const bauen = (wert: number) => {
    const tiff = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, wert, 0x00, 0x00, 0x00];
    const app1 = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
    const laenge = app1.length + 2;
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (laenge >> 8) & 0xff, laenge & 0xff, ...app1, 0xff, 0xda]);
  };
  assertEquals(exifOrientierung(bauen(6)), 6);
  assertEquals(exifOrientierung(bauen(8)), 8);
  assertEquals(exifOrientierung(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])), null);
});

Deno.test("Bild: gleichmäßiger Rand wird gefunden, einfarbige Fläche nicht beschnitten", () => {
  // 10x10, weiß, mit einem schwarzen 4x4-Kern in der Mitte (Rand also je 3 px).
  const b = 10, h = 10;
  const pix = new Uint8Array(b * h * 4).fill(255);
  for (let y = 3; y < 7; y++) {
    for (let x = 3; x < 7; x++) {
      const p = (y * b + x) * 4;
      pix[p] = 0; pix[p + 1] = 0; pix[p + 2] = 0; pix[p + 3] = 255;
    }
  }
  assertEquals(raenderFinden(pix, b, h, 0), { links: 3, oben: 3, rechts: 3, unten: 3 });

  // Diese Frage hat der Trockenlauf aufgeworfen: eine einfarbige Fläche darf
  // nicht als „lauter Rand" gelesen und um 35 % je Seite gekürzt werden.
  const voll = new Uint8Array(b * h * 4).fill(200);
  assertEquals(raenderFinden(voll, b, h, 0), { links: 0, oben: 0, rechts: 0, unten: 0 });
});

Deno.test("Bild: verkleinert auf die lange Kante, vergrößert nie", () => {
  assertEquals(zielMass(4000, 2000, 2000), { breite: 2000, hoehe: 1000 });
  assertEquals(zielMass(2000, 4000, 2000), { breite: 1000, hoehe: 2000 });
  assertEquals(zielMass(300, 200, 2000), { breite: 300, hoehe: 200 });
});

Deno.test("Bild: Zierat wird aussortiert, Werkbilder bleiben", () => {
  assertEquals(istZierbild("https://x.de/assets/logo-header.png"), true);
  assertEquals(istZierbild("https://x.de/i/paypal.svg"), true);
  assertEquals(istZierbild("https://x.de/cdn/vase_1200x.jpg", 1200, 1600), false);
  assertEquals(istZierbild("https://x.de/cdn/vase.jpg", 80, 80), true);
  assertEquals(istZierbild("https://x.de/cdn/streifen.jpg", 1800, 200), true);
});

Deno.test("Bild: gespeichert wird ein Pfad, nie eine ablaufende URL", () => {
  const ort = ablageOrt("nutzer-1", "auftrag-1", "abcdef", "jpeg");
  assertEquals(ort, "nutzer-1/rochade/auftrag-1/abcdef.webp");
  assertEquals(ort.startsWith("http"), false);
  assertEquals(ablageOrt("nutzer-1", "auftrag-1", "abcdef", "jpeg", true).endsWith("-klein.webp"), true);
});
