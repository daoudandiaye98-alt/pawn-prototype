/**
 * Die lange Rochade — Schritt 4: die Bildstrecke.
 *
 * Aus einer fremden Website kommen Bilder in allen Zuständen: mit weißen
 * Rändern eingebettet, um 90 Grad gedreht abgelegt, dreimal dieselbe Datei
 * unter drei Adressen, dazwischen Logos und Icons. Hier wird daraus etwas,
 * das an einer Werkseite bestehen kann.
 *
 * Die Kette je Bild:
 *   1. größte Variante wählen (srcset/data-src — im Adapter)
 *   2. laden (nur über rochadeSicherheit.sicherAbrufen)
 *   3. Inhalts-Hash bilden → dieselbe Datei nie zweimal
 *   4. Zierbilder aussortieren (Logo, Icon, Sprite, Platzhalter, Winzlinge)
 *   5. Drehung aus EXIF lesen und wirklich drehen
 *   6. gleichmäßige Ränder abschneiden
 *   7. zwei Größen als WebP schreiben — dabei fällt EXIF von selbst weg
 *
 * Was hier NICHT passiert: nichts wird erfunden. Ein Bild, das sich nicht lesen
 * lässt, wird nicht ersetzt, nicht generiert und nicht geschönt — es bekommt
 * einen Grund und der Rest läuft weiter.
 *
 * Ehrliche Grenze: der Decoder (ImageScript) liest JPEG und PNG. WebP und AVIF
 * kann er lesen NICHT — solche Dateien werden unverändert übernommen (gehasht,
 * gespeichert, in der Reihenfolge belassen), nur eben ohne Zuschnitt und ohne
 * zweite Größe. Das steht dann als Hinweis an der Zeile, statt still zu passieren.
 */

// ImageScript läuft in Deno wie in Node — dieselbe Datei ist deshalb im
// Trockenlauf prüfbar, ohne Deploy.
import { Image } from "npm:imagescript@1.3.0";

/* ------------------------------------------------------------------ Maße */

export const BILD = {
  /** Längste Kante der großen Fassung. Darüber wird verkleinert. */
  gross_kante: 2000,
  /** Längste Kante der kleinen Fassung (Listen, Lichttisch). */
  klein_kante: 600,
  webp_qualitaet: 82,
  /** Kleiner als das ist kein Werkbild, sondern Zierat. */
  min_kante: 200,
  /** Wie weit zwei Randfarben auseinanderliegen dürfen und noch „gleich" heißen. */
  rand_toleranz: 10,
  /** Mehr als das schneiden wir nie weg — sonst wäre es kein Rand mehr. */
  rand_max_anteil: 0.35,
} as const;

export type BildFormat = "jpeg" | "png" | "webp" | "gif" | "avif" | "svg" | "unbekannt";

/* ------------------------------------------------------- Format am Anfang */

/** Erkennt das Format an den ersten Bytes, nicht an der Dateiendung. */
export function formatErkennen(bytes: Uint8Array): BildFormat {
  if (bytes.length < 12) return "unbekannt";
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  const riff = String.fromCharCode(b[0], b[1], b[2], b[3]);
  const webp = String.fromCharCode(b[8], b[9], b[10], b[11]);
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  const marke = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (marke === "ftyp") {
    const art = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (art.startsWith("avif") || art.startsWith("avis")) return "avif";
  }
  const anfang = new TextDecoder().decode(b.slice(0, 200)).trimStart().toLowerCase();
  if (anfang.startsWith("<?xml") || anfang.startsWith("<svg")) return "svg";
  return "unbekannt";
}

export function endungFuer(format: BildFormat): string {
  switch (format) {
    case "jpeg": return "jpg";
    case "png": return "png";
    case "webp": return "webp";
    case "gif": return "gif";
    case "avif": return "avif";
    case "svg": return "svg";
    default: return "bin";
  }
}

export function typFuer(format: BildFormat): string {
  return format === "unbekannt" ? "application/octet-stream" : `image/${format === "jpeg" ? "jpeg" : format}`;
}

/* ------------------------------------------------------------ Dubletten */

/** Inhalts-Hash: dieselbe Datei unter drei Adressen bleibt ein Bild. */
export async function inhaltHash(bytes: Uint8Array): Promise<string> {
  const roh = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(roh)).map((n) => n.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------ EXIF-Drehung */

/**
 * Liest die Orientierung (1–8) aus dem EXIF-Block eines JPEG. Ohne Angabe: null.
 * Reine Byte-Arbeit, keine Bibliothek — und deshalb prüfbar.
 */
export function exifOrientierung(bytes: Uint8Array): number | null {
  if (formatErkennen(bytes) !== "jpeg") return null;
  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marke = bytes[i + 1];
    if (marke === 0xd8 || marke === 0x01 || (marke >= 0xd0 && marke <= 0xd7)) { i += 2; continue; }
    const laenge = (bytes[i + 2] << 8) | bytes[i + 3];
    if (laenge < 2) return null;
    if (marke === 0xe1) {
      const start = i + 4;
      const kopf = String.fromCharCode(...bytes.slice(start, start + 4));
      if (kopf === "Exif") return ausTiff(bytes, start + 6);
    }
    // Ab dem Bilddatenstrom steht kein EXIF mehr.
    if (marke === 0xda) return null;
    i += 2 + laenge;
  }
  return null;
}

function ausTiff(b: Uint8Array, tiff: number): number | null {
  if (tiff + 8 > b.length) return null;
  const klein = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
  const gross = b[tiff] === 0x4d && b[tiff + 1] === 0x4d;
  if (!klein && !gross) return null;
  const lies16 = (p: number) => (klein ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1]);
  const lies32 = (p: number) =>
    klein
      ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0
      : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;

  const ifd = tiff + lies32(tiff + 4);
  if (ifd + 2 > b.length) return null;
  const anzahl = lies16(ifd);
  for (let n = 0; n < anzahl; n++) {
    const eintrag = ifd + 2 + n * 12;
    if (eintrag + 12 > b.length) return null;
    if (lies16(eintrag) === 0x0112) {
      const wert = lies16(eintrag + 8);
      return wert >= 1 && wert <= 8 ? wert : null;
    }
  }
  return null;
}

/* -------------------------------------------------------------- Ränder */

export interface Zuschnitt { links: number; oben: number; rechts: number; unten: number }

/**
 * Sucht gleichmäßige Ränder in RGBA-Pixeln. Rand heißt: die ganze Zeile bzw.
 * Spalte liegt innerhalb der Toleranz bei derselben Farbe wie die Ecke.
 * Gibt zurück, wie viele Pixel je Seite weg dürfen — nie mehr als rand_max_anteil.
 */
export function raenderFinden(
  pixel: Uint8Array | Uint8ClampedArray,
  breite: number,
  hoehe: number,
  toleranz = BILD.rand_toleranz,
): Zuschnitt {
  const leer: Zuschnitt = { links: 0, oben: 0, rechts: 0, unten: 0 };
  if (breite < 4 || hoehe < 4 || pixel.length < breite * hoehe * 4) return leer;

  const farbe = (x: number, y: number) => {
    const p = (y * breite + x) * 4;
    return [pixel[p], pixel[p + 1], pixel[p + 2], pixel[p + 3]];
  };
  const grund = farbe(0, 0);
  const gleich = (c: number[]) =>
    Math.abs(c[0] - grund[0]) <= toleranz && Math.abs(c[1] - grund[1]) <= toleranz &&
    Math.abs(c[2] - grund[2]) <= toleranz && Math.abs(c[3] - grund[3]) <= toleranz;

  const zeileGleich = (y: number) => {
    for (let x = 0; x < breite; x++) if (!gleich(farbe(x, y))) return false;
    return true;
  };
  const spalteGleich = (x: number) => {
    for (let y = 0; y < hoehe; y++) if (!gleich(farbe(x, y))) return false;
    return true;
  };

  // Ein durchgehend einfarbiges Bild hat keinen Rand — es ist nur einfarbig.
  // Ohne diese Frage würde die Schleife brav 35 % von jeder Seite abschneiden.
  // (Vom Trockenlauf gefunden: eine einfarbige 4000×3000-Fläche kam als
  // 1200×900 heraus.)
  if (zeileGleich(Math.floor(hoehe / 2)) && spalteGleich(Math.floor(breite / 2))) return leer;

  const maxY = Math.floor(hoehe * BILD.rand_max_anteil);
  const maxX = Math.floor(breite * BILD.rand_max_anteil);
  let oben = 0, unten = 0, links = 0, rechts = 0;
  while (oben < maxY && zeileGleich(oben)) oben++;
  while (unten < maxY && zeileGleich(hoehe - 1 - unten)) unten++;
  while (links < maxX && spalteGleich(links)) links++;
  while (rechts < maxX && spalteGleich(breite - 1 - rechts)) rechts++;

  if (oben + unten >= hoehe || links + rechts >= breite) return leer;
  return { links, oben, rechts, unten };
}

/* --------------------------------------------------------- Zielgrößen */

export function zielMass(breite: number, hoehe: number, kante: number): { breite: number; hoehe: number } {
  const lang = Math.max(breite, hoehe);
  if (lang <= kante) return { breite, hoehe };
  const faktor = kante / lang;
  return { breite: Math.max(1, Math.round(breite * faktor)), hoehe: Math.max(1, Math.round(hoehe * faktor)) };
}

/* --------------------------------------------------------- Zierbild-Filter */

const ZIER_WORTE = /(logo|icon|favicon|sprite|badge|placeholder|platzhalter|spacer|pixel|avatar|banner|button|arrow|pfeil|social|instagram|facebook|paypal|klarna|visa|mastercard|payment|zahlung|siegel|trustbadge)/i;

/**
 * Zierat aussortieren — vor dem Laden nach der Adresse, nach dem Laden zusätzlich
 * nach den echten Maßen. Beides, weil Adressen lügen und Maße erst später da sind.
 */
export function istZierbild(url: string, breite?: number, hoehe?: number): boolean {
  const ohneAbfrage = url.split("?")[0];
  if (ZIER_WORTE.test(ohneAbfrage)) return true;
  if (/\.svg($|\?)/i.test(url)) return true;
  if (breite !== undefined && hoehe !== undefined) {
    if (breite < BILD.min_kante || hoehe < BILD.min_kante) return true;
    // Extreme Streifen sind Banner, keine Werke.
    const verhaeltnis = Math.max(breite, hoehe) / Math.max(1, Math.min(breite, hoehe));
    if (verhaeltnis > 6) return true;
  }
  return false;
}

/* ------------------------------------------------------------ Aufbereiten */

export interface AufbereitetesBild {
  format: BildFormat;
  /** Große Fassung (WebP), oder die Originalbytes, wenn nicht lesbar. */
  gross: Uint8Array;
  /** Kleine Fassung (WebP), oder null, wenn nicht lesbar. */
  klein: Uint8Array | null;
  breite: number | null;
  hoehe: number | null;
  /** true = unverändert durchgereicht, weil der Decoder das Format nicht liest. */
  unveraendert: boolean;
  gedreht: number | null;
  zuschnitt: Zuschnitt | null;
  hinweis: string | null;
  /** Zierbild: nach den echten Maßen aussortiert. */
  zierat: boolean;
}

/**
 * Nimmt die geladenen Bytes und macht daraus, was daraus zu machen ist.
 * Wirft nie — ein nicht lesbares Bild kommt mit hinweis zurück, damit die
 * aufrufende Stelle es ehrlich an die Zeile schreiben kann.
 */
export async function bildAufbereiten(bytes: Uint8Array, quellUrl = ""): Promise<AufbereitetesBild> {
  const format = formatErkennen(bytes);
  const roh: AufbereitetesBild = {
    format, gross: bytes, klein: null, breite: null, hoehe: null,
    unveraendert: true, gedreht: null, zuschnitt: null, hinweis: null, zierat: false,
  };

  if (format === "svg") {
    return { ...roh, zierat: true, hinweis: "Zeichnung im SVG-Format — als Werkbild nicht übernommen." };
  }
  if (format !== "jpeg" && format !== "png") {
    return {
      ...roh,
      hinweis: `Format ${format} — unverändert übernommen, ohne Zuschnitt und ohne zweite Größe.`,
    };
  }

  let bild: InstanceType<typeof Image>;
  try {
    bild = await Image.decode(bytes) as InstanceType<typeof Image>;
  } catch {
    return { ...roh, hinweis: "Dieses Bild ließ sich nicht öffnen. Der Rest des Imports läuft weiter." };
  }

  // 1) Drehen, was gedreht abgelegt wurde.
  const drehung = exifOrientierung(bytes);
  if (drehung && drehung > 1) {
    try {
      if (drehung === 3) bild.rotate(180);
      else if (drehung === 6) bild.rotate(90);
      else if (drehung === 8) bild.rotate(270);
      else if (drehung === 2) bild.flip("horizontal" as never);
      else if (drehung === 4) bild.flip("vertical" as never);
      // 5 und 7 sind Spiegelung plus Drehung — selten; wir drehen wenigstens richtig.
      else if (drehung === 5) bild.rotate(90);
      else if (drehung === 7) bild.rotate(270);
    } catch { /* Drehung ist Kür, nicht Pflicht. */ }
  }

  // 2) Gleichmäßige Ränder abschneiden.
  let zuschnitt: Zuschnitt | null = null;
  try {
    const rand = raenderFinden(bild.bitmap, bild.width, bild.height);
    if (rand.links || rand.oben || rand.rechts || rand.unten) {
      const neueBreite = bild.width - rand.links - rand.rechts;
      const neueHoehe = bild.height - rand.oben - rand.unten;
      if (neueBreite >= BILD.min_kante && neueHoehe >= BILD.min_kante) {
        bild.crop(rand.links, rand.oben, neueBreite, neueHoehe);
        zuschnitt = rand;
      }
    }
  } catch { /* Ohne Zuschnitt ist es immer noch ein gutes Bild. */ }

  const breite = bild.width;
  const hoehe = bild.height;
  if (istZierbild(quellUrl, breite, hoehe)) {
    return {
      ...roh, breite, hoehe, gedreht: drehung, zuschnitt, zierat: true,
      hinweis: "Zu klein oder zu schmal für ein Werkbild — aussortiert.",
    };
  }

  // 3) Zwei Größen als WebP. Das Neuschreiben entfernt EXIF vollständig:
  //    es wird nur die Pixelfläche geschrieben, keine Metadaten übernommen.
  try {
    const g = zielMass(breite, hoehe, BILD.gross_kante);
    const k = zielMass(breite, hoehe, BILD.klein_kante);
    const grossBild = (g.breite === breite && g.hoehe === hoehe) ? bild : bild.clone().resize(g.breite, g.hoehe);
    const gross = new Uint8Array(await grossBild.encodeWEBP(BILD.webp_qualitaet));
    // Ist das Bild ohnehin klein, wäre die zweite Fassung dieselbe Datei —
    // dann schreiben wir sie nicht noch einmal.
    const klein = (k.breite === g.breite && k.hoehe === g.hoehe)
      ? null
      : new Uint8Array(await bild.clone().resize(k.breite, k.hoehe).encodeWEBP(BILD.webp_qualitaet));
    return {
      format, gross, klein, breite: g.breite, hoehe: g.hoehe,
      unveraendert: false, gedreht: drehung, zuschnitt, hinweis: null, zierat: false,
    };
  } catch {
    return { ...roh, breite, hoehe, gedreht: drehung, zuschnitt,
      hinweis: "Dieses Bild ließ sich nicht neu schreiben — es wurde unverändert übernommen." };
  }
}

/* --------------------------------------------------------------- Ablage */

/**
 * Ort im Bucket designer-media. Gespeichert wird der PFAD, nie eine signierte
 * URL — signierte URLs laufen ab und hätten alle importierten Werkbilder nach
 * einem Jahr brechen lassen (derselbe Fund wie bei haus-rochade). Beim Anzeigen
 * wird frisch signiert: src/lib/media.ts bzw. _shared/media.ts.
 */
export function ablageOrt(userId: string, auftragId: string, hash: string, format: BildFormat, klein = false): string {
  const endung = format === "jpeg" || format === "png" ? "webp" : endungFuer(format);
  return `${userId}/rochade/${auftragId}/${hash.slice(0, 32)}${klein ? "-klein" : ""}.${endung}`;
}
