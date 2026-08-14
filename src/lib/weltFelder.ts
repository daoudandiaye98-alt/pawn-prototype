/**
 * WELTEN-GLEICHSTAND — eine einzige Quelle dafür, was jede Welt kennt.
 *
 * Vorher stand „Größe" bei allen drei Welten, weil das Formular aus der Mode
 * kam. Ein Schrank hat keine Größe, er hat Maße; ein Bild hat keine Passform,
 * es hat eine Technik. Was eine Welt kennt, steht ab hier an einer Stelle —
 * das Anlege-Formular, die Werkseite, die Boutique-Verfeinerungen und der
 * Versand lesen alle von hier.
 *
 * Wo die Werte liegen: `products.product_dna` (jsonb). Kein Schema-Umbau, keine
 * neue Tabelle — die Kunst-Ontologie (`kind`, `technik`, `medium`, `jahr`) liegt
 * dort schon seit PART 51.
 *
 * Regel für alle Anzeigen: ein leeres Feld ist unsichtbar. Es wird nie mit
 * einem Strich, einem „k. A." oder einem geratenen Wert gefüllt.
 */

export type Welt = "Mode" | "Interior" | "Kunst";
export const WELTEN: Welt[] = ["Mode", "Interior", "Kunst"];

export type FeldArt = "text" | "zahl" | "auswahl" | "mehrzeilig";

export interface Feld {
  /** Schlüssel in product_dna. Bleibt stabil, auch wenn das Label sich ändert. */
  schluessel: string;
  label: string;
  /** Was hier hineingehört — als Beispiel, nie als Vorbelegung. */
  platzhalter?: string;
  art: FeldArt;
  optionen?: string[];
  /** Erscheint in der Boutique als Verfeinerung. */
  filterbar?: boolean;
  /** Steht auf dem Werkzertifikat. */
  zertifikat?: boolean;
}

/* ------------------------------------------------------------- Angebotstypen */

export interface Angebotstyp {
  schluessel: string;
  label: string;
  /** Erklärung in einem Satz, im Formular unter der Auswahl. */
  satz: string;
  /** Unikat: Bestand ist fest 1. */
  unikat?: boolean;
  /** Kein Warenkorb — der Weg ist die Anfrage. */
  ohneKauf?: boolean;
}

export const ANGEBOTSTYPEN: Record<Welt, Angebotstyp[]> = {
  Mode: [
    { schluessel: "verkauf", label: "Aus dem Bestand", satz: "Liegt fertig da und geht sofort raus." },
    { schluessel: "auf_bestellung", label: "Auf Bestellung", satz: "Wird nach dem Kauf für die Kundin gefertigt." },
  ],
  Interior: [
    { schluessel: "verkauf", label: "Aus dem Bestand", satz: "Steht fertig da und geht sofort raus." },
    { schluessel: "auf_bestellung", label: "Auf Bestellung", satz: "Wird nach dem Kauf gefertigt — die Lieferzeit steht am Werk." },
    { schluessel: "massanfertigung", label: "Maßanfertigung", satz: "Maße und Material nach Absprache. Kein Warenkorb, sondern eine Anfrage.", ohneKauf: true },
    { schluessel: "materialmuster", label: "Materialmuster", satz: "Ein Muster zum Ansehen und Anfassen, bevor bestellt wird." },
  ],
  Kunst: [
    { schluessel: "original", label: "Original", satz: "Ein Unikat. Es gibt es genau einmal.", unikat: true },
    { schluessel: "print", label: "Print / Edition", satz: "Ein Druck, meist in nummerierter Auflage." },
    { schluessel: "auftragsarbeit", label: "Auftragsarbeit", satz: "Wird für die Käuferin entstehen. Kein Warenkorb, sondern eine Anfrage.", ohneKauf: true },
    { schluessel: "live_portrait", label: "Live-Porträt", satz: "Vor Ort, mit der Person im Raum. Kein Warenkorb, sondern eine Anfrage.", ohneKauf: true },
  ],
};

export function angebotstyp(welt: Welt, schluessel: string | null | undefined): Angebotstyp | null {
  if (!schluessel) return null;
  return ANGEBOTSTYPEN[welt].find((a) => a.schluessel === schluessel) ?? null;
}

/* -------------------------------------------------------------- Welt-Felder */

export const WELT_FELDER: Record<Welt, Feld[]> = {
  Mode: [
    { schluessel: "groesse", label: "Größe", platzhalter: "S · M · L oder 38", art: "text", filterbar: true },
    { schluessel: "passform", label: "Passform", platzhalter: "körpernah, gerade, oversize", art: "text" },
    { schluessel: "material", label: "Material", platzhalter: "Wolle, Leinen, Seide", art: "text", filterbar: true, zertifikat: true },
    { schluessel: "farbe", label: "Farbe", platzhalter: "Nachtblau", art: "text" },
    { schluessel: "pflege", label: "Pflege", platzhalter: "Handwäsche, kalt", art: "text" },
  ],
  Interior: [
    { schluessel: "masse", label: "Maße H × B × T", platzhalter: "78 × 120 × 45 cm", art: "text", filterbar: true, zertifikat: true },
    { schluessel: "gewicht", label: "Gewicht", platzhalter: "24 kg", art: "text" },
    { schluessel: "material", label: "Material / Holzart", platzhalter: "Eiche massiv, geölt", art: "text", filterbar: true, zertifikat: true },
    { schluessel: "oberflaeche", label: "Oberfläche", platzhalter: "geölt, lackiert, roh", art: "text" },
    { schluessel: "farbe", label: "Farbe", platzhalter: "natur", art: "text" },
    {
      schluessel: "fertigung", label: "Fertigung", art: "auswahl",
      optionen: ["Einzelstück", "Kleinserie", "Auf Bestellung"], filterbar: true, zertifikat: true,
    },
    { schluessel: "lieferzeit", label: "Fertigungs- und Lieferzeit", platzhalter: "6–8 Wochen", art: "text" },
    { schluessel: "montage", label: "Montage", platzhalter: "wird montiert geliefert", art: "text" },
    { schluessel: "pflege", label: "Pflege", platzhalter: "mit Öl nachbehandeln, jährlich", art: "mehrzeilig" },
    { schluessel: "belastbarkeit", label: "Sitzhöhe / Belastbarkeit", platzhalter: "Sitzhöhe 46 cm, bis 120 kg", art: "text" },
  ],
  Kunst: [
    { schluessel: "technik", label: "Technik", platzhalter: "Öl auf Leinwand", art: "text", filterbar: true, zertifikat: true },
    { schluessel: "medium", label: "Medium", platzhalter: "Malerei, Fotografie, Skulptur", art: "text", filterbar: true, zertifikat: true },
    { schluessel: "masse", label: "Maße H × B × T", platzhalter: "80 × 60 cm", art: "text", filterbar: true, zertifikat: true },
    { schluessel: "jahr", label: "Jahr", platzhalter: "2026", art: "text", filterbar: true, zertifikat: true },
    { schluessel: "auflage", label: "Auflage", platzhalter: "3 von 25", art: "text", zertifikat: true },
    { schluessel: "signatur", label: "Signatur", platzhalter: "signiert unten rechts", art: "text", zertifikat: true },
    { schluessel: "rahmung", label: "Rahmung", platzhalter: "ungerahmt", art: "text", zertifikat: true },
    { schluessel: "traeger", label: "Trägermaterial", platzhalter: "Leinwand auf Keilrahmen", art: "text", zertifikat: true },
    { schluessel: "zustand", label: "Zustand", platzhalter: "neu, direkt aus dem Atelier", art: "text" },
  ],
};

export function feld(welt: Welt, schluessel: string): Feld | null {
  return WELT_FELDER[welt].find((f) => f.schluessel === schluessel) ?? null;
}

/** Nur die Felder, die wirklich gefüllt sind — in der Reihenfolge der Welt. */
export function gefuellteFelder(welt: Welt, dna: Record<string, unknown> | null | undefined): { feld: Feld; wert: string }[] {
  if (!dna) return [];
  return WELT_FELDER[welt]
    .map((f) => ({ feld: f, wert: typeof dna[f.schluessel] === "string" ? String(dna[f.schluessel]).trim() : "" }))
    .filter((x) => x.wert.length > 0);
}

/** Verfeinerungen der Boutique für eine Welt — höchstens drei, sonst wird es ein Formular. */
export function filterFelder(welt: Welt): Feld[] {
  return WELT_FELDER[welt].filter((f) => f.filterbar).slice(0, 3);
}

/* ------------------------------------------------------------------ Versand */

/**
 * Ein Werk verlässt das Haus je nach Welt völlig anders. Ein Kleid ist ein
 * Paket; ein Schrank ist eine Spedition mit Termin; ein großformatiges Bild
 * reist in der Rolle oder flach und will versichert sein. Die alten drei
 * Pauschalen (Inland/EU/Welt) blieben, weil sie für Mode stimmen — sie sind
 * jetzt das Profil „paket".
 */
export interface Versandart {
  schluessel: string;
  label: string;
  satz: string;
  /** Nur nach Absprache: kein fester Preis, der Kauf löst eine Nachricht aus. */
  nurAbsprache?: boolean;
}

export const VERSANDARTEN: Record<Welt, Versandart[]> = {
  Mode: [
    { schluessel: "paket", label: "Paket", satz: "Der Normalfall: ein Paket, ein Preis." },
    { schluessel: "abholung", label: "Selbstabholung", satz: "Die Kundin holt es bei dir ab." },
  ],
  Interior: [
    { schluessel: "paket", label: "Paket", satz: "Kleinere Stücke, die ein Paketdienst nimmt." },
    { schluessel: "sperrgut", label: "Sperrgut", satz: "Zu groß fürs Paket, noch kein Spediteur." },
    { schluessel: "spedition_bordstein", label: "Spedition bis Bordsteinkante", satz: "Der Spediteur stellt vor der Tür ab." },
    { schluessel: "spedition_verwendung", label: "Spedition bis Verwendungsstelle", satz: "Bis in den Raum, mit Termin." },
    { schluessel: "abholung", label: "Selbstabholung", satz: "Die Kundin holt es bei dir ab." },
  ],
  Kunst: [
    { schluessel: "rolle", label: "Rolle / Tube", satz: "Ungerahmte Arbeiten auf Papier oder Leinwand." },
    { schluessel: "flach", label: "Flach verpackt", satz: "Gerahmt oder auf Keilrahmen, in der Kiste." },
    { schluessel: "spedition_kunst", label: "Kunstspedition", satz: "Großformate, mit Termin und Versicherung." },
    { schluessel: "abholung", label: "Selbstabholung", satz: "Die Käuferin holt es im Atelier ab." },
    { schluessel: "absprache", label: "Nur nach Absprache", satz: "Der Weg wird für jedes Werk einzeln besprochen.", nurAbsprache: true },
  ],
};

/** Die Zonen bleiben, wie sie waren — nur je Versandart statt einmal für alles. */
export const VERSANDZONEN = [
  { schluessel: "inland", label: "Inland" },
  { schluessel: "eu", label: "EU" },
  { schluessel: "world", label: "Welt" },
] as const;

export type Versandzone = (typeof VERSANDZONEN)[number]["schluessel"];

/** Ein Satz je Zone — die Form, die schon in designers.shipping_rates steht. */
export interface VersandZonenSatz {
  flat_cents: number;
  free_from_cents: number | null;
}

export type VersandProfil = Record<Versandzone, VersandZonenSatz>;

/**
 * Die gespeicherte Form in `designers.shipping_rates`.
 *
 * Alt (bis hierher): { inland: {flat_cents, free_from_cents}, eu: {…}, world: {…} }
 * Neu:               { profile: { paket: {inland: {…}, eu: {…}, world: {…}}, sperrgut: {…} } }
 *
 * Die alte Form wird weiter gelesen und als Profil „paket" verstanden — kein
 * Haus muss etwas tun, damit sein Versand weiter funktioniert, und gespeichert
 * wird zusätzlich weiter die alte Form, damit ältere Leser nicht ins Leere greifen.
 */
export interface VersandSaetze {
  profile?: Record<string, VersandProfil>;
  /** Alte Form, weiterhin gelesen und weiterhin mitgeschrieben. */
  inland?: VersandZonenSatz;
  eu?: VersandZonenSatz;
  world?: VersandZonenSatz;
}

export const LEERER_SATZ: VersandZonenSatz = { flat_cents: 0, free_from_cents: null };
export const LEERES_PROFIL: VersandProfil = {
  inland: { ...LEERER_SATZ }, eu: { ...LEERER_SATZ }, world: { ...LEERER_SATZ },
};

function istSatz(x: unknown): x is VersandZonenSatz {
  return !!x && typeof x === "object" && typeof (x as VersandZonenSatz).flat_cents === "number";
}

/** Liest die Profile — egal ob alte oder neue Form gespeichert ist. */
export function versandProfile(saetze: VersandSaetze | null | undefined): Record<string, VersandProfil> {
  if (!saetze) return {};
  if (saetze.profile && Object.keys(saetze.profile).length > 0) {
    return Object.fromEntries(Object.entries(saetze.profile).map(([name, p]) => [name, {
      inland: istSatz(p?.inland) ? p.inland : { ...LEERER_SATZ },
      eu: istSatz(p?.eu) ? p.eu : { ...LEERER_SATZ },
      world: istSatz(p?.world) ? p.world : { ...LEERER_SATZ },
    }]));
  }
  // Alte Form: die drei Zonen sind das Paket-Profil.
  if (istSatz(saetze.inland) || istSatz(saetze.eu) || istSatz(saetze.world)) {
    return {
      paket: {
        inland: istSatz(saetze.inland) ? saetze.inland : { ...LEERER_SATZ },
        eu: istSatz(saetze.eu) ? saetze.eu : { ...LEERER_SATZ },
        world: istSatz(saetze.world) ? saetze.world : { ...LEERER_SATZ },
      },
    };
  }
  return {};
}

/**
 * Schreibt die neue Form und lässt die alte daneben stehen: alles, was
 * shipping_rates.inland/.eu/.world liest (Checkout, ältere Ansichten), findet
 * weiter das, was es erwartet — nämlich das Paket-Profil.
 */
export function versandSpeicherform(profile: Record<string, VersandProfil>): VersandSaetze {
  const paket = profile.paket ?? Object.values(profile)[0] ?? LEERES_PROFIL;
  return { profile, inland: paket.inland, eu: paket.eu, world: paket.world };
}

/** Welche Versandart zu einem Werk passt, wenn das Haus nichts anderes gesetzt hat. */
export function versandVorschlag(welt: Welt, dna: Record<string, unknown> | null | undefined): string {
  if (welt === "Mode") return "paket";
  if (welt === "Kunst") {
    const gerahmt = String(dna?.rahmung ?? "").toLowerCase();
    if (gerahmt && !gerahmt.includes("ungerahmt")) return "flach";
    return "rolle";
  }
  // Interior: aus den Maßen ablesen, ob das noch ein Paket sein kann.
  const masse = String(dna?.masse ?? "");
  const zahlen = masse.match(/\d+(?:[.,]\d+)?/g)?.map((z) => Number(z.replace(",", "."))) ?? [];
  const groesste = zahlen.length ? Math.max(...zahlen) : 0;
  if (groesste > 0 && groesste <= 60) return "paket";
  if (groesste > 0 && groesste <= 120) return "sperrgut";
  return "spedition_bordstein";
}
