/**
 * Wann ist ein Prüfstandslauf überhaupt ein Urteil?
 *
 * **Der belegte Fall.** Lauf #104 (10.09.2026, Kopf 42c1dc0) meldete grün. Sein
 * eigenes Ergebnis lautete `1 bestanden · 0 gefallen · 673 nicht prüfbar`. Der
 * Browser auf dem Runner löste `rnakubexbqfgfciynqpt.supabase.co` nicht auf
 * (`net::ERR_NAME_NOT_RESOLVED`, 24 Anfragen je Seite). Die Vorschau lud — die
 * Sperre hebt `VERCEL_AUTOMATION_BYPASS_SECRET` auf —, aber sie lud als HÜLLE
 * ohne Inhalte. Gemessen wurde damit fast nichts, und der Check sagte trotzdem
 * „bestanden".
 *
 * Je Gate war das schon vorher ehrlich: `lauf.ts` zählt eine Hülle bewusst als
 * `nicht_pruefbar` statt als `bestanden` — ein falsches „bestanden" wäre
 * gefährlicher als ein „gefallen", weil es wie ein Beleg aussieht. Nur das
 * GESAMTurteil kannte diesen Zustand nicht: es fragte allein „ist etwas
 * gefallen?", und nichts zu messen heißt eben auch, dass nichts fällt.
 *
 * `.claude/rules/00-gesetze.md` sagt: eine Prüfung, die an rechtmäßigem Code rot
 * wird, lehrt Rot zu übersehen. Das Gegenstück steht hier: eine Prüfung, die
 * grün meldet, ohne gemessen zu haben, lehrt **Grün zu glauben**. Beides macht
 * die Kennzahl wertlos, nur in verschiedene Richtungen.
 *
 * **Warum nicht einfach rot.** Der Grund ist die Umgebung, nicht der Zweig. Ein
 * Check, der unabhängig vom Inhalt des Zweigs rot ist, sperrt jeden PR und wird
 * binnen zweier Tage weggeklickt — derselbe Fehler, den der Workflow beim
 * Vorschau-Geheimnis schon einmal gemacht hat. Deshalb ein DRITTER Ausgang:
 * kein Urteil. Er blockiert nichts und behauptet nichts.
 */

/**
 * Rückgabewert für „kein Urteil".
 *
 * Eigener Wert, damit der Workflow ihn von den beiden bestehenden unterscheiden
 * kann: `0` bestanden, `1` ein Gate gefallen, `2` falsches Ziel (Aufruffehler).
 * `3` heißt: gelaufen, aber nichts gesehen. Der Workflow macht daraus eine
 * Warnung und lässt den Check grün — blockieren wäre falsch, denn die Ursache
 * liegt in der Umgebung, nicht im Zweig.
 */
export const KEIN_URTEIL = 3;

/** Die drei Zahlen, die `bericht.json` unter `gates` führt. */
export interface Gatezahlen {
  bestanden: number;
  gefallen: number;
  nicht_pruefbar: number;
}

export interface Urteilsfaehigkeit {
  /** Trägt der Lauf ein Urteil? `false` heißt: er hat zu wenig gesehen. */
  urteil: boolean;
  /** Gates, die tatsächlich gemessen wurden (bestanden + gefallen). */
  gemessen: number;
  /** Alle Gates des Laufs. */
  gesamt: number;
  /** Anteil der gemessenen Gates, auf drei Stellen. `0`, wenn es keine gibt. */
  anteil: number;
  /** Ein Satz, der ins Protokoll gehört — auch im guten Fall. */
  grund: string;
}

/**
 * Mindestanteil messbarer Gates, damit ein Lauf ein Urteil trägt.
 *
 * Die Hälfte, nicht mehr: Einzelne `nicht_pruefbar` sind normal (eine gesperrte
 * Seite, ein Ziel ohne 404-Kopfzeile) und dürfen den Lauf nicht entwerten. Fällt
 * es aber unter die Hälfte, ist nicht mehr die Seite die Frage, sondern die
 * Messung. Lauf #104 lag bei 0,001.
 */
export const MINDESTANTEIL = 0.5;

/**
 * Entscheidet, ob ein Lauf ein Urteil trägt — die reine Rechnung, ohne Browser.
 *
 * Ausgelagert, damit sie prüfbar ist: `tools/` liegt außerhalb von
 * `tsconfig.app.json`, und der Prüfstand als Ganzes lässt sich in einem Test
 * nicht fahren. Diese Funktion schon (`src/__tests__/pruefstand-urteil.spec.ts`).
 */
export function urteilsfaehig(gates: Gatezahlen): Urteilsfaehigkeit {
  const gemessen = gates.bestanden + gates.gefallen;
  const gesamt = gemessen + gates.nicht_pruefbar;

  if (gesamt === 0) {
    return {
      urteil: false,
      gemessen: 0,
      gesamt: 0,
      anteil: 0,
      grund: "Kein einziges Gate im Lauf — über nichts lässt sich urteilen.",
    };
  }

  const anteil = Math.round((gemessen / gesamt) * 1000) / 1000;
  if (anteil < MINDESTANTEIL) {
    return {
      urteil: false,
      gemessen,
      gesamt,
      anteil,
      grund:
        `Nur ${gemessen} von ${gesamt} ${gesamt === 1 ? "Gate war" : "Gates waren"} messbar `
        + `(${(anteil * 100).toFixed(1)} %, nötig ${(MINDESTANTEIL * 100).toFixed(0)} %). `
        + (gates.nicht_pruefbar === 1
          ? `Das übrige blieb „nicht prüfbar"`
          : `Die übrigen ${gates.nicht_pruefbar} blieben „nicht prüfbar"`)
        + ` — die Seiten kamen als Hülle an. Dieser Lauf sagt über den Zweig NICHTS, `
        + `weder Gutes noch Schlechtes.`,
    };
  }

  return {
    urteil: true,
    gemessen,
    gesamt,
    anteil,
    grund: `${gemessen} von ${gesamt} Gates gemessen (${(anteil * 100).toFixed(1)} %).`,
  };
}
