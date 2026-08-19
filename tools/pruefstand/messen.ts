/**
 * Teil P — die Messungen.
 *
 * Jede Funktion hier misst genau eine ZERA-Kontrolle und gibt Befunde zurück.
 * Ein Befund trägt immer `gemessen` UND `schwelle`. Es wird nichts bewertet,
 * nichts formuliert, nichts geraten — nur gemessen und aufgeschrieben.
 */
import type { Page } from "playwright";
import { PNG } from "pngjs";
import { SCHWELLEN, type Breite } from "./pruefstand.config";

export type Status = "bestanden" | "gefallen" | "nicht_pruefbar";

export interface Befund {
  kontrolle: string;
  gate: boolean;
  status: Status;
  seite: string;
  breite: number;
  auswahl?: string;
  gemessen: number | string | null;
  schwelle: number | string | null;
  notiz?: string;
}

/* ————————————————————————————————— Farbe ————————————————————————————————— */

export interface Rgb { r: number; g: number; b: number; a: number }

export function parseFarbe(s: string): Rgb | null {
  const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)/i);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1], g: +m[2], b: +m[3], a };
}

/** Vordergrund mit Alpha über einen Grund legen. */
export function ueber(vorn: Rgb, hinten: Rgb): Rgb {
  const a = vorn.a;
  return {
    r: vorn.r * a + hinten.r * (1 - a),
    g: vorn.g * a + hinten.g * (1 - a),
    b: vorn.b * a + hinten.b * (1 - a),
    a: 1,
  };
}

function kanal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function leuchtdichte({ r, g, b }: Rgb): number {
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

export function kontrast(a: Rgb, b: Rgb): number {
  const la = leuchtdichte(a);
  const lb = leuchtdichte(b);
  const [hell, dunkel] = la >= lb ? [la, lb] : [lb, la];
  return (hell + 0.05) / (dunkel + 0.05);
}

const rund = (n: number, stellen = 2) => Math.round(n * 10 ** stellen) / 10 ** stellen;
const alsRgb = (c: Rgb) => `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;

/* ——————————————————————— 3.3 Kontrast (Launch Gate) ——————————————————————— */

interface TextKandidat {
  marke: string;
  auswahl: string;
  text: string;
  farbe: string;
  groesse: number;
  gewicht: number;
  /** Der erste undurchsichtige Hintergrund oberhalb, als CSS-Farbe. */
  grund: string;
  /** Alle halbdurchsichtigen Gründe darüber, von innen nach außen. */
  schichten: string[];
  /** Muss am Bildpunkt gemessen werden (Bild, Verlauf oder kein sicherer CSS-Grund)? */
  ueberBild: boolean;
  bildQuelle: string;
  /** Nicht leer, wenn ein fremdes Element über der Textmitte liegt. */
  verdecktVon: string;
  rect: { x: number; y: number; b: number; h: number };
  /** Rollstand beim Einsammeln — die Aufnahme braucht Seiten-, nicht Fensterkoordinaten. */
  rollY: number;
}

const SAMMLE_TEXT = `(() => {
  const wegSelektor = (el) => {
    if (el.id) return el.tagName.toLowerCase() + '#' + el.id;
    const klassen = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
    const eltern = el.parentElement;
    const stelle = eltern ? [...eltern.children].indexOf(el) + 1 : 0;
    return (eltern && eltern !== document.body ? eltern.tagName.toLowerCase() + ' > ' : '')
      + el.tagName.toLowerCase() + klassen + ':nth-child(' + stelle + ')';
  };

  const sichtbar = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  };

  const eigenerText = (el) => [...el.childNodes]
    .filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();

  const treffer = [];
  let lfd = 0;
  for (const el of document.querySelectorAll('body *')) {
    // Schon in einem früheren Rollschritt eingesammelt — nicht zweimal messen.
    if (el.hasAttribute('data-pruefstand')) continue;
    const text = eigenerText(el);
    if (text.length < ${SCHWELLEN.kontrast_min_zeichen}) continue;
    if (!sichtbar(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();

    // Hintergrund-Kette nach oben laufen, bis etwas Undurchsichtiges kommt.
    let grund = 'rgb(255,255,255)';
    const schichten = [];
    let ueberBild = false;
    let bildQuelle = '';
    let grundGefunden = false;
    for (let k = el; k; k = k.parentElement) {
      const kcs = getComputedStyle(k);
      if (kcs.backgroundImage && kcs.backgroundImage !== 'none') {
        ueberBild = true; bildQuelle = kcs.backgroundImage.slice(0, 60);
        break;
      }
      const bg = kcs.backgroundColor;
      const m = bg.match(/rgba?\\(\\s*([\\d.]+)[\\s,]+([\\d.]+)[\\s,]+([\\d.]+)(?:[\\s,\\/]+([\\d.]+))?/);
      if (!m) continue;
      const a = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (a === 0) continue;
      if (a < 1) { schichten.push(bg); continue; }
      grund = bg;
      grundGefunden = true;
      break;
    }
    // Liegt ein gemaltes Medium über dem Textfeld-Bereich? Dann sagt die CSS-Kette
    // nicht die Wahrheit — ein Bild kann zwischen dem gefundenen Grund und dem Text
    // liegen. In dem Fall wird am Bildpunkt gemessen. Das ist auch dann richtig,
    // wenn eine undurchsichtige Platte davor liegt: die Aufnahme zeigt die Platte.
    if (!ueberBild) {
      for (const med of document.querySelectorAll('img, video, canvas, svg')) {
        if (med.contains(el) || el.contains(med)) continue;
        const mr = med.getBoundingClientRect();
        if (mr.width < 4 || mr.height < 4) continue;
        const schnitt = Math.max(0, Math.min(r.right, mr.right) - Math.max(r.left, mr.left))
                      * Math.max(0, Math.min(r.bottom, mr.bottom) - Math.max(r.top, mr.top));
        if (schnitt > r.width * r.height * 0.5) {
          ueberBild = true;
          bildQuelle = (med.getAttribute('src') || med.tagName).slice(0, 60);
          break;
        }
      }
    }

    // Ohne undurchsichtigen Grund in der Kette weiß CSS die Wahrheit erst recht nicht.
    if (!grundGefunden) ueberBild = true;

    // Liegt etwas Fremdes über der Mitte des Textes (Einwilligungsfenster, Overlay),
    // ist der Text gar nicht sichtbar — dann gibt es keinen Kontrast zu messen.
    let verdecktVon = '';
    const mx = Math.round(r.left + r.width / 2);
    const my = Math.round(r.top + r.height / 2);
    if (mx >= 0 && my >= 0 && mx < window.innerWidth && my < window.innerHeight) {
      const oben = document.elementFromPoint(mx, my);
      if (oben && oben !== el && !el.contains(oben) && !oben.contains(el)) {
        verdecktVon = wegSelektor(oben);
      }
    }

    // Eine eindeutige Marke — ein rekonstruierter Selektor trifft sonst das falsche
    // Element, und dann misst man den Bildpunkt einer anderen Stelle.
    const marke = 'p' + (++lfd);
    el.setAttribute('data-pruefstand', marke);

    treffer.push({
      marke, auswahl: wegSelektor(el), text: text.slice(0, 40), farbe: cs.color,
      groesse: parseFloat(cs.fontSize), gewicht: parseInt(cs.fontWeight, 10) || 400,
      grund, schichten, ueberBild, bildQuelle, verdecktVon,
      rect: { x: r.x, y: r.y, b: r.width, h: r.height },
      rollY: window.scrollY,
    });
  }
  return treffer;
})()`;

/**
 * Zwei Aufnahmen desselben Ausschnitts: einmal normal, einmal mit unsichtbaren
 * Glyphen. Aus der zweiten kommt der Grund (hellster und dunkelster Bildpunkt);
 * der Vergleich beider sagt, ob der Text an dieser Stelle überhaupt eigene
 * Bildpunkte erzeugt. Erzeugt er keine, ist er verdeckt oder unsichtbar — dann
 * gibt es keinen Kontrast zu messen, und der Befund sagt das, statt eine Zahl
 * zu erfinden.
 */
async function bildpunkteHinterText(page: Page, kandidat: TextKandidat) {
  const clip = {
    x: Math.max(0, Math.floor(kandidat.rect.x)),
    // Seitenkoordinate: das Rechteck kam aus dem Fenster, die Aufnahme misst die Seite.
    y: Math.max(0, Math.floor(kandidat.rect.y + kandidat.rollY)),
    width: Math.max(1, Math.floor(kandidat.rect.b)),
    height: Math.max(1, Math.floor(kandidat.rect.h)),
  };
  const treffer = await page.$(`[data-pruefstand="${kandidat.marke}"]`).catch(() => null);
  if (!treffer) return null;

  let mitText: PNG | null = null;
  let ohneText: PNG | null = null;
  try {
    mitText = PNG.sync.read(await page.screenshot({ clip }));
    // Nur die Glyphen unsichtbar machen. `visibility: hidden` würde dem Element auch
    // seinen eigenen Grund nehmen — dann fotografiert man, was HINTER dem Knopf liegt.
    await treffer.evaluate((el: HTMLElement) => {
      el.dataset.pruefstandFarbe = el.style.color;
      el.style.color = "transparent";
      el.style.textShadow = "none";
    });
    ohneText = PNG.sync.read(await page.screenshot({ clip }));
  } catch {
    mitText = null;
  } finally {
    await treffer.evaluate((el: HTMLElement) => {
      el.style.color = el.dataset.pruefstandFarbe ?? "";
      el.style.textShadow = "";
      delete el.dataset.pruefstandFarbe;
    }).catch(() => {});
  }
  if (!mitText || !ohneText || mitText.data.length !== ohneText.data.length) return null;

  // Nur dort messen, wo die Glyphen tatsächlich liegen — „der Bereich hinter der
  // Schrift", nicht das ganze Kästchen. Sonst entscheidet ein einzelner Randpunkt
  // (Kante, Kantenglättung) über den Befund.
  let abweichendeBildpunkte = 0;
  let hell: Rgb | null = null;
  let dunkel: Rgb | null = null;
  let lHell = -1;
  let lDunkel = 2;
  for (let i = 0; i < ohneText.data.length; i += 4) {
    const istGlyphe = Math.abs(mitText.data[i] - ohneText.data[i]) > 8
      || Math.abs(mitText.data[i + 1] - ohneText.data[i + 1]) > 8
      || Math.abs(mitText.data[i + 2] - ohneText.data[i + 2]) > 8;
    if (!istGlyphe) continue;
    abweichendeBildpunkte++;
    const p: Rgb = { r: ohneText.data[i], g: ohneText.data[i + 1], b: ohneText.data[i + 2], a: 1 };
    const l = leuchtdichte(p);
    if (l > lHell) { lHell = l; hell = p; }
    if (l < lDunkel) { lDunkel = l; dunkel = p; }
  }
  if (abweichendeBildpunkte === 0) return { hell: null, dunkel: null, glyphenBildpunkte: 0 };
  if (!hell || !dunkel) return null;
  return { hell, dunkel, glyphenBildpunkte: abweichendeBildpunkte };
}

export async function messeKontrast(page: Page, seite: string, breite: number): Promise<Befund[]> {
  // Vor dem Messen alles anhalten: zwischen den zwei Aufnahmen darf sich nichts
  // bewegen, sonst hält der Vergleich Bewegung für Schrift. Gemessen wird der
  // ruhende Zustand — Bewegung selbst prüft 3.9, nicht diese Kontrolle.
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  }).catch(() => {});
  await page.waitForTimeout(200);

  /*
   * Erst wenn jedes Bild fertig entschlüsselt ist, wird gemessen.
   *
   * Der Grund ist ein konkreter Fehlbefund: Lauf 57 meldete die Wortmarke „WN"
   * über dem Hero mit 1,92:1 gegen einen hellsten Bildpunkt rgb(187,187,187) —
   * Lauf 61, gleicher Code, meldete nichts. Der hellste Bildpunkt hing vom
   * Ladezustand des Bildes ab, nicht von der Seite. Ein Messgerät, dessen
   * Ergebnis davon abhängt, WANN es hinsieht, misst nicht die Seite, sondern
   * den Zufall. `decode()` wartet, bis die Bildpunkte wirklich da sind; ein
   * Bild, das nicht lädt, hält die Messung nicht auf (dann gilt, was zu sehen
   * ist — genau wie beim Menschen).
   */
  await page.evaluate(() => Promise.all(
    Array.from(document.images).map((img) => img.decode().catch(() => {})),
  )).catch(() => {});

  // Die ganze Seite, nicht nur das erste Bild. Eingesammelt wird fensterweise, weil
  // die Verdeckungsprüfung (`elementFromPoint`) nur im sichtbaren Fenster arbeitet.
  const kandidaten: TextKandidat[] = [];
  const hoehe = await page.evaluate(() => window.innerHeight);
  const gesamt = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < gesamt; y += hoehe) {
    await page.evaluate((z) => window.scrollTo(0, z), y);
    await page.waitForTimeout(120);
    kandidaten.push(...(await page.evaluate(SAMMLE_TEXT)) as TextKandidat[]);
  }
  // Zurück nach oben und warten: eine mitlaufende Kopfzeile wechselt beim Rollen ihr
  // Aussehen. Fotografiert wird der Zustand, in dem die Seite ankommt.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const befunde: Befund[] = [];

  for (const k of kandidaten) {
    const vorn = parseFarbe(k.farbe);
    if (!vorn) continue;
    const gross = k.groesse >= SCHWELLEN.gross_ab_px
      || (k.gewicht >= SCHWELLEN.fett_ab_gewicht && k.groesse >= SCHWELLEN.gross_ab_px_fett);
    const schwelle = gross ? SCHWELLEN.kontrast_gross : SCHWELLEN.kontrast_klein;

    let grundFarbe: Rgb | null = null;
    let notiz = "";

    if (k.ueberBild) {
      const punkte = await bildpunkteHinterText(page, k);
      if (!punkte) {
        befunde.push({
          kontrolle: "3.3", gate: true, status: "nicht_pruefbar", seite, breite,
          auswahl: k.auswahl, gemessen: null, schwelle,
          notiz: `Text über Bild (${k.bildQuelle}), Bildpunkt-Messung fehlgeschlagen — Ausschnitt nicht aufnehmbar`,
        });
        continue;
      }
      if (punkte.glyphenBildpunkte === 0 || !punkte.hell || !punkte.dunkel) {
        befunde.push({
          kontrolle: "3.3", gate: true, status: "nicht_pruefbar", seite, breite,
          auswahl: k.auswahl, gemessen: 0, schwelle: "> 0 eigene Bildpunkte",
          notiz: `„${k.text}" erzeugt an dieser Stelle keine eigenen Bildpunkte — verdeckt `
            + `${k.verdecktVon ? `(oben liegt ${k.verdecktVon}) ` : ""}oder unsichtbar. `
            + "Verdeckter Text hat keinen messbaren Kontrast.",
        });
        continue;
      }
      grundFarbe = punkte.hell;
      const gegenDunkel = rund(kontrast(vorn.a < 1 ? ueber(vorn, punkte.dunkel) : vorn, punkte.dunkel));
      notiz = `Text über Bild, hellster Bildpunkt ${alsRgb(punkte.hell)}; `
        + `dunkelster ${alsRgb(punkte.dunkel)} ergäbe ${gegenDunkel}:1`;
    } else {
      let grund = parseFarbe(k.grund) ?? { r: 255, g: 255, b: 255, a: 1 };
      // Halbdurchsichtige Schichten von außen nach innen auflegen.
      for (const s of [...k.schichten].reverse()) {
        const sf = parseFarbe(s);
        if (sf) grund = ueber(sf, grund);
      }
      grundFarbe = grund;
      if (k.schichten.length > 0) notiz = `${k.schichten.length} halbdurchsichtige Schicht(en) eingerechnet`;
    }

    const text = vorn.a < 1 ? ueber(vorn, grundFarbe) : vorn;
    const wert = rund(kontrast(text, grundFarbe));
    befunde.push({
      kontrolle: "3.3", gate: true,
      status: wert >= schwelle ? "bestanden" : "gefallen",
      seite, breite, auswahl: k.auswahl,
      gemessen: wert, schwelle,
      notiz: [
        notiz,
        `„${k.text}", ${rund(k.groesse, 1)}px/${k.gewicht}, ${alsRgb(text)} auf ${alsRgb(grundFarbe)}`,
        `bei x=${Math.round(k.rect.x)} y=${Math.round(k.rect.y)} (${Math.round(k.rect.b)}×${Math.round(k.rect.h)})`,
      ].filter(Boolean).join(" · "),
    });
  }
  return befunde;
}

/* ————————— 3.8 Überlauf, Überlappung, Anschnitt (Launch Gate) ————————— */

interface UeberlaufErgebnis {
  ueberlaufPx: number;
  schuldige: { auswahl: string; rechts: number }[];
  ueberlappungen: { a: string; b: string; anteil: number; flaeche: number }[];
  anschnitte: { auswahl: string; links: number; rechts: number }[];
  ausgeparkteAnzahl: number;
}

const MESSE_LAYOUT = `(() => {
  const wegSelektor = (el) => {
    if (el.id) return el.tagName.toLowerCase() + '#' + el.id;
    const klassen = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + klassen;
  };
  const de = document.documentElement;
  const feld = de.clientWidth;
  const ueberlaufPx = Math.max(0, de.scrollWidth - feld);

  /** Ausserhalb der Fläche geparkt (Sprunglink, geschlossenes Menü) — kein Anschnitt. */
  const ausgeparkt = (r) => r.right <= 0 || r.left >= feld;

  const schuldige = [];
  const anschnitte = [];
  let ausgeparkteAnzahl = 0;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (ausgeparkt(r)) { ausgeparkteAnzahl++; continue; }
    if (r.right > feld + 1) schuldige.push({ auswahl: wegSelektor(el), rechts: Math.round(r.right) });
    if (r.right > feld + 1 || r.left < -1) {
      /*
       * Erklärt ist ein Überstand, wenn ein Vorfahr seinen waagerechten
       * Überlauf REGELT — rollbar (auto/scroll) oder beschneidend
       * (hidden/clip). In beiden Fällen kann dort nichts sichtbar aus dem
       * Sichtfeld ragen: entweder erreicht man es durch Rollen, oder die
       * Schere des Vorfahren schneidet es ab, bevor der Fensterrand es
       * könnte. Der Vorfahr selbst bleibt gemessen — ragt SEIN Kasten
       * hinaus, fällt er.
       *
       * Gemessen (Lauf 76): die eingefahrenen Marken — Schubladen, die
       * .hx-marken seit Z4 beschneidet — fielen als Anschnitt, während das
       * gleich gebaute Griffregister durch sein overflow-y: auto
       * entschuldigt war. Zwei gleich unsichtbare Zustände, zwei Urteile —
       * das war ein Fehler des Messgeräts, nicht der Seite.
       *
       * (Dieser Block lebt in einem Template-Literal — deshalb hier keine
       * Backticks.)
       */
      let erklaert = false;
      for (let k = el.parentElement; k; k = k.parentElement) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(k).overflowX)) { erklaert = true; break; }
      }
      if (!erklaert) anschnitte.push({ auswahl: wegSelektor(el), links: Math.round(r.left), rechts: Math.round(r.right) });
    }
  }

  // Überschneidung: nur zwischen Texten, die an ihrer Stelle auch wirklich obenauf
  // liegen. Ein geschlossenes Menü neben der Fläche überlappt optisch nichts.
  const eigenerText = (el) => [...el.childNodes]
    .filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  const obenauf = (el, r) => {
    const x = Math.min(Math.max(r.left + r.width / 2, 1), feld - 1);
    const y = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
    if (r.bottom < 0 || r.top > window.innerHeight) return false;
    const o = document.elementFromPoint(x, y);
    return !!o && (o === el || el.contains(o) || o.contains(el));
  };
  const texte = [];
  for (const el of document.querySelectorAll('body *')) {
    if (eigenerText(el).length < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || ausgeparkt(r)) continue;
    if (!obenauf(el, r)) continue;
    texte.push({ el, r, auswahl: wegSelektor(el) });
  }
  const ueberlappungen = [];
  for (let i = 0; i < texte.length; i++) {
    for (let j = i + 1; j < texte.length; j++) {
      const a = texte[i];
      const b = texte[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w <= 0 || h <= 0) continue;
      const flaeche = w * h;
      const kleiner = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      ueberlappungen.push({ a: a.auswahl, b: b.auswahl, anteil: kleiner > 0 ? flaeche / kleiner : 0, flaeche: Math.round(flaeche) });
    }
  }
  ueberlappungen.sort((x, y) => y.anteil - x.anteil);
  return { ueberlaufPx, schuldige, ueberlappungen: ueberlappungen.slice(0, 20), anschnitte, ausgeparkteAnzahl };
})()`;

export async function messeLayout(page: Page, seite: string, breite: number): Promise<Befund[]> {
  const e = (await page.evaluate(MESSE_LAYOUT)) as UeberlaufErgebnis;
  const befunde: Befund[] = [];

  befunde.push({
    kontrolle: "3.8", gate: true,
    status: e.ueberlaufPx > SCHWELLEN.ueberlauf_px ? "gefallen" : "bestanden",
    seite, breite,
    auswahl: e.schuldige.slice(0, 3).map((s) => `${s.auswahl} (rechts ${s.rechts})`).join(" · ") || undefined,
    gemessen: e.ueberlaufPx, schwelle: SCHWELLEN.ueberlauf_px,
    notiz: `waagerechter Überlauf in px · ${e.schuldige.length} Element(e) ragen über den Rand`,
  });

  const echte = e.ueberlappungen.filter((u) => u.anteil >= SCHWELLEN.ueberlappung_min_anteil);
  befunde.push({
    kontrolle: "3.8", gate: true,
    status: echte.length > 0 ? "gefallen" : "bestanden",
    seite, breite,
    auswahl: echte.slice(0, 3).map((u) => `${u.a} ∩ ${u.b}`).join(" · ") || undefined,
    gemessen: echte.length > 0 ? rund(echte[0].anteil) : 0,
    schwelle: SCHWELLEN.ueberlappung_min_anteil,
    notiz: `größte Überschneidung zweier Textelemente als Anteil der kleineren Fläche · ${echte.length} Paar(e) über der Schwelle`,
  });

  befunde.push({
    kontrolle: "3.8", gate: true,
    status: e.anschnitte.length > 0 ? "gefallen" : "bestanden",
    seite, breite,
    auswahl: e.anschnitte.slice(0, 3).map((a) => `${a.auswahl} (${a.links}…${a.rechts})`).join(" · ") || undefined,
    gemessen: e.anschnitte.length, schwelle: 0,
    notiz: `Elemente, die ohne Rollbereich aus dem Sichtfeld ragen · ${e.ausgeparkteAnzahl} `
      + "vollständig neben der Fläche geparkte Element(e) (Sprunglink, geschlossenes Menü) blieben außer Betracht",
  });

  return befunde;
}

/* ————————————— 3.4 Sichtbarer Tastaturfokus (Launch Gate) ————————————— */

const FOKUSSIERBAR = "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])";

export async function messeFokus(page: Page, seite: string, breite: number): Promise<Befund[]> {
  const stellen = await page.evaluate((sel) => {
    const treffer: { marke: string; auswahl: string; x: number; y: number; b: number; h: number }[] = [];
    let lfd = 0;
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      // `inert` nimmt ein Element aus der Tabulatorfolge. Was die Tastatur nicht
      // erreicht, braucht auch keinen Ring — sonst zählt 3.4 Elemente mit, die
      // niemand fokussieren kann (z. B. verdeckte Seiten in einem Heft).
      if (el.closest("[inert]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.right <= 0 || r.left >= document.documentElement.clientWidth) continue;
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      // Verdeckt: liegt etwas anderes über der Mitte des Elements (typisch ein
      // Zustimmungs-Dialog), kann sein Ring auf dem Bild gar nicht erscheinen.
      // Ein solcher Befund wäre eine Aussage über die Überlagerung, nicht über
      // den Fokus. Dieselbe Regel wie in 3.10.
      const oben = document.elementFromPoint(
        Math.min(document.documentElement.clientWidth - 1, Math.max(0, r.x + r.width / 2)),
        Math.min(window.innerHeight - 1, Math.max(0, r.y + r.height / 2)),
      );
      if (oben && oben !== el && !el.contains(oben) && !oben.contains(el)) continue;
      const marke = "f" + ++lfd;
      el.setAttribute("data-pruefstand-fokus", marke);
      treffer.push({
        marke,
        auswahl: el.tagName.toLowerCase() + ((el as HTMLElement).innerText || "").trim().slice(0, 24),
        x: r.x, y: r.y, b: r.width, h: r.height,
      });
    }
    return treffer;
  }, FOKUSSIERBAR);

  // BLINDSTELLE: gemessen wird mit `el.focus()`. Chromium wertet das als
  // Mausfokus, also greift `:focus-visible` nicht — ein Element, dessen Ring nur
  // über `:focus-visible` kommt, fällt hier durch, obwohl die Tastatur ihn zeigt.
  // Ein vorheriger Tab-Druck ändert das nicht (geprüft). Wer 3.4 auswertet, muss
  // deshalb im Zweifel in den Stil sehen: `:focus` ist beweisbar, `:focus-visible`
  // nicht. Ein echter Tastaturlauf über die ganze Seite wäre die saubere Lösung.
  let ohneZeichen = 0;
  const stumm: string[] = [];
  for (const st of stellen) {
    const el = await page.$(`[data-pruefstand-fokus="${st.marke}"]`);
    if (!el) continue;
    // Rahmen großzügig fassen, damit ein Umriss außerhalb der Box mitgemessen wird.
    const clip = {
      x: Math.max(0, Math.floor(st.x) - 6), y: Math.max(0, Math.floor(st.y) - 6),
      width: Math.max(1, Math.floor(st.b) + 12), height: Math.max(1, Math.floor(st.h) + 12),
    };
    try {
      const vorher = PNG.sync.read(await page.screenshot({ clip }));
      await el.evaluate((n: HTMLElement) => n.focus());
      const nachher = PNG.sync.read(await page.screenshot({ clip }));
      let anders = 0;
      for (let i = 0; i < vorher.data.length; i += 4) {
        if (Math.abs(vorher.data[i] - nachher.data[i]) > 8
          || Math.abs(vorher.data[i + 1] - nachher.data[i + 1]) > 8
          || Math.abs(vorher.data[i + 2] - nachher.data[i + 2]) > 8) anders++;
      }
      if (anders === 0) { ohneZeichen++; if (stumm.length < SCHWELLEN.liste_laenge) stumm.push(st.auswahl); }
    } catch { /* einzelne Aufnahme misslungen — zählt nicht als Befund */ }
  }
  await page.evaluate(() => document.querySelectorAll("[data-pruefstand-fokus]")
    .forEach((n) => n.removeAttribute("data-pruefstand-fokus")));

  return [{
    kontrolle: "3.4", gate: true,
    status: ohneZeichen > 0 ? "gefallen" : "bestanden",
    seite, breite,
    auswahl: stumm.join(" · ") || undefined,
    gemessen: ohneZeichen, schwelle: 0,
    notiz: `${stellen.length} fokussierbare Elemente geprüft · ${ohneZeichen} ohne sichtbare Veränderung beim Fokus`,
  }];
}

/* ————————————————— 3.5 Trefferflächen (Launch Gate) ————————————————— */

export async function messeTrefferflaechen(
  page: Page, seite: string, breite: Breite,
): Promise<Befund[]> {
  if (!breite.trefferflaechen) {
    return [{
      kontrolle: "3.5", gate: true, status: "nicht_pruefbar", seite: seite, breite: breite.breite,
      gemessen: null, schwelle: SCHWELLEN.trefferflaeche,
      notiz: breite.eingabe === "maus"
        ? `${breite.name}: bedient die Maus, die 44-px-Regel gilt hier nicht.`
        : `${breite.name}: hier steht der Dreh-Hinweis, keine Bedienung. Gemessen wird quer.`,
    }];
  }
  const kleine = await page.evaluate(({ sel, min }) => {
    /*
     * WCAG 2.5.8 nimmt einen Fall ausdrücklich aus: „inline — das Ziel steht in
     * einem Satz". Ein Link mitten im Fließtext lässt sich nicht auf 44 px
     * aufpolstern, ohne die Zeile auseinanderzureißen; die Zeilenhöhe des Textes
     * um ihn herum begrenzt ihn. Wer es trotzdem tut, zerstört den Satz und
     * gewinnt nichts — der Finger trifft die Nachbarzeile.
     *
     * Genau messbar ist der Fall so: das Element fließt inline UND in seinem
     * Kasten steht Text, der nicht zu ihm gehört. Beides muss zutreffen. Eine
     * Rechtszeile aus lauter Links (kein fremder Text) fällt damit nicht unter
     * die Ausnahme und wird weiter gemessen.
     */
    const imSatz = (el: Element): boolean => {
      if (getComputedStyle(el).display !== "inline") return false;
      const kasten = el.parentElement;
      if (!kasten) return false;
      let fremd = 0;
      for (const kind of Array.from(kasten.childNodes)) {
        if (kind === el) continue;
        if (kind.nodeType === Node.TEXT_NODE) fremd += (kind.textContent ?? "").trim().length;
      }
      return fremd > 0;
    };

    const treffer: { auswahl: string; b: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right <= 0 || r.left >= document.documentElement.clientWidth) continue;
      if (imSatz(el)) continue;
      /*
       * Ein halbes Pixel Toleranz — dieselbe Regel wie bei X.blatt.breite.
       * Gemessen (Lauf 71): „Ins Verzeichnis" fiel mit „gemessen 44 · soll 44"
       * — der Kasten war 43,98 px, der Bericht rundet, der Vergleich nicht.
       * Ein Messgerät, das etwas anderes vergleicht, als es anzeigt, erzeugt
       * Befunde, die niemand nachvollziehen kann. Browser setzen Bruchpixel;
       * unter einem halben ist der Unterschied keiner, den ein Finger merkt.
       */
      if (Math.min(r.width, r.height) < min - 0.5) {
        /*
         * DIAGNOSE (temporär, wird zurückgenommen): Lauf 76/77 maßen auf der
         * Vercel-Vorschau bei 768/844 Reiter 29 px und Marken 7 px — Werte,
         * die zu keinem CSS-Zustand des Codes passen und sich lokal nicht
         * reproduzieren. Für jeden Treffer druckt die Sonde den Rechenweg:
         * display des Elements, flex-basis des ersten Kindes, die aufgelöste
         * Streifen-Variable und den Media-Query-Stand.
         */
        const kind = el.firstElementChild;
        const wurzel = document.querySelector(".hx-wurzel");
        const diag = " {" + cs.display
          + "; basis " + (kind ? getComputedStyle(kind).flexBasis : "kein Kind")
          + "; reiter-var " + (wurzel ? (getComputedStyle(wurzel).getPropertyValue("--reiter-breite") || "leer") : "keine Wurzel")
          + "; mq " + (matchMedia("(max-width: 819.98px), (max-height: 599.98px)").matches ? "ja" : "nein")
          + "; vw " + document.documentElement.clientWidth + "}";
        treffer.push({
          auswahl: el.tagName.toLowerCase() + " „" + ((el as HTMLElement).innerText || el.getAttribute("aria-label") || "").trim().slice(0, 24) + "“" + diag,
          b: Math.round(r.width), h: Math.round(r.height),
        });
      }
    }
    treffer.sort((a, b) => Math.min(a.b, a.h) - Math.min(b.b, b.h));
    return treffer;
  }, { sel: `${FOKUSSIERBAR}, [role='button'], [onclick]`, min: SCHWELLEN.trefferflaeche });

  const kleinste = kleine[0];
  return [{
    kontrolle: "3.5", gate: true,
    status: kleine.length > 0 ? "gefallen" : "bestanden",
    seite, breite: breite.breite,
    auswahl: kleine.slice(0, SCHWELLEN.liste_laenge).map((k) => `${k.auswahl} ${k.b}×${k.h}`).join(" · ") || undefined,
    gemessen: kleinste ? Math.min(kleinste.b, kleinste.h) : SCHWELLEN.trefferflaeche,
    schwelle: SCHWELLEN.trefferflaeche,
    notiz: `kleinste Kante aller Bedienelemente in px · ${kleine.length} unter der Schwelle`,
  }];
}

/* X.dreh und X.blatt sind mit dem Szenen-Umbau ausgebaut (19.08.2026):
   Dreh-Hinweis und Blattgeometrie waren Messgrößen der Papiersimulation.
   Siehe docs/heft-architektur-audit.md und README, Ausnahme A1 (erledigt). */

/* ——————————————— Verdeckung des primären Knopfes im ersten Bild ——————————————— */

export async function messeKnopfVerdeckung(page: Page, seite: string, breite: number): Promise<Befund[]> {
  const e = await page.evaluate(() => {
    // Primärer Knopf = das größte beschriftete Bedienelement im ersten Bildschirm,
    // außerhalb von Kopfzeile und Navigation — und außerhalb jeder aufgelegten
    // Schicht. Sonst gewinnt der Knopf des Einwilligungs-Dialogs, und die Kontrolle
    // beantwortet nicht mehr die Frage, ob DIE SEITE ihren Weg zeigt.
    const aufgelegt = (el: Element) => {
      if (el.closest('[role="dialog"], [aria-modal="true"], dialog')) return true;
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).position === "fixed") return true;
      }
      return false;
    };
    let bester: { el: Element; flaeche: number } | null = null;
    for (const el of Array.from(document.querySelectorAll("a[href], button"))) {
      if (el.closest("header, nav")) continue;
      if (aufgelegt(el)) continue;
      const t = ((el as HTMLElement).innerText || "").trim();
      if (t.length < 3) continue;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight || r.bottom < 0 || r.width < 40 || r.height < 20) continue;
      // Neben der Fläche geparkt (Sprunglink bei -9999px) ist kein sichtbarer Knopf.
      if (r.left > window.innerWidth || r.right < 0) continue;
      const flaeche = r.width * r.height;
      if (!bester || flaeche > bester.flaeche) bester = { el, flaeche };
    }
    if (!bester) return null;
    const r = bester.el.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const oben = document.elementFromPoint(x, y);
    const verdeckt = !!oben && oben !== bester.el && !bester.el.contains(oben) && !oben.contains(bester.el);
    const beschriftung = ((bester.el as HTMLElement).innerText || "").trim().slice(0, 30);
    // Wer oben liegt, wird benannt: Kennung des Elements plus die erste Zeile seines
    // Textes — damit im Bericht „Einwilligungs-Dialog" steht und nicht nur „div".
    const schicht = oben?.closest('[role="dialog"], [aria-modal="true"], dialog') ?? oben;
    const wer = oben
      ? oben.tagName.toLowerCase()
        + (typeof oben.className === "string" && oben.className
          ? "." + oben.className.trim().split(/\s+/).slice(0, 2).join(".") : "")
        + (schicht && (schicht as HTMLElement).innerText
          ? ` („${(schicht as HTMLElement).innerText.trim().split("\n")[0].slice(0, 40)}“)` : "")
      : "";
    return { beschriftung, verdeckt, wer, x, y };
  });

  if (!e) {
    return [{
      kontrolle: "3.10", gate: false, status: "nicht_pruefbar", seite, breite,
      gemessen: null, schwelle: "genau ein primärer Knopf",
      notiz: "Im ersten Bildschirm wurde kein beschriftetes Bedienelement außerhalb von Kopf/Navigation gefunden.",
    }];
  }
  return [{
    kontrolle: "3.10", gate: false,
    status: e.verdeckt ? "gefallen" : "bestanden",
    seite, breite, auswahl: `„${e.beschriftung}“`,
    gemessen: e.verdeckt ? 1 : 0, schwelle: 0,
    notiz: e.verdeckt
      ? `Der primäre Knopf ist an seinem Mittelpunkt (x=${e.x} y=${e.y}) von ${e.wer} überlagert.`
      : `Der primäre Knopf ist an seinem Mittelpunkt (x=${e.x} y=${e.y}) frei.`,
  }];
}

/* ——————————————— 5.1 / 5.2 / 5.4 Kopfdaten ——————————————— */

export async function messeKopfdaten(page: Page, seite: string, breite: number): Promise<Befund[]> {
  const k = await page.evaluate(() => {
    const inhalt = (sel: string, attr = "content") =>
      document.querySelector(sel)?.getAttribute(attr)?.trim() ?? "";
    const ebenen = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
      .map((h) => Number(h.tagName.slice(1)));
    let spruenge = 0;
    for (let i = 1; i < ebenen.length; i++) if (ebenen[i] - ebenen[i - 1] > 1) spruenge++;
    return {
      titel: document.title.trim(),
      beschreibung: inhalt('meta[name="description"]'),
      kanonisch: inhalt('link[rel="canonical"]', "href"),
      h1: document.querySelectorAll("h1").length,
      spruenge,
      ogBild: inhalt('meta[property="og:image"]'),
      ogTitel: inhalt('meta[property="og:title"]'),
    };
  });
  const j = (b: boolean): Status => (b ? "bestanden" : "gefallen");
  return [
    { kontrolle: "5.1", gate: true, status: j(k.titel.length > 0 && k.beschreibung.length > 0), seite, breite,
      gemessen: `Titel ${k.titel.length} Zeichen, Beschreibung ${k.beschreibung.length} Zeichen`,
      schwelle: "beide > 0", notiz: `„${k.titel}“` },
    { kontrolle: "5.2", gate: false, status: j(k.h1 === 1 && k.spruenge === 0), seite, breite,
      gemessen: `${k.h1} × h1, ${k.spruenge} Sprung/Sprünge in der Ebenenfolge`, schwelle: "1 × h1, 0 Sprünge" },
    { kontrolle: "5.3", gate: true, status: j(k.kanonisch.length > 0), seite, breite,
      gemessen: k.kanonisch || "keins", schwelle: "canonical gesetzt" },
    { kontrolle: "5.4", gate: false, status: j(k.ogBild.length > 0 && k.ogTitel.length > 0), seite, breite,
      gemessen: `og:image ${k.ogBild ? "gesetzt" : "fehlt"}, og:title ${k.ogTitel ? "gesetzt" : "fehlt"}`,
      schwelle: "beide gesetzt", notiz: k.ogBild.slice(0, 90) },
  ];
}
