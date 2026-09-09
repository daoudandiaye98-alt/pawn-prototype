/* @vitest-environment node */
/**
 * Die Wache gegen den falschen grünen Haken.
 *
 * **Der belegte Fehler.** Lauf 92 am 08.09.2026 auf PR #182 meldete GRÜN:
 *
 *   Gates: 1 bestanden · 0 gefallen · 1103 nicht prüfbar
 *
 * Auf dem Runner scheiterte die Namensauflösung zu Supabase; jede Seite war
 * eine leere Hülle. Die Hüllen-Regel hat richtig gehandelt — sie wertete
 * nichts. Nur sah „0 gefallen" von EINEM gemessenen Gate im Check genauso aus
 * wie „0 gefallen" von 1104, und der PR wurde auf diesem Haken gemerged.
 *
 * Rot wird untersucht. Grün wird geglaubt. Deshalb ist ein Prüfstand, der grün
 * meldet, ohne gemessen zu haben, schlimmer als einer, der rot meldet.
 *
 * Diese Wache steht auf den echten Zahlen der Läufe 91 und 92 — nicht auf
 * erfundenen. Wer die Schwelle senkt, sieht hier zuerst Rot.
 */
import { describe, it, expect } from "vitest";
import { urteilenOhneMessung } from "../../tools/pruefstand/urteil";
import { MINDESTANTEIL_MESSBAR } from "../../tools/pruefstand/pruefstand.config";

describe("kein Urteil ohne Messung", () => {
  it("Lauf 92 — der falsche grüne Haken, an dem das hier hängt", () => {
    /* Die echten Zahlen aus dem Protokoll von Lauf 92. */
    const u = urteilenOhneMessung({ bestanden: 1, gefallen: 0, nicht_pruefbar: 1103 }, false);
    expect(u.gesamt).toBe(1104);
    expect(u.gemessen).toBe(1);
    expect(u.messbarGenug, "ein Lauf mit 1 von 1104 Gates darf nie als Urteil durchgehen").toBe(false);
  });

  it("Lauf 91 war genauso blind — nur zufällig rot", () => {
    /* Er fiel an genau einem Gate und galt damit als Aussage. War er nicht. */
    const u = urteilenOhneMessung({ bestanden: 1, gefallen: 1, nicht_pruefbar: 1105 }, false);
    expect(u.messbarGenug).toBe(false);
  });

  it("ein echter Lauf urteilt normal — grün wie rot", () => {
    expect(urteilenOhneMessung({ bestanden: 1115, gefallen: 0, nicht_pruefbar: 5 }, false).messbarGenug).toBe(true);
    expect(urteilenOhneMessung({ bestanden: 1099, gefallen: 16, nicht_pruefbar: 5 }, false).messbarGenug).toBe(true);
  });

  it("einzelne Hüllen kippen den Lauf nicht — die Regel fängt den Totalausfall", () => {
    /* Knapp über der Schwelle: noch ein Urteil. Sonst wäre sie zu breit, und
       eine zu breite Prüfung lehrt wieder, Rot zu übersehen. */
    const u = urteilenOhneMessung({ bestanden: 700, gefallen: 0, nicht_pruefbar: 404 }, false);
    expect(u.anteil).toBeGreaterThan(MINDESTANTEIL_MESSBAR);
    expect(u.messbarGenug).toBe(true);
  });

  it("ein Teillauf ist ausgenommen — er misst absichtlich wenig", () => {
    expect(urteilenOhneMessung({ bestanden: 2, gefallen: 0, nicht_pruefbar: 300 }, true).messbarGenug).toBe(true);
  });

  it("ein leerer Lauf hat nichts zu beurteilen und blockiert nicht", () => {
    const u = urteilenOhneMessung({ bestanden: 0, gefallen: 0, nicht_pruefbar: 0 }, false);
    expect(u.gesamt).toBe(0);
    expect(u.messbarGenug).toBe(true);
  });

  it("die Schwelle bleibt eine Zahl in der Konfiguration, nicht im Messcode", () => {
    /* „Keine Zahl ist im Messcode vergraben" — README. */
    expect(MINDESTANTEIL_MESSBAR).toBeGreaterThan(0);
    expect(MINDESTANTEIL_MESSBAR).toBeLessThanOrEqual(1);
  });
});
