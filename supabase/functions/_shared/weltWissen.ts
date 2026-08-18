/**
 * WELT-WISSEN für die Edge Functions — das Gegenstück zu `src/lib/weltFelder.ts`.
 *
 * **Warum es diese Datei gibt.** Q4b hat jedem Werk je nach Welt eigene Felder
 * gegeben (`products.product_dna`). Die KI-Funktionen kannten sie danach noch
 * nicht: `studio-ai` schrieb über einen Öl auf Leinwand im Produktduktus, und
 * `pawn-chat` las aus der DNA nur die Mode-Schlüssel. Dieses Modul trägt, was
 * die Prompts brauchen — die Feld-Schlüssel je Welt, den Duktus je Welt und
 * die Preis-Faktoren je Welt.
 *
 * **Warum es eine Kopie der Schlüssel ist und keine gemeinsame Datei.** Die
 * Edge Functions werden getrennt gebündelt und können nicht aus `src/`
 * importieren. Zwei Listen derselben Sache sind trotzdem nur erlaubt, weil
 * eine Wache sie zusammenhält: `src/__tests__/welt-wissen.spec.ts` schlägt
 * fehl, sobald die Schlüssel hier von `weltFelder.ts` abweichen.
 */

export type Welt = "Mode" | "Interior" | "Kunst";

/** Schlüssel → Label, in der Reihenfolge, in der die Welt sie erzählt. */
export const WELT_SCHLUESSEL: Record<Welt, [string, string][]> = {
  Mode: [
    ["groesse", "Größe"],
    ["passform", "Passform"],
    ["material", "Material"],
    ["farbe", "Farbe"],
    ["pflege", "Pflege"],
  ],
  Interior: [
    ["masse", "Maße H × B × T"],
    ["gewicht", "Gewicht"],
    ["material", "Material / Holzart"],
    ["oberflaeche", "Oberfläche"],
    ["farbe", "Farbe"],
    ["fertigung", "Fertigung"],
    ["lieferzeit", "Fertigungs- und Lieferzeit"],
    ["montage", "Montage"],
    ["pflege", "Pflege"],
    ["belastbarkeit", "Sitzhöhe / Belastbarkeit"],
  ],
  Kunst: [
    ["technik", "Technik"],
    ["medium", "Medium"],
    ["masse", "Maße H × B × T"],
    ["jahr", "Jahr"],
    ["auflage", "Auflage"],
    ["signatur", "Signatur"],
    ["rahmung", "Rahmung"],
    ["traeger", "Trägermaterial"],
    ["zustand", "Zustand"],
  ],
};

/**
 * Der Duktus je Welt — WIE über ein Werk geschrieben und gesprochen wird.
 *
 * Ein Kleid wird getragen, ein Bild wird gelebt, ein Möbel wird benutzt und
 * bleibt. Ein einziger Produktduktus macht aus allen dreien Ware.
 */
export const WELT_DUKTUS: Record<Welt, string> = {
  Mode: "Sprich über Material, Fall und Tragegefühl — was das Stück am Körper tut, nicht was es verspricht.",
  Kunst: "Sprich wie über ein Werk, nicht wie über ein Produkt: Technik, Entstehung, was es im Raum verändert. "
    + "Nenne Auflage und Signatur, wenn sie da sind — sie machen den Wert nachvollziehbar. Keine Verkaufssprache.",
  Interior: "Sprich über Material, Machart und Gebrauch: wie es gefertigt ist, wie es altert, was es aushält. "
    + "Ein Möbel wird über Jahre benutzt — Herkunft des Materials und Pflege gehören zur Geschichte, nicht ins Kleingedruckte.",
};

/**
 * Preis-Faktoren je Welt — WORAN eine ehrliche Preisorientierung sich bemisst.
 * Kein Rechenmodell, sondern die Liste dessen, was gewogen werden muss.
 */
export const WELT_PREISFAKTOREN: Record<Welt, string> = {
  Mode: "Material und Materialkosten, Fertigungsaufwand, Auf-Bestellung oder Bestand.",
  Kunst: "Format (Maße), Technik und Medium, Unikat oder Auflage (und deren Höhe), Schaffensphase des Hauses. "
    + "Ein Original trägt einen anderen Preis als ein Print derselben Arbeit.",
  Interior: "Material und Materialeinsatz, Fertigungsaufwand (Einzelstück, Kleinserie, auf Bestellung), "
    + "Fertigungszeit, Versandart (Sperrgut und Spedition kosten real).",
};

/** Die Welt eines Werks, defensiv gelesen — Unbekanntes fällt auf Mode zurück. */
export function alsWelt(world: string | null | undefined): Welt {
  return world === "Kunst" || world === "Interior" ? world : "Mode";
}

/**
 * Die gefüllten Welt-Felder eines Werks als Prompt-Zeilen.
 * Leere Felder erscheinen nicht — dieselbe Regel wie überall (Q4b): ein leeres
 * Feld ist unsichtbar, nie ein Strich, nie ein geratener Wert.
 */
export function weltFelderZeilen(world: string | null | undefined, dna: Record<string, unknown> | null | undefined): string[] {
  if (!dna) return [];
  return WELT_SCHLUESSEL[alsWelt(world)]
    .map(([schluessel, label]) => {
      const wert = typeof dna[schluessel] === "string" ? String(dna[schluessel]).trim() : "";
      return wert ? `${label}: ${wert}` : null;
    })
    .filter((z): z is string => z !== null);
}
