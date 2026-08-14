/**
 * Die lange Rochade — Schritt 3: Erkennen und Sammeln.
 *
 * Der Qualitätssprung liegt nicht in besserer KI, sondern darin, die Quelle zu
 * erkennen. Fast jeder Shop gibt seine Produkte selbst sauber heraus. Deshalb die
 * Kaskade, streng von oben nach unten — jede Stufe greift NUR, wenn die darüber
 * nichts brachte:
 *
 *   1. Plattform-Adapter (Shopify, WooCommerce, Squarespace, Big Cartel, Ecwid)
 *   2. JSON-LD `Product` aus dem HTML
 *   3. HTML + KI  (nicht hier, sondern im Arbeiter — hier endet das Raten)
 *   4. Screenshot-Weg (die bestehende kurze Rochade)
 *
 * Dieses Modul ist reine Datenarbeit: es liest und normalisiert, es speichert nichts
 * und ruft keine KI. Dadurch ist es vollständig testbar — und getestet.
 *
 * Gesetz 4 gilt in jeder Zeile: was nicht in der Quelle steht, bleibt leer. Kein
 * Standardpreis, keine geratene Währung, keine erfundene Beschreibung.
 */

export type Plattform =
  | "shopify"
  | "woocommerce"
  | "squarespace"
  | "bigcartel"
  | "ecwid"
  | "shopware"
  | "unbekannt";

/** Ein gefundenes Werk, so roh wie möglich — die Deutung passiert später. */
export interface KandidatRoh {
  /** Eindeutig je Quelle: verhindert Dubletten beim zweiten Lauf. */
  quell_id: string;
  quell_url: string | null;
  titel: string;
  beschreibung_html: string | null;
  beschreibung_text: string | null;
  /** In der kleinsten Einheit (Cent), damit nichts gerundet wird. Null = nicht angegeben. */
  preis_cent: number | null;
  waehrung: string | null;
  /** Bilder in der Reihenfolge der Quelle; das erste wird später Titelbild. */
  bilder: string[];
  varianten: { titel: string; preis_cent: number | null; verfuegbar: boolean | null }[];
  kategorien: string[];
  verfuegbar: boolean | null;
}

export interface AdapterErgebnis {
  plattform: Plattform;
  stufe: "adapter" | "jsonld" | "keine";
  kandidaten: KandidatRoh[];
  /** Gibt es weitere Seiten? Dann muss der Arbeiter nachladen. */
  weitere_seite: string | null;
}

/* ------------------------------------------------------------- Werkzeuge */

/** HTML zu Text — ohne Bibliothek, bewusst konservativ. */
export function htmlZuText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    // Inline-Tags (<b>, <em> …) hinterlassen sonst ein Leerzeichen vor dem
    // Satzzeichen: "gedreht , 24 cm". Vom Trockenlauf gefunden.
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

/**
 * Preis in Cent. Nimmt Zahlen wie "19.90", "19,90", 1990 (Minor-Units) entgegen.
 * Gibt null zurück, wenn nichts Verwertbares dasteht — nie 0 als Ersatz.
 */
export function preisZuCent(wert: unknown, bereitsMinor = false): number | null {
  if (wert === null || wert === undefined || wert === "") return null;
  if (typeof wert === "number") {
    if (!Number.isFinite(wert)) return null;
    return bereitsMinor ? Math.round(wert) : Math.round(wert * 100);
  }
  if (typeof wert !== "string") return null;
  const roh = wert.trim().replace(/[^\d.,-]/g, "");
  if (!roh) return null;
  // "1.234,56" (deutsch) vs "1,234.56" (englisch)
  let normal = roh;
  if (roh.includes(",") && roh.includes(".")) {
    normal = roh.lastIndexOf(",") > roh.lastIndexOf(".")
      ? roh.replace(/\./g, "").replace(",", ".")
      : roh.replace(/,/g, "");
  } else if (roh.includes(",")) {
    normal = roh.replace(",", ".");
  }
  const zahl = Number(normal);
  if (!Number.isFinite(zahl)) return null;
  return bereitsMinor ? Math.round(zahl) : Math.round(zahl * 100);
}

/** Bilder, die kein Werk sind — Logos, Icons, Bezahl- und Sozialsymbole. */
const BILD_AUSSCHLUSS = /logo|icon|favicon|sprite|pixel|avatar|badge|button|placeholder|spacer|payment|paypal|klarna|visa|mastercard|instagram|facebook|tiktok|pinterest|whatsapp|cookie/i;

export function istWerkBild(url: string): boolean {
  if (!url || url.startsWith("data:")) return false;
  return !BILD_AUSSCHLUSS.test(url);
}

/** Aus einem srcset die größte Variante ziehen. */
export function groessteAusSrcset(srcset: string): string | null {
  let beste: string | null = null;
  let bestesMass = -1;
  for (const teil of srcset.split(",")) {
    const stuecke = teil.trim().split(/\s+/);
    const url = stuecke[0];
    if (!url) continue;
    const mass = stuecke[1] ?? "";
    const zahl = /^(\d+(?:\.\d+)?)(w|x)$/.exec(mass);
    const wert = zahl ? Number(zahl[1]) * (zahl[2] === "x" ? 1000 : 1) : 0;
    if (wert >= bestesMass) { bestesMass = wert; beste = url; }
  }
  return beste;
}

/** Protokollrelative und relative Adressen auf die Quelle beziehen. */
export function absolut(url: string, basis: string): string | null {
  try {
    if (url.startsWith("//")) return new URL(`https:${url}`).toString();
    return new URL(url, basis).toString();
  } catch { return null; }
}

/* --------------------------------------------------------- Plattform erkennen */

export interface Signale {
  html?: string;
  header?: Record<string, string>;
  /** Hat /products.json geantwortet und sah es nach Shopify aus? */
  shopifyProductsJson?: boolean;
}

/**
 * Erkennung über Signaturen: Header, Meta-Generator, typische Pfade und
 * plattformtypische Markierungen im HTML.
 */
export function erkennePlattform(signale: Signale): Plattform {
  const h = signale.header ?? {};
  const kopfText = Object.entries(h).map(([k, v]) => `${k}: ${v}`).join("\n").toLowerCase();
  const html = (signale.html ?? "").toLowerCase();

  if (signale.shopifyProductsJson) return "shopify";
  if (kopfText.includes("x-shopify") || kopfText.includes("shopify")) return "shopify";
  if (html.includes("cdn.shopify.com") || html.includes("shopify.theme") || html.includes("myshopify.com")) return "shopify";

  if (html.includes("woocommerce") || html.includes("wp-content/plugins/woocommerce")) return "woocommerce";
  if (/<meta[^>]+name=["']generator["'][^>]+woocommerce/i.test(signale.html ?? "")) return "woocommerce";

  if (html.includes("squarespace.com") || html.includes("static1.squarespace") || html.includes("squarespace-cdn")) return "squarespace";
  if (html.includes("bigcartel.com") || html.includes("assets.bigcartel")) return "bigcartel";
  if (html.includes("ecwid.com") || html.includes("app.ecwid.com")) return "ecwid";
  if (html.includes("shopware") || kopfText.includes("shopware")) return "shopware";

  // WordPress ohne Woo ist keine Shop-Plattform — dann greift JSON-LD/HTML.
  return "unbekannt";
}

/** Die Adresse, unter der eine Plattform ihre Produkte herausgibt. */
export function produktEndpunkt(plattform: Plattform, basis: string, seite: number): string | null {
  const ursprung = (() => { try { return new URL(basis).origin; } catch { return null; } })();
  if (!ursprung) return null;
  switch (plattform) {
    case "shopify":
      return `${ursprung}/products.json?limit=250&page=${seite}`;
    case "woocommerce":
      return `${ursprung}/wp-json/wc/store/products?per_page=100&page=${seite}`;
    case "squarespace":
      // Sammlungsseiten geben mit ?format=json ihre Items heraus.
      return seite === 1 ? `${basis.replace(/\/$/, "")}?format=json` : null;
    default:
      return null;
  }
}

/* ------------------------------------------------------------- Shopify */

export function shopifyLesen(json: unknown, basis: string, seite: number): AdapterErgebnis {
  const produkte = (json as { products?: unknown[] })?.products;
  if (!Array.isArray(produkte)) {
    return { plattform: "shopify", stufe: "keine", kandidaten: [], weitere_seite: null };
  }
  const ursprung = (() => { try { return new URL(basis).origin; } catch { return basis; } })();

  const kandidaten: KandidatRoh[] = produkte.map((p) => {
    const prod = p as Record<string, unknown>;
    const varianten = Array.isArray(prod.variants) ? (prod.variants as Record<string, unknown>[]) : [];
    const bilderRoh = Array.isArray(prod.images) ? (prod.images as Record<string, unknown>[]) : [];
    // Shopify gibt den Preis als Dezimal-String ("19.90") in der Shop-Währung.
    const ersterPreis = varianten.length ? preisZuCent(varianten[0].price) : null;
    const handle = typeof prod.handle === "string" ? prod.handle : String(prod.id ?? "");
    return {
      quell_id: `shopify:${prod.id ?? handle}`,
      quell_url: handle ? `${ursprung}/products/${handle}` : null,
      titel: typeof prod.title === "string" ? prod.title : "",
      beschreibung_html: typeof prod.body_html === "string" ? prod.body_html : null,
      beschreibung_text: htmlZuText(typeof prod.body_html === "string" ? prod.body_html : null),
      preis_cent: ersterPreis,
      // Die Shop-Währung steht nicht in products.json — also NICHT raten.
      waehrung: null,
      bilder: bilderRoh
        .map((b) => (typeof b.src === "string" ? b.src : null))
        .filter((u): u is string => !!u && istWerkBild(u)),
      varianten: varianten.map((v) => ({
        titel: typeof v.title === "string" ? v.title : "",
        preis_cent: preisZuCent(v.price),
        verfuegbar: typeof v.available === "boolean" ? v.available : null,
      })),
      kategorien: [
        ...(typeof prod.product_type === "string" && prod.product_type ? [prod.product_type] : []),
        ...(typeof prod.tags === "string" ? prod.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : Array.isArray(prod.tags) ? (prod.tags as string[]) : []),
      ],
      verfuegbar: varianten.some((v) => v.available === true) ? true : varianten.length ? false : null,
    };
  }).filter((k) => k.titel);

  // Volle Seite heißt: es kann noch mehr geben.
  const weitere = produkte.length >= 250 ? produktEndpunkt("shopify", basis, seite + 1) : null;
  return { plattform: "shopify", stufe: "adapter", kandidaten, weitere_seite: weitere };
}

/* --------------------------------------------------------- WooCommerce */

export function wooLesen(json: unknown, basis: string, seite: number): AdapterErgebnis {
  if (!Array.isArray(json)) {
    return { plattform: "woocommerce", stufe: "keine", kandidaten: [], weitere_seite: null };
  }
  const kandidaten: KandidatRoh[] = (json as Record<string, unknown>[]).map((p) => {
    const preise = (p.prices ?? {}) as Record<string, unknown>;
    // Die Store-API liefert Minor-Units plus einen Dezimalstellen-Hinweis.
    const dezimal = typeof preise.currency_minor_unit === "number" ? preise.currency_minor_unit : 2;
    const rohPreis = typeof preise.price === "string" || typeof preise.price === "number" ? preise.price : null;
    let cent: number | null = null;
    if (rohPreis !== null) {
      const alsZahl = Number(rohPreis);
      cent = Number.isFinite(alsZahl) ? Math.round(alsZahl * Math.pow(10, 2 - dezimal)) : null;
    }
    const bilder = Array.isArray(p.images) ? (p.images as Record<string, unknown>[]) : [];
    return {
      quell_id: `woo:${p.id ?? p.slug ?? ""}`,
      quell_url: typeof p.permalink === "string" ? p.permalink : null,
      titel: typeof p.name === "string" ? p.name : "",
      beschreibung_html: typeof p.description === "string" ? p.description : null,
      beschreibung_text: htmlZuText(
        typeof p.description === "string" ? p.description
          : typeof p.short_description === "string" ? p.short_description : null,
      ),
      preis_cent: cent,
      waehrung: typeof preise.currency_code === "string" ? waehrungsCode(preise.currency_code) : null,
      bilder: bilder
        .map((b) => (typeof b.src === "string" ? b.src : null))
        .filter((u): u is string => !!u && istWerkBild(u)),
      varianten: [],
      kategorien: Array.isArray(p.categories)
        ? (p.categories as Record<string, unknown>[])
            .map((c) => (typeof c.name === "string" ? c.name : null))
            .filter((n): n is string => !!n)
        : [],
      verfuegbar: typeof p.is_in_stock === "boolean" ? p.is_in_stock : null,
    };
  }).filter((k) => k.titel);

  const weitere = kandidaten.length >= 100 ? produktEndpunkt("woocommerce", basis, seite + 1) : null;
  return { plattform: "woocommerce", stufe: "adapter", kandidaten, weitere_seite: weitere };
}

function waehrungsCode(code: string): string | null {
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/* --------------------------------------------------------- Squarespace */

export function squarespaceLesen(json: unknown, basis: string): AdapterErgebnis {
  const items = (json as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) {
    return { plattform: "squarespace", stufe: "keine", kandidaten: [], weitere_seite: null };
  }
  const kandidaten: KandidatRoh[] = items.map((i) => {
    const it = i as Record<string, unknown>;
    const struktur = (it.structuredContent ?? {}) as Record<string, unknown>;
    const varianten = Array.isArray(struktur.variants) ? (struktur.variants as Record<string, unknown>[]) : [];
    const ersterPreis = varianten.length
      ? preisZuCent((varianten[0].price as Record<string, unknown> | undefined)?.value ?? varianten[0].price, true)
      : null;
    const bild = typeof it.assetUrl === "string" ? it.assetUrl : null;
    const weitereBilder = Array.isArray(it.items)
      ? (it.items as Record<string, unknown>[]).map((x) => (typeof x.assetUrl === "string" ? x.assetUrl : null))
      : [];
    return {
      quell_id: `sqsp:${it.id ?? it.urlId ?? ""}`,
      quell_url: typeof it.fullUrl === "string" ? absolut(it.fullUrl, basis) : null,
      titel: typeof it.title === "string" ? it.title : "",
      beschreibung_html: typeof it.body === "string" ? it.body : null,
      beschreibung_text: htmlZuText(typeof it.body === "string" ? it.body : (it.excerpt as string | undefined) ?? null),
      preis_cent: ersterPreis,
      waehrung: null,
      bilder: [bild, ...weitereBilder].filter((u): u is string => !!u && istWerkBild(u)),
      varianten: varianten.map((v) => ({
        titel: typeof v.optionValues === "string" ? v.optionValues : "",
        preis_cent: preisZuCent((v.price as Record<string, unknown> | undefined)?.value ?? v.price, true),
        verfuegbar: typeof v.unlimited === "boolean" ? true : typeof v.qtyInStock === "number" ? v.qtyInStock > 0 : null,
      })),
      kategorien: Array.isArray(it.categories) ? (it.categories as string[]) : [],
      verfuegbar: null,
    };
  }).filter((k) => k.titel);
  return { plattform: "squarespace", stufe: "adapter", kandidaten, weitere_seite: null };
}

/* ------------------------------------------------------------- JSON-LD */

/** Alle JSON-LD-Blöcke aus einem HTML herausholen. */
export function jsonLdBloecke(html: string): unknown[] {
  const bloecke: unknown[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let treffer: RegExpExecArray | null;
  while ((treffer = regex.exec(html)) !== null) {
    try { bloecke.push(JSON.parse(treffer[1].trim())); } catch { /* kaputtes JSON überspringen */ }
  }
  return bloecke;
}

/** Rekursiv alle Knoten mit @type Product einsammeln (auch in @graph und Listen). */
function sammleProdukte(knoten: unknown, treffer: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(knoten)) { for (const k of knoten) sammleProdukte(k, treffer); return treffer; }
  if (!knoten || typeof knoten !== "object") return treffer;
  const obj = knoten as Record<string, unknown>;
  const typ = obj["@type"];
  const istProdukt = typ === "Product" || (Array.isArray(typ) && typ.includes("Product"));
  if (istProdukt) treffer.push(obj);
  for (const wert of Object.values(obj)) {
    if (wert && typeof wert === "object") sammleProdukte(wert, treffer);
  }
  return treffer;
}

/**
 * Stufe 2 der Kaskade: das, was der Shop für Google bereitstellt. Preis, Währung,
 * Verfügbarkeit, SKU und Bilder stehen dort strukturiert — kein Raten nötig.
 */
export function jsonLdLesen(html: string, quellUrl: string): AdapterErgebnis {
  const produkte: Record<string, unknown>[] = [];
  for (const block of jsonLdBloecke(html)) sammleProdukte(block, produkte);

  const kandidaten: KandidatRoh[] = produkte.map((p, i) => {
    const angebotRoh = p.offers;
    const angebot = (Array.isArray(angebotRoh) ? angebotRoh[0] : angebotRoh) as Record<string, unknown> | undefined;
    const bilderRoh = p.image;
    const bilder = (Array.isArray(bilderRoh) ? bilderRoh : bilderRoh ? [bilderRoh] : [])
      .map((b) => (typeof b === "string" ? b : (b as Record<string, unknown>)?.url))
      .filter((u): u is string => typeof u === "string")
      .map((u) => absolut(u, quellUrl))
      .filter((u): u is string => !!u && istWerkBild(u));

    const verfuegbarkeit = typeof angebot?.availability === "string" ? angebot.availability.toLowerCase() : null;
    const sku = typeof p.sku === "string" ? p.sku : null;

    return {
      quell_id: `jsonld:${sku ?? quellUrl}#${i}`,
      quell_url: quellUrl,
      titel: typeof p.name === "string" ? p.name : "",
      beschreibung_html: null,
      beschreibung_text: typeof p.description === "string" ? htmlZuText(p.description) : null,
      preis_cent: preisZuCent(angebot?.price ?? (angebot?.priceSpecification as Record<string, unknown> | undefined)?.price),
      waehrung: typeof angebot?.priceCurrency === "string" && /^[A-Z]{3}$/.test(angebot.priceCurrency)
        ? angebot.priceCurrency : null,
      bilder,
      varianten: [],
      kategorien: typeof p.category === "string" ? [p.category] : [],
      verfuegbar: verfuegbarkeit
        ? verfuegbarkeit.includes("instock") ? true : verfuegbarkeit.includes("outofstock") ? false : null
        : null,
    };
  }).filter((k) => k.titel);

  return {
    plattform: "unbekannt",
    stufe: kandidaten.length ? "jsonld" : "keine",
    kandidaten,
    weitere_seite: null,
  };
}

/* --------------------------------------------------------- Seitenfindung */

/** Adressen aus einer sitemap.xml (auch Sitemap-Indizes). */
export function sitemapAdressen(xml: string): { seiten: string[]; weitereSitemaps: string[] } {
  const seiten: string[] = [];
  const weitereSitemaps: string[] = [];
  const istIndex = /<sitemapindex/i.test(xml);
  const regex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let t: RegExpExecArray | null;
  while ((t = regex.exec(xml)) !== null) {
    const url = t[1].trim();
    if (istIndex) weitereSitemaps.push(url); else seiten.push(url);
  }
  return { seiten, weitereSitemaps };
}

/** Bilder aus rohem HTML — srcset/data-src beachtet, Ausschlussliste angewandt. */
export function bilderAusHtml(html: string, basis: string, maximal = 12): string[] {
  const gefunden: string[] = [];
  const gesehen = new Set<string>();
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attr = (name: string) => {
      const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
      return m ? m[1] : null;
    };
    const kandidat =
      (attr("srcset") ? groessteAusSrcset(attr("srcset")!) : null) ??
      (attr("data-srcset") ? groessteAusSrcset(attr("data-srcset")!) : null) ??
      attr("data-src") ??
      attr("src");
    if (!kandidat || !istWerkBild(kandidat)) continue;
    const voll = absolut(kandidat, basis);
    if (!voll || gesehen.has(voll)) continue;
    gesehen.add(voll);
    gefunden.push(voll);
    if (gefunden.length >= maximal) break;
  }
  return gefunden;
}

/* ------------------------------------------------------------- Dubletten */

/**
 * Gleicher Schlüssel = gleiches Werk. Beim zweiten Lauf derselben Quelle darf
 * nichts doppelt entstehen — deshalb hängt alles an quell_id, nicht am Titel.
 */
/** Der Dubletten-Schlüssel eines Kandidaten. Eine Stelle, damit Entdopplung,
 * Datenbank-Zeile und Deutung denselben Schlüssel meinen. */
export function schluesselVon(k: KandidatRoh): string {
  return k.quell_id || k.quell_url || k.titel;
}

export function entdopple(kandidaten: KandidatRoh[]): KandidatRoh[] {
  const gesehen = new Set<string>();
  const raus: KandidatRoh[] = [];
  for (const k of kandidaten) {
    const schluessel = schluesselVon(k);
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    raus.push(k);
  }
  return raus;
}
