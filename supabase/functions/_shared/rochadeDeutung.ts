/**
 * Die lange Rochade — Schritt 5: die Deutung.
 *
 * Die Struktur ist zuerst da (Adapter, Schritt 3): Titel, Preis, Beschreibung,
 * Varianten stehen schon in rochade_kandidaten. Die KI ordnet nur noch ein, was
 * die Struktur nicht sagt: in welche Welt ein Werk gehört, welcher Angebotstyp
 * es ist, welche Welt-Felder sich aus dem vorhandenen Text ergeben — und sie
 * schreibt die Beschreibung im Duktus der Welt neu.
 *
 * Drei Regeln, hier in Code gegossen statt in den Prompt gehofft:
 *   1. Nichts erfinden. Was nicht in der Quelle steht, bleibt leer. Antworten
 *      mit erfundenen Maßen fallen hier durch, weil jedes Feld gegen den
 *      Quelltext geprüft wird, bevor es übernommen wird.
 *   2. Keine Gestaltung importieren. Farbwerte, Schriftnamen und CSS werden aus
 *      allen Rückgaben entfernt — importiert wird Identität, nie das Aussehen
 *      der fremden Seite.
 *   3. Nur bekannte Felder. Alles außerhalb der Whitelist je Welt fliegt raus.
 *
 * In Bündeln von 10–20: ein Aufruf je Bündel, nicht einer je Werk.
 */

import { schluesselVon, type KandidatRoh } from "./rochadeAdapter.ts";

export const BUENDEL_MIN = 10;
export const BUENDEL_MAX = 20;

export type Welt = "Mode" | "Interior" | "Kunst";
export const WELTEN: Welt[] = ["Mode", "Interior", "Kunst"];

/** Angebotstypen. Bei Kunst die vier aus PART 51, sonst der schlichte Verkauf. */
export const ANGEBOTSTYPEN: Record<Welt, string[]> = {
  Mode: ["verkauf", "auf_bestellung"],
  Interior: ["verkauf", "auf_bestellung", "massanfertigung", "materialmuster"],
  Kunst: ["original", "print", "auftragsarbeit", "live_portrait"],
};

/**
 * Welche Felder je Welt überhaupt existieren. Alles andere wird verworfen —
 * damit kann kein Modell sich neue Felder ausdenken.
 */
export const WELT_FELDER: Record<Welt, string[]> = {
  Mode: ["groesse", "passform", "material", "farbe", "pflege"],
  Interior: ["masse", "gewicht", "material", "oberflaeche", "farbe", "fertigung",
    "lieferzeit", "montage", "pflege", "belastbarkeit"],
  Kunst: ["technik", "medium", "jahr", "masse", "auflage", "signatur",
    "rahmung", "traeger", "zustand"],
};

export interface Deutung {
  schluessel: string;
  welt: Welt | null;
  angebotstyp: string | null;
  welt_felder: Record<string, string>;
  beschreibung: string | null;
  wort_dna: string[];
  /** Was verworfen wurde und warum — steht später ehrlich an der Karte. */
  verworfen: string[];
}

export interface DeutungsErgebnis {
  deutungen: Deutung[];
  ueber_text: string | null;
  fehler: string | null;
}

/* --------------------------------------------------------------- Bündeln */

/**
 * Teilt die Kandidaten in möglichst gleich große Bündel von höchstens 20.
 * Gleichmäßig statt „voll, voll, Rest": 25 Werke werden 13 + 12, nicht 20 + 5 —
 * sonst stünde am Ende ein Bündel von fünf, für das sich ein Aufruf nicht lohnt.
 * Weniger als 10 Werke insgesamt ergeben ein einziges Bündel.
 */
export function buendeln<T>(liste: T[], groesse = BUENDEL_MAX): T[][] {
  const g = Math.max(BUENDEL_MIN, Math.min(groesse, BUENDEL_MAX));
  if (liste.length === 0) return [];
  const anzahl = Math.ceil(liste.length / g);
  const buendel: T[][] = [];
  let ab = 0;
  for (let i = 0; i < anzahl; i++) {
    const rest = liste.length - ab;
    const uebrig = anzahl - i;
    const nimm = Math.ceil(rest / uebrig);
    buendel.push(liste.slice(ab, ab + nimm));
    ab += nimm;
  }
  return buendel;
}

/* ------------------------------------------------------- Gestaltungs-Filter */

const HEX = /#[0-9a-f]{3,8}\b/gi;
const RGB = /\b(?:rgba?|hsla?)\s*\([^)]*\)/gi;
const SCHRIFT = /\b(?:font-family|font-size|font-weight|letter-spacing|line-height)\s*:[^;\n]*/gi;
const CSS_REST = /\b(?:background(?:-color)?|color)\s*:\s*[^;\n]*/gi;

/**
 * Entfernt alles, was Aussehen statt Inhalt ist. Gesetz 3 der Rochade:
 * importiert wird die Identität, nie das CSS.
 */
export function ohneGestaltung(text: string): string {
  return text
    .replace(HEX, "")
    .replace(RGB, "")
    .replace(SCHRIFT, "")
    .replace(CSS_REST, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .trim();
}

/* ------------------------------------------------------------- Der Auftrag */

export interface DeutungsKontext {
  /** Wie das Haus über sich spricht — nur als Ton, nie als Inhalt. */
  haus_name?: string | null;
  /** Bereits bekannte Stil-Worte des Hauses (brand_dna.signals o. ä.). */
  bekannte_worte?: string[];
  /** Soll auch ein Über-Text vorgeschlagen werden? Nur beim ersten Bündel. */
  ueber_text_gewuenscht?: boolean;
}

export function systemPrompt(): string {
  const felder = WELTEN.map((w) => `  ${w}: ${WELT_FELDER[w].join(", ")}`).join("\n");
  const typen = WELTEN.map((w) => `  ${w}: ${ANGEBOTSTYPEN[w].join(", ")}`).join("\n");
  return [
    "Du ordnest importierte Werke einer Designerin in PAWN ein.",
    "",
    "Härteste Regel: Du erfindest nichts. Steht ein Maß, ein Jahr, ein Material",
    "nicht im mitgelieferten Text, dann lässt du das Feld weg. Ein leeres Feld ist",
    "richtig; ein geratenes Feld ist falsch und wird verworfen.",
    "",
    "Zweite Regel: Du überträgst keine Gestaltung. Keine Farbwerte, keine",
    "Schriftnamen, kein CSS — nur Inhalt.",
    "",
    "Welten und ihre Felder (nur diese, keine anderen):",
    felder,
    "",
    "Angebotstypen je Welt:",
    typen,
    "",
    "Duktus je Welt für die Beschreibung:",
    "  Mode: Material, Schnitt, Trageerlebnis. Kurze Sätze, kein Werbeton.",
    "  Interior: Maß, Material, Fertigung, wie es im Raum steht. Sachlich.",
    "  Kunst: Technik, Träger, Format, was das Werk zeigt. Nüchtern, nie deutend.",
    "",
    "Antworte ausschließlich mit JSON in genau dieser Form:",
    '{"werke":[{"schluessel":"…","welt":"Mode|Interior|Kunst",',
    '"angebotstyp":"…","welt_felder":{"feld":"wert"},',
    '"beschreibung":"…","wort_dna":["…"]}],"ueber_text":null}',
    "",
    "schluessel übernimmst du unverändert. Unsicher bei der Welt? Dann welt: null.",
  ].join("\n");
}

/** Baut die Nutzernachricht für ein Bündel. Enthält nur, was in der Quelle stand. */
export function nutzerPrompt(buendel: KandidatRoh[], kontext: DeutungsKontext = {}): string {
  const werke = buendel.map((k) => ({
    schluessel: schluesselVon(k),
    titel: k.titel,
    beschreibung: (k.beschreibung_text ?? "").slice(0, 1200),
    kategorien: k.kategorien ?? [],
    varianten: (k.varianten ?? []).map((v) => v.titel).filter(Boolean).slice(0, 12),
    preis_cent: k.preis_cent,
  }));
  const teile = [
    kontext.haus_name ? `Haus: ${kontext.haus_name}` : null,
    kontext.bekannte_worte?.length ? `Bereits bekannte Stil-Worte: ${kontext.bekannte_worte.join(", ")}` : null,
    kontext.ueber_text_gewuenscht
      ? "Schlage zusätzlich einen Über-Text von höchstens 60 Wörtern vor (Feld ueber_text), ausschließlich aus dem, was hier steht. Findest du zu wenig, gib null zurück."
      : null,
    `Werke (${werke.length}):`,
    JSON.stringify(werke, null, 1),
  ].filter(Boolean);
  return teile.join("\n\n");
}

/* ------------------------------------------------------------ Antwort lesen */

function jsonHeraus(text: string): unknown | null {
  const roh = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(roh); } catch { /* weiter unten noch ein Versuch */ }
  const anfang = roh.indexOf("{");
  const ende = roh.lastIndexOf("}");
  if (anfang < 0 || ende <= anfang) return null;
  try { return JSON.parse(roh.slice(anfang, ende + 1)); } catch { return null; }
}

/** Steht der Wert wenigstens in Teilen im Quelltext? Sonst ist er erfunden. */
function stehtInDerQuelle(wert: string, quelle: string): boolean {
  const w = wert.toLowerCase().trim();
  if (!w) return false;
  const q = quelle.toLowerCase();
  if (q.includes(w)) return true;
  // Zahlen sind der häufigste Erfindungsfall (Maße, Jahre, Gewichte): jede Zahl
  // im Wert muss in der Quelle vorkommen, sonst ist der Wert nicht belegt.
  const zahlen = w.match(/\d+(?:[.,]\d+)?/g);
  if (zahlen?.length) return zahlen.every((z) => q.includes(z));
  // Reine Wortangaben: es genügt, wenn das längste Wort belegt ist.
  const worte = w.split(/[^a-zäöüß0-9]+/i).filter((s) => s.length > 3).sort((a, b) => b.length - a.length);
  return worte.length ? q.includes(worte[0]) : false;
}

/**
 * Liest die Antwort und lässt nur durch, was Bestand hat: bekannte Welt,
 * bekannter Angebotstyp, bekanntes Feld, belegter Wert, keine Gestaltung.
 * Alles Verworfene wird benannt, nicht verschwiegen.
 */
export function deutungLesen(antwort: string, buendel: KandidatRoh[]): DeutungsErgebnis {
  const daten = jsonHeraus(antwort);
  if (!daten || typeof daten !== "object") {
    return { deutungen: [], ueber_text: null, fehler: "Die Antwort war kein lesbares JSON." };
  }
  const obj = daten as Record<string, unknown>;
  const werke = Array.isArray(obj.werke) ? obj.werke : [];
  const nachSchluessel = new Map(buendel.map((k) => [schluesselVon(k), k]));
  const deutungen: Deutung[] = [];

  for (const eintrag of werke) {
    if (!eintrag || typeof eintrag !== "object") continue;
    const e = eintrag as Record<string, unknown>;
    const schluessel = typeof e.schluessel === "string" ? e.schluessel : "";
    const kandidat = nachSchluessel.get(schluessel);
    // Ein Schlüssel, den wir nicht mitgeschickt haben, gehört uns nicht.
    if (!kandidat) continue;

    const verworfen: string[] = [];
    const quelle = [kandidat.titel, kandidat.beschreibung_text ?? "",
      ...(kandidat.kategorien ?? []), ...(kandidat.varianten ?? []).map((v) => v.titel)].join(" \n ");

    const weltRoh = typeof e.welt === "string" ? e.welt : "";
    const welt = (WELTEN as string[]).includes(weltRoh) ? weltRoh as Welt : null;
    if (weltRoh && !welt) verworfen.push(`Welt „${weltRoh}" gibt es nicht.`);

    let angebotstyp: string | null = null;
    const typRoh = typeof e.angebotstyp === "string" ? e.angebotstyp : "";
    if (typRoh && welt) {
      if (ANGEBOTSTYPEN[welt].includes(typRoh)) angebotstyp = typRoh;
      else verworfen.push(`Angebotstyp „${typRoh}" gibt es in ${welt} nicht.`);
    }

    const felder: Record<string, string> = {};
    const felderRoh = (e.welt_felder && typeof e.welt_felder === "object")
      ? e.welt_felder as Record<string, unknown> : {};
    for (const [name, wertRoh] of Object.entries(felderRoh)) {
      if (!welt) { verworfen.push(`Feld „${name}" ohne Welt verworfen.`); continue; }
      if (!WELT_FELDER[welt].includes(name)) { verworfen.push(`Feld „${name}" gibt es in ${welt} nicht.`); continue; }
      if (typeof wertRoh !== "string") { verworfen.push(`Feld „${name}" war kein Text.`); continue; }
      const wert = ohneGestaltung(wertRoh).slice(0, 300).trim();
      if (!wert) continue;
      if (!stehtInDerQuelle(wert, quelle)) { verworfen.push(`„${name}: ${wert}" steht nicht in der Quelle.`); continue; }
      felder[name] = wert;
    }

    const beschreibung = typeof e.beschreibung === "string"
      ? (ohneGestaltung(e.beschreibung).slice(0, 2000) || null) : null;

    const wortDna = Array.isArray(e.wort_dna)
      ? e.wort_dna.filter((w): w is string => typeof w === "string")
        .map((w) => ohneGestaltung(w).toLowerCase().trim()).filter(Boolean).slice(0, 8)
      : [];

    deutungen.push({ schluessel, welt, angebotstyp, welt_felder: felder, beschreibung, wort_dna: wortDna, verworfen });
  }

  const ueberRoh = typeof obj.ueber_text === "string" ? ohneGestaltung(obj.ueber_text).trim() : "";
  return {
    deutungen,
    ueber_text: ueberRoh ? ueberRoh.slice(0, 1200) : null,
    fehler: deutungen.length === 0 && werke.length > 0
      ? "Die Antwort enthielt keine Werke, die zu diesem Bündel gehören."
      : null,
  };
}
