/**
 * Die eine Wahrheit über Szenen und Adressen.
 *
 * Hier steht, welche Szenen es gibt, in welcher Reihenfolge sie liegen und
 * welche Adresse jede trägt. Alles andere leitet sich daraus ab:
 *
 *   Adresse → Nummer    beim Zeichnen (die Route ist der Zustand)
 *   Nummer  → Adresse   beim Blättern (`navigate`)
 *
 * **Warum der Typ `Doppelseite` heißt und bleibt.** Die Doppelseite ist seit
 * dem Szenen-Umbau (Audit, 19.08.2026) eine KOMPOSITIONSFLÄCHE, keine
 * Navigationseinheit: `links`/`rechts` sind die zwei Spalten einer Szene —
 * breit nebeneinander, schmal untereinander. Die Blatt-Ableitungen des alten
 * Wendels (`blaetterAus`, `einzelseitenAus`, Vorder-/Rückseiten-Paarung) sind
 * mit der Papiersimulation ausgebaut.
 */
import type { ReactNode } from "react";

export type Ton = "papier" | "nacht";

/** Eine Doppelseite, wie sie im Heft liegt. */
export interface Doppelseite {
  /** Stabiler Schlüssel — React-Key und Registerkennung. */
  schluessel: string;
  /** Die Adresse dieser Doppelseite. Genau eine, immer absolut. */
  pfad: string;
  /** Steht oben innen auf beiden Seiten. */
  kolumne: string;
  /**
   * Der Titel dieser Doppelseite — Seitentitel und die eine `h1`.
   *
   * **Warum das hier steht und nicht im Satzspiegel.** X12 verlangt genau eine
   * `h1` je Adresse. Ein Heft hat aber alle Doppelseiten gleichzeitig im DOM
   * (X12: echtes HTML, keine virtualisierte Seitenliste) — wären die
   * Schlagzeilen `h1`, stünden zwölf davon auf einer Adresse. Deshalb sind alle
   * sichtbaren Schlagzeilen `h2`, und die Hülle trägt eine einzige `h1`, die den
   * Titel der aufgeschlagenen Doppelseite nennt und beim Blättern mitgeht.
   *
   * Der Text ist derselbe wie die sichtbare Schlagzeile — kein zweiter Titel,
   * der etwas anderes behauptet.
   */
  titel: string;
  /**
   * Zu welcher Sektion diese Doppelseite gehört.
   *
   * Nötig, weil eine Sektion mehrere Doppelseiten haben kann — das Verzeichnis
   * hat viele. Der Reiter im Griffregister gehört der *Sektion*, nicht der
   * einzelnen Seite: wer auf `/verzeichnis/3` steht, soll „Verzeichnis"
   * hervorgehoben sehen und nicht ein Register ohne Markierung.
   */
  sektion: string;
  /**
   * Beschriftung im Griffregister. Genau eine Doppelseite je Sektion trägt sie
   * — die, auf die der Reiter springt. Alle anderen Seiten derselben Sektion
   * lassen sie leer und werden über `sektion` mitmarkiert.
   */
  reiter?: string;
  ton: Ton;
  links: ReactNode;
  rechts: ReactNode;
}

/**
 * Adresse → Doppelseiten-Nummer (1-basiert).
 *
 * Verglichen wird auf den Pfad ohne Schrägstrich am Ende, damit `/inhalt` und
 * `/inhalt/` dieselbe Seite treffen. Findet sich nichts, ist es die erste —
 * eine unbekannte Adresse schlägt das Heft vorn auf statt ins Leere zu greifen.
 */
export function nummerFuerPfad(seiten: Doppelseite[], pfad: string): number {
  return findeNummer(seiten, pfad) ?? 1;
}

/**
 * Dasselbe, aber ehrlich: `null`, wenn es diese Adresse im Heft nicht gibt.
 *
 * Der Unterschied zählt seit X7. Die Werke entstehen aus Daten, und die sind im
 * ersten Bild noch nicht da — `/werk/<slug>` ist dann eine Adresse, die es
 * gleich geben wird. `nummerFuerPfad` kann das nicht sagen (es antwortet mit
 * „die erste Seite"), und wer nicht unterscheiden kann, schlägt vorn auf und
 * bleibt dort. Die Hülle holt die Adresse deshalb nach, sobald sie erscheint.
 */
export function findeNummer(seiten: Doppelseite[], pfad: string): number | null {
  const sauber = pfad.length > 1 ? pfad.replace(/\/+$/, "") : pfad;
  const i = seiten.findIndex((s) => s.pfad === sauber);
  return i < 0 ? null : i + 1;
}

/** Doppelseiten-Nummer → Adresse. Außerhalb des Hefts der erste Pfad. */
export function pfadFuerNummer(seiten: Doppelseite[], nummer: number): string {
  return (seiten[nummer - 1] ?? seiten[0])?.pfad ?? "/";
}

/**
 * Die Folios einer Doppelseite.
 *
 * Ein Umschlag trägt keine Seitenzahl — das ist Satzkonvention, keine Laune.
 * Deshalb beginnt die Zählung auf Doppelseite 2 mit 02/03, genau wie im
 * gedruckten Heft. `null` heißt: hier steht keine Zahl.
 */
export function folios(nummer: number): { links: number | null; rechts: number | null } {
  const links = 2 * nummer - 2;
  return links < 2 ? { links: null, rechts: null } : { links, rechts: links + 1 };
}

/**
 * Gehört diese Adresse dem Heft?
 *
 * Eine kleine Wahrheit an einer Stelle, weil zwei sie brauchen: das Heft selbst
 * und die Einwilligungsleiste, die nur auf dem Umschlag stehen soll. Die Liste
 * spiegelt die Routen, die in `App.tsx` auf `HeftRoute` zeigen — geprüft von
 * `src/__tests__/heft-adressen.spec.ts`, damit sie nicht auseinanderlaufen.
 */
const HEFT_SEKTIONEN = [
  "/", "/inhalt", "/kuratierter-raum", "/drei-welten", "/mode", "/interior",
  "/kunst", "/haeuser", "/deine-dna", "/frag-pawn", "/fuer-designer",
] as const;

const HEFT_PRAEFIXE = ["/verzeichnis/", "/werk/", "/haus/"] as const;

export function istHeftAdresse(pfad: string): boolean {
  const sauber = pfad.length > 1 ? pfad.replace(/\/+$/, "") : pfad;
  return (HEFT_SEKTIONEN as readonly string[]).includes(sauber)
    || HEFT_PRAEFIXE.some((v) => sauber.startsWith(v));
}
