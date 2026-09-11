// Vorschau-Betrieb — was geschieht, wenn die Quelle schweigt.
//
// Herausgezogen aus startHeft(), weil die Entscheidung reine Logik ist und das
// Aufstellen ein `document` braucht. So ist sie ohne Browser prüfbar — dasselbe
// Muster wie bei der Prüfstand-Schwelle in tools/pruefstand/urteil.ts. Vorher
// stand die Frist als Promise.race mitten in startHeft() und war nur im Browser
// beobachtbar, also faktisch ungeprüft.
//
// Warum es den Vorschau-Betrieb überhaupt gibt: als das alte Supabase-Projekt
// aus dem DNS verschwand, hing pawn.vision auf dem Ladebild. Eine Beispielausgabe
// mit gesperrtem Kauf ist ehrlicher als eine Seite, die sich nie öffnet.

/** Wie lange das Heft auf die Quelle wartet, bevor es die Beispielausgabe zeigt. */
export const FRIST_MS = 6000;

/**
 * Wählt die Quelle, mit der das Heft aufgestellt wird.
 *
 * @param {{heft:() => Promise<unknown>}} quelle   die gewünschte Quelle (in der Regel Supabase)
 * @param {() => {heft:() => Promise<unknown>}} ersatz  Hersteller der Beispielquelle (demoQuelle)
 * @param {number} [frist]  Millisekunden, die die Quelle Zeit hat
 * @returns {Promise<{quelle:object, heft:unknown, notbetrieb:boolean, fehler:Error|null}>}
 *
 * Antwortet `quelle.heft()` rechtzeitig, kommt sie unverändert zurück. Scheitert
 * sie oder schweigt sie länger als die Frist, kommt die Beispielquelle zurück und
 * `notbetrieb` ist true. Der Grund steht in `fehler` — nie verschluckt.
 *
 * Die Uhr wird in BEIDEN Fällen gestoppt. Sonst hielte ein offener Timer den
 * Node-Prozess am Leben und der Test endete nie.
 */
export async function quelleWaehlen(quelle, ersatz, frist = FRIST_MS) {
  let uhr;
  const aufgeben = new Promise((_, ab) => {
    uhr = setTimeout(() => ab(new Error('Die Quelle hat nicht geantwortet.')), frist);
  });
  try {
    // `.then(…)` statt `quelle.heft()` direkt: so wird auch ein synchroner Wurf
    // zur Absage und landet im catch, statt startHeft() zu sprengen.
    const geladen = Promise.resolve().then(() => quelle.heft());
    const heft = await Promise.race([geladen, aufgeben]);
    clearTimeout(uhr);
    return { quelle, heft, notbetrieb: false, fehler: null };
  } catch (fehler) {
    clearTimeout(uhr);
    const demo = ersatz();
    return { quelle: demo, heft: await demo.heft(), notbetrieb: true, fehler };
  }
}
