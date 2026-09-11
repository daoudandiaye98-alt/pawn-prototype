// Vorschau-Betrieb — was geschieht, wenn die Quelle schweigt.
//
// Herausgezogen aus startHeft(), weil die Entscheidung reine Logik ist und das
// Aufstellen ein `document` braucht. So ist sie ohne Browser prüfbar — dasselbe
// Muster wie bei der Prüfstand-Schwelle in tools/pruefstand/urteil.ts.
//
// Warum es den Vorschau-Betrieb überhaupt gibt: als das alte Supabase-Projekt
// aus dem DNS verschwand, hing pawn.vision auf dem Ladebild. Eine Beispielausgabe
// mit gesperrtem Kauf ist ehrlicher als eine Seite, die sich nie öffnet.
//
// ——— Was sich mit Teil L13 geändert hat ———————————————————————————————
// Vorher entschied allein eine Frist von 6 Sekunden. Das war falsch herum: eine
// langsame, aber lebende Datenbank landete in der Beispielausgabe, und eine
// erreichbare Datenbank mit fehlender Tabelle ebenso — dann standen Beispiel-
// häuser da, wo die Wahrheit „noch nichts da" gewesen wäre.
//
// Jetzt wird gefragt statt gewartet: einmal an `/auth/v1/health` anklopfen.
//   · Netzwerkfehler (kein DNS, kein Netz, keine Antwort) → sofort Vorschau.
//   · JEDE HTTP-Antwort, auch 401 oder 404 → die Datenbank lebt, nie Vorschau.
// Die Frist bleibt als letzte Rettung gegen eine hängende Antwort, aber hoch.
// Ein Fehler der Datenabfrage selbst — fehlende Tabelle, fehlende Sicht, fehlende
// Spalte — führt NIE in die Beispielausgabe, sondern in ein ehrlich leeres Heft.

/** Letzte Rettung gegen eine Quelle, die nie antwortet. Kein Urteil über Geschwindigkeit. */
export const FRIST_MS = 30000;

/** Wie lange das Anklopfen selbst dauern darf, bevor es als „kein Netz" gilt. */
export const ANKLOPF_FRIST_MS = 4000;

/** Ein Heft ohne Häuser. Nicht leer im Sinne von kaputt — leer im Sinne von ehrlich. */
export const leeresHeft = () => ({ products: {}, houses: {}, media: {}, kuration: { slugs: [], title: '' } });

/**
 * Klopft einmal an der Datenbank an.
 *
 * @param {string} basis  die Supabase-Adresse, z. B. https://xyz.supabase.co
 * @param {{fetch?:Function, frist?:number}} [optionen]
 * @returns {Promise<{erreichbar:boolean|null, grund:Error|null}>}
 *
 * `erreichbar === null` heißt: es wurde nicht angeklopft (keine Adresse, kein
 * `fetch`). Dann entscheidet wie früher allein die Frist.
 *
 * Die Anfrage läuft mit `mode:'no-cors'`. Wir wollen den Inhalt nicht lesen,
 * nur wissen, ob überhaupt jemand antwortet — und eine abgelehnte CORS-Regel
 * ist von einem echten Netzwerkfehler sonst nicht zu unterscheiden. Eine
 * undurchsichtige Antwort ist Antwort genug: der Server lebt.
 */
export async function anklopfen(basis, optionen = {}) {
  const hol = optionen.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!basis || typeof basis !== 'string' || !hol) return { erreichbar: null, grund: null };

  const frist = optionen.frist ?? ANKLOPF_FRIST_MS;
  const adresse = basis.replace(/\/+$/, '') + '/auth/v1/health';

  let uhr;
  const abbruch = typeof AbortController === 'function' ? new AbortController() : null;
  try {
    if (abbruch) uhr = setTimeout(() => abbruch.abort(), frist);
    await hol(adresse, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      ...(abbruch ? { signal: abbruch.signal } : {}),
    });
    return { erreichbar: true, grund: null };
  } catch (grund) {
    // Auch ein Abbruch nach der Frist zählt hier als „keine Antwort". Eine
    // Datenbank, deren Anmeldedienst vier Sekunden schweigt, ist für den
    // Besucher so gut wie weg.
    return { erreichbar: false, grund };
  } finally {
    clearTimeout(uhr);
  }
}

/**
 * Wählt die Quelle, mit der das Heft aufgestellt wird.
 *
 * @param {{heft:() => Promise<unknown>}} quelle   die gewünschte Quelle (in der Regel Supabase)
 * @param {() => {heft:() => Promise<unknown>}} ersatz  Hersteller der Beispielquelle (demoQuelle)
 * @param {number|{frist?:number, anklopfen?:{erreichbar:boolean|null, grund:Error|null}}} [optionen]
 *        Eine Zahl ist die Frist (alte Aufrufform, weiter gültig).
 * @returns {Promise<{quelle:object, heft:unknown, notbetrieb:boolean, leer:boolean, fehler:Error|null}>}
 *
 * Drei Ausgänge:
 *   notbetrieb:false, leer:false — die Quelle hat geantwortet, alles normal.
 *   notbetrieb:true             — die Datenbank ist weg. Beispielausgabe, Kauf gesperrt.
 *   leer:true                   — die Datenbank lebt, aber die Daten kamen nicht.
 *                                 Ehrlich leeres Heft, NIE Beispieldaten.
 *
 * Die Uhr wird in JEDEM Fall gestoppt. Sonst hielte ein offener Timer den
 * Node-Prozess am Leben und der Test endete nie.
 */
export async function quelleWaehlen(quelle, ersatz, optionen = {}) {
  const o = typeof optionen === 'number' ? { frist: optionen } : (optionen || {});
  const frist = o.frist ?? FRIST_MS;
  const erreichbar = o.anklopfen ? o.anklopfen.erreichbar : null;

  // Es wurde angeklopft und niemand hat geöffnet: gar nicht erst warten.
  if (erreichbar === false) {
    const demo = ersatz();
    const grund = o.anklopfen.grund || new Error('Die Datenbank hat auf das Anklopfen nicht geantwortet.');
    return { quelle: demo, heft: await demo.heft(), notbetrieb: true, leer: false, fehler: grund };
  }

  let uhr;
  const aufgeben = new Promise((_, ab) => {
    uhr = setTimeout(() => ab(Object.assign(new Error('Die Quelle hat nicht geantwortet.'), { art: 'frist' })), frist);
  });
  try {
    // `.then(…)` statt `quelle.heft()` direkt: so wird auch ein synchroner Wurf
    // zur Absage und landet im catch, statt startHeft() zu sprengen.
    const geladen = Promise.resolve().then(() => quelle.heft());
    const heft = await Promise.race([geladen, aufgeben]);
    clearTimeout(uhr);
    return { quelle, heft, notbetrieb: false, leer: false, fehler: null };
  } catch (fehler) {
    clearTimeout(uhr);
    // Angeklopft, es wurde geöffnet — und trotzdem kommen keine Daten. Das ist
    // eine fehlende Tabelle, eine fehlende Sicht, eine fehlende Spalte. Kein
    // Grund für Beispielhäuser: das Heft bleibt echt und zeigt, dass nichts da ist.
    if (erreichbar === true && fehler?.art !== 'frist') {
      return { quelle, heft: leeresHeft(), notbetrieb: false, leer: true, fehler };
    }
    const demo = ersatz();
    return { quelle: demo, heft: await demo.heft(), notbetrieb: true, leer: false, fehler };
  }
}
