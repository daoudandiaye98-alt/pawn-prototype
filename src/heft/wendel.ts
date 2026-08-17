/**
 * Teil M1 — die Rechnung hinter dem Blatt. Für Teil X unverändert übernommen.
 *
 * Diese Datei ist eine wörtliche Kopie von `src/features/heft/wendel.ts`. Sie
 * liegt hier, weil `src/heft/` die neue Hülle ist und `src/features/heft/` mit
 * Schritt 8 (X1) verschwindet. Bis dahin existieren beide — dieselbe Rechnung,
 * kein zweites Modell. Wer eine Zahl ändert, ändert sie in X, nicht in M.
 *
 * Reine Funktionen, kein DOM. Wer den Wendel verstehen will, liest diese Datei;
 * `Heft.tsx` schreibt die Ergebnisse nur noch in Stil-Eigenschaften.
 *
 * Bewegungsgesetz: es entstehen ausschließlich Werte für `transform` und `opacity`.
 * Keine Zahl aus dieser Datei landet je auf width/height/top/left/margin/filter.
 */

/** Scrollweg je Blatt in px. Eine benannte Konstante, weil sie im Test justiert wird. */
export const WEG = 900;

/** Ab hier eine Doppelseite, darunter eine Einzelseite. */
export const EINZELSEITE_BIS = 820;

/** Und ab hier der Höhe nach — ein Telefon quer ist breit, aber flach. */
export const EINZELSEITE_HOEHE_BIS = 600;

/**
 * Die Bedingung für die Einzelseite, als Medienabfrage.
 *
 * Sie steht hier und nicht zweimal, weil zwei Stellen auseinanderlaufen können:
 * das Heft baut aus ihr seinen Stapel (eine Seite je Blatt oder zwei), die CSS
 * legt aus ihr die Flächen. Wären die Grenzen verschieden, zeigte das Heft für
 * einen Streifen von Fenstergrößen zwei Seiten und wendete einzeln — oder
 * umgekehrt.
 *
 * `heft.css` trägt die gleiche Abfrage wörtlich; sie kann keine JS-Konstante
 * lesen. Der Kommentar dort verweist hierher. Wer eine Grenze verschiebt,
 * verschiebt beide.
 */
export const EINZELSEITE_ABFRAGE =
  `(max-width: ${EINZELSEITE_BIS - 0.02}px), (max-height: ${EINZELSEITE_HOEHE_BIS - 0.02}px)`;

/**
 * Einzelseiten-Modus: aus der Seitenzahl die Doppelseite, und zurück.
 *
 * Die Adresse gehört der DOPPELSEITE (X2) — auch dann, wenn nur eine Seite zu
 * sehen ist. Seite 13 und Seite 14 tragen also dieselbe Adresse, und beim
 * Blättern wechselt sie erst bei jedem zweiten Wendel. Wer eine Adresse aufruft,
 * schlägt auf ihrer ERSTEN Seite auf, also links.
 */
export const doppelseiteFuerSeite = (seite: number) => Math.max(1, Math.ceil(seite / 2));
export const ersteSeiteVon = (doppelseite: number) => Math.max(1, doppelseite * 2 - 1);

/** Wie viele Blätter links und rechts vom aktuellen in der 3D-Ebene liegen. */
export const FENSTER = 2;

/** Stärke des Knicks in der Mitte der Bewegung. */
export const KNICK_MAX = 0.55;

export const klemme = (x: number, min = 0, max = 1) => (x < min ? min : x > max ? max : x);

/** Kubisch rein/raus — kein Ruck am Anfang, kein Anschlag am Ende. */
export const weich = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export interface BlattStand {
  /** Fortschritt 0…1, geglättet. */
  e: number;
  /** Grad um die linke Kante. */
  winkel: number;
  /** Stapelordnung: ungewendet fällt nach hinten, gewendet stapelt sich links auf. */
  ebene: number;
  /** Deckkraft des Knickschattens — am stärksten genau in der Mitte. */
  knick: number;
}

/**
 * Der Stand eines Blattes bei einem Scrollstand.
 * Blatt `i` wendet zwischen `i * WEG` und `(i + 1) * WEG`.
 */
export function blattStand(scrollY: number, i: number, weg = WEG): BlattStand {
  const e = weich(klemme((scrollY - i * weg) / weg));
  return {
    e,
    winkel: -180 * e,
    ebene: e < 0.5 ? 40 - i : 20 + i,
    knick: Math.sin(Math.PI * e) * KNICK_MAX,
  };
}

/** Die Gesamthöhe des Dokuments: so bleibt der Rollbalken echt. */
export const scrollHoehe = (blaetter: number, fensterHoehe: number, weg = WEG) =>
  blaetter * weg + fensterHoehe;

/**
 * Welche Doppelseite steht gerade? 1 = Titel. Nach dem letzten Blatt die Rückseite.
 * Gerundet wird bei der Hälfte des Wendels — dort kippt auch die Stapelordnung,
 * also der Moment, in dem das Auge die neue Seite als „die aktuelle" liest.
 */
export function seitenNummer(scrollY: number, blaetter: number, weg = WEG): number {
  return Math.min(blaetter + 1, Math.max(1, Math.floor(scrollY / weg + 0.5) + 1));
}

/** Der Scrollstand, bei dem eine Doppelseite ruhig steht. */
export const standFuerSeite = (nummer: number, weg = WEG) => Math.max(0, (nummer - 1) * weg);
