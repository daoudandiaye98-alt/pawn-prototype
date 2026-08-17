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
  /** Der Ton der Vorderseite. Steht am Blatt, damit die Hülle nicht rechnen muss. */
  tonVorn: Ton;
  /** Der Ton der Rückseite. `null`, wenn das Blatt keine trägt (Einzelseite). */
  tonRueck: Ton | null;
}

export interface Heftaufbau {
  grundLinks: ReactNode;
  grundRechts: ReactNode;
  tonGrundLinks: Ton | null;
  tonGrundRechts: Ton | null;
  blaetter: Blatt[];
  /**
   * Wie viele Wendel-Schritte es gibt — die Länge von `blaetter`.
   *
   * Steht mit im Aufbau, weil die Hülle daraus ihre Scrollhöhe rechnet und die
   * Zahl je Modus eine andere ist. Sie soll sie nicht selbst herleiten müssen.
   */
  schritte: number;
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
      tonVorn: seiten[i].ton,
      tonRueck: seiten[i + 1].ton,
    });
  }
  return {
    grundLinks: seiten[0]?.links ?? null,
    grundRechts: seiten[seiten.length - 1]?.rechts ?? null,
    tonGrundLinks: seiten[0]?.ton ?? null,
    tonGrundRechts: seiten[seiten.length - 1]?.ton ?? null,
    blaetter,
    schritte: blaetter.length,
  };
}

/**
 * Doppelseiten → EINZELNE Seiten. Die zweite Ableitung aus derselben Wahrheit.
 *
 * **Warum es sie gibt.** Auf dem Telefon zeigt das Heft eine Seite (X3). Bisher
 * wendete es dort trotzdem um eine ganze DOPPELSEITE — und weil auf einer
 * Einzelseite nur die rechte Seite zu sehen ist, übersprang jeder Wendel die
 * linke. Im Verzeichnis hieß das: sechs Stücke pro Wendel unsichtbar. Der Leser
 * bekam die Hälfte des Hefts nie zu sehen.
 *
 * Jetzt ist die Seite die Einheit: `/verzeichnis/7` schlägt links auf, einmal
 * wenden zeigt rechts (dieselbe Adresse), noch einmal wenden ist
 * `/verzeichnis/8`.
 *
 * **Warum nur Vorderseiten.** Auf der Einzelseite sitzt das Scharnier an der
 * linken Kante des Blatts, nicht im Bund. Ein gewendetes Blatt landet damit
 * NEBEN dem Heft, nicht darüber — seine Rückseite ist an ihrem Platz nie zu
 * sehen. Was beim Wenden erscheint, ist die Vorderseite des Blatts darunter.
 * Also trägt hier jedes Blatt genau eine Seite, und das letzte liegt als Grund.
 *
 * **Warum das keine zweite Fassung ist.** Beides sind Ableitungen aus derselben
 * Liste von Doppelseiten, in dieselbe Form (`Heftaufbau`). Die Hülle zeichnet
 * unverändert; sie bekommt nur einen anderen Stapel. Die Wahrheit bleibt eine.
 */
export function einzelseitenAus(seiten: Doppelseite[]): Heftaufbau {
  /* Alle Seiten in Leserichtung: links, rechts, links, rechts … */
  const flach: { schluessel: string; inhalt: ReactNode; ton: Ton }[] = [];
  for (const s of seiten) {
    flach.push({ schluessel: `${s.schluessel}-l`, inhalt: s.links, ton: s.ton });
    flach.push({ schluessel: `${s.schluessel}-r`, inhalt: s.rechts, ton: s.ton });
  }

  /* Jedes Blatt außer dem letzten wendet; das letzte ist der Grund darunter. */
  const blaetter: Blatt[] = flach.slice(0, -1).map((s) => ({
    schluessel: s.schluessel,
    vorn: s.inhalt,
    rueck: null,
    tonVorn: s.ton,
    tonRueck: null,
  }));
  const letzte = flach[flach.length - 1];

  return {
    /* Links liegt auf der Einzelseite nichts — das Blatt füllt die Fläche. */
    grundLinks: null,
    grundRechts: letzte?.inhalt ?? null,
    tonGrundLinks: null,
    tonGrundRechts: letzte?.ton ?? null,
    blaetter,
    schritte: blaetter.length,
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
