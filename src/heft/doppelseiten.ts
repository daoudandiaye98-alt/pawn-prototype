/**
 * Teil X2 — die eine Wahrheit über Doppelseiten und Adressen.
 *
 * Hier steht, welche Doppelseiten es gibt, in welcher Reihenfolge sie liegen und
 * welche Adresse jede trägt. Alles andere leitet sich daraus ab:
 *
 *   Adresse  → Index      beim Aufrufen einer Adresse
 *   Index    → Adresse    beim Blättern (replaceState)
 *   Doppelseiten → Blätter   für den Wendel
 *
 * **Warum das Doppelseiten sind und keine Blätter.** Der Mechanismus dreht
 * Blätter mit Vorder- und Rückseite. Was ein Leser aber sieht und was eine
 * Adresse benennt, ist die aufgeschlagene *Doppelseite*. Deshalb ist die
 * Doppelseite hier das Erste und das Blatt das Abgeleitete — sonst müsste jeder,
 * der eine Sektion einfügt, im Kopf Vorder- und Rückseiten umrechnen.
 *
 *   Doppelseite 1  = Grund links        + Blatt 0 vorn
 *   Doppelseite 2  = Blatt 0 rück       + Blatt 1 vorn
 *   Doppelseite n  = Blatt n-2 rück     + Blatt n-1 vorn
 *   Doppelseite N  = Blatt N-2 rück     + Grund rechts
 *
 * Aus N Doppelseiten werden also N-1 Blätter.
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

/** Ein Blatt für den Wendel — abgeleitet, nie handgeschrieben. */
export interface Blatt {
  schluessel: string;
  vorn: ReactNode;
  rueck: ReactNode;
}

export interface Heftaufbau {
  grundLinks: ReactNode;
  grundRechts: ReactNode;
  blaetter: Blatt[];
}

/**
 * Doppelseiten → Blätter. Die Umkehrung der Tabelle im Kopf dieser Datei.
 *
 * Eine einzige Doppelseite ergibt kein Blatt: dann liegen beide Seiten als
 * Grund, und es gibt nichts zu wenden. Das ist kein Sonderfall, den man
 * abfangen muss, sondern fällt aus der Rechnung heraus.
 */
export function blaetterAus(seiten: Doppelseite[]): Heftaufbau {
  const blaetter: Blatt[] = [];
  for (let i = 0; i + 1 < seiten.length; i++) {
    blaetter.push({
      schluessel: seiten[i].schluessel,
      vorn: seiten[i].rechts,
      rueck: seiten[i + 1].links,
    });
  }
  return {
    grundLinks: seiten[0]?.links ?? null,
    grundRechts: seiten[seiten.length - 1]?.rechts ?? null,
    blaetter,
  };
}

/**
 * Adresse → Doppelseiten-Nummer (1-basiert, wie `wendel.seitenNummer`).
 *
 * Verglichen wird auf den Pfad ohne Schrägstrich am Ende, damit `/inhalt` und
 * `/inhalt/` dieselbe Seite treffen. Findet sich nichts, ist es die erste —
 * eine unbekannte Adresse schlägt das Heft vorn auf statt ins Leere zu greifen.
 */
export function nummerFuerPfad(seiten: Doppelseite[], pfad: string): number {
  const sauber = pfad.length > 1 ? pfad.replace(/\/+$/, "") : pfad;
  const i = seiten.findIndex((s) => s.pfad === sauber);
  return i < 0 ? 1 : i + 1;
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
