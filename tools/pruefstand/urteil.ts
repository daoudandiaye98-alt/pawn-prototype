import { MINDESTANTEIL_MESSBAR } from "./pruefstand.config";

/**
 * Kein Urteil ohne Messung.
 *
 * **Der belegte Fehler.** Lauf 92 am 08.09.2026 auf PR #182 meldete GRÜN:
 *
 *   Gates: 1 bestanden · 0 gefallen · 1103 nicht prüfbar
 *
 * Auf dem Runner scheiterte die Namensauflösung zu Supabase; jede Seite war eine
 * leere Hülle, und die Hüllen-Regel hat richtig gehandelt — sie wertete nichts.
 * Nur: „0 gefallen" von EINEM gemessenen Gate sieht im Check genauso aus wie
 * „0 gefallen" von 1104. Der PR wurde auf diesem grünen Haken gemerged.
 *
 * Ein Prüfstand, der grün meldet, ohne gemessen zu haben, ist schlimmer als
 * einer, der rot meldet: Rot wird untersucht, Grün wird geglaubt.
 *
 * Steht in einer eigenen Datei und nicht in `lauf.ts`, damit ein Test sie
 * importieren kann, ohne den Lauf selbst zu starten — `lauf.ts` fährt beim
 * Import einen Browser hoch (`void haupt()` am Dateiende).
 *
 * Ein Teillauf (`--kontrollen`) ist ausgenommen: der misst absichtlich wenig.
 */
export function urteilenOhneMessung(
  gates: { bestanden: number; gefallen: number; nicht_pruefbar: number },
  teillauf: boolean,
): { gesamt: number; gemessen: number; anteil: number; messbarGenug: boolean } {
  const gemessen = gates.bestanden + gates.gefallen;
  const gesamt = gemessen + gates.nicht_pruefbar;
  const anteil = gesamt > 0 ? gemessen / gesamt : 0;
  /* Ein leerer Lauf hat nichts zu beurteilen — und ein Teillauf misst absichtlich wenig. */
  const messbarGenug = teillauf || gesamt === 0 || anteil >= MINDESTANTEIL_MESSBAR;
  return { gesamt, gemessen, anteil, messbarGenug };
}
