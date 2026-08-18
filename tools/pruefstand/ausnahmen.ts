/**
 * Das maschinenlesbare Register der dokumentierten Ausnahmen.
 *
 * **Warum es das neben dem README gibt.** `tools/pruefstand/README.md` erzählt
 * jede Ausnahme vollständig (ZERA-QA 06: Sache, Grund, Verantwortlich, Termin,
 * Betroffen) — aber der Lauf kann Prosa nicht prüfen. Diese Datei trägt nur,
 * was der Rückgabewert braucht: WELCHE Kontrolle entschuldigt ist und BIS WANN.
 * Die Erzählung bleibt im README; wer eine Zeile hier ändert, ändert dort mit.
 *
 * **Die Regel** (entschieden 18.08.2026): eine dokumentierte Ausnahme zählt
 * nicht in den Rückgabewert — der Check bleibt grün und die Ausnahme steht
 * sichtbar in der Statuszeile. ABER: der Termin ist ein Wecker, kein Kommentar.
 * Ist er verstrichen, zählt das Gate wieder als gefallen, und der Check wird
 * rot — nicht weil sich die Seite verschlechtert hätte, sondern weil die
 * Entscheidung abgelaufen ist. Verlängern geht nur hier, als bewusste Änderung
 * mit Commit, nicht durch Wegsehen.
 *
 * Eine erledigte Ausnahme wird hier GELÖSCHT (das Gate besteht dann ohnehin);
 * im README bleibt sie mit Datum als Protokoll stehen.
 */
export interface Ausnahme {
  /** Die Kontrolle, deren gefallene Befunde entschuldigt sind (z. B. "4.5"). */
  kontrolle: string;
  /** Wofür die Ausnahme steht — der Name aus dem README. */
  name: string;
  /** Der Termin als Meilenstein, so wie er im README steht. */
  termin: string;
  /**
   * Der Wecker: bis zu diesem Tag (einschließlich, UTC) gilt die Ausnahme.
   * Danach fällt das Gate wieder. ISO-Datum, damit der Lauf rechnen kann —
   * ein Meilenstein ohne Datum wäre ein Kommentar, kein Wecker.
   */
  wecker: string;
}

export const AUSNAHMEN: Ausnahme[] = [
  {
    kontrolle: "4.5",
    name: "K7 · erfundene Adressen antworten mit 200",
    termin: "X11 — Vorrendern der bekannten Routen löst die Statusfrage strukturell",
    /* Gesetzt am 18.08.2026, Reihenfolge: Q4b → X8 → X1+X11. Zwei Wochen. */
    wecker: "2026-09-01",
  },
];

/** Die Ausnahme zu einem Befund — oder null, wenn keine greift. */
export function ausnahmeFuer(kontrolle: string, heute: string): Ausnahme | null {
  return AUSNAHMEN.find((a) => a.kontrolle === kontrolle && heute <= a.wecker) ?? null;
}

/** Die Ausnahmen, deren Wecker verstrichen ist — sie entschuldigen nichts mehr. */
export function abgelaufen(heute: string): Ausnahme[] {
  return AUSNAHMEN.filter((a) => heute > a.wecker);
}
