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
  /*
   * Zurzeit keine — und das ist das Ergebnis einer Messung, kein Aufräumen.
   *
   * Hier stand die Ausnahme "4.5 · K7 · erfundene Adressen antworten mit 200"
   * mit Wecker 2026-09-01. Am 08.09.2026 wurde der Test ausgeführt, den das
   * README seit dem 18.08. als offenen Punkt führte, auf der ungesperrten
   * Produktion:
   *
   *   curl -I https://pawn.vision/diese-seite-gibt-es-nicht-4d9f21
   *   HTTP/2 404 · x-pawn-404: vercel-json
   *
   * Das Gate besteht. Die Ausnahme ist damit erledigt und wird gelöscht, wie es
   * der Kopf dieser Datei verlangt; als Protokoll steht sie mit Datum im README,
   * Abschnitt K7. Was sie entschuldigte, war nie ein Fehler im Code, sondern die
   * Unfähigkeit der gesperrten Vorschau, ihn zu messen — dafür ist `lauf.ts` jetzt
   * zuständig, das 4.5 hinter der Sperre als `nicht_pruefbar` führt.
   */
];

/** Die Ausnahme zu einem Befund — oder null, wenn keine greift. */
export function ausnahmeFuer(kontrolle: string, heute: string): Ausnahme | null {
  return AUSNAHMEN.find((a) => a.kontrolle === kontrolle && heute <= a.wecker) ?? null;
}

/** Die Ausnahmen, deren Wecker verstrichen ist — sie entschuldigen nichts mehr. */
export function abgelaufen(heute: string): Ausnahme[] {
  return AUSNAHMEN.filter((a) => heute > a.wecker);
}
