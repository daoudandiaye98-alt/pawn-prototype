// Was ein Gast gesammelt hat, geht beim Anmelden nicht verloren.
//
// Teil L11. Der Auftrag sagt: „merge_anon_session trägt zusätzlich kunden_stil
// und wishlists". Das geht nicht, und der Grund steht in den Migrationen:
//
//   kunden_stil.user_id  uuid PRIMARY KEY REFERENCES auth.users(id)
//   wishlists.user_id    uuid NOT NULL   REFERENCES auth.users(id)
//   jede Policy: auth.uid() = user_id · nirgends eine session_id-Spalte
//
// Ein Gast hat in beiden Tabellen nie eine Zeile. `merge_anon_session` könnte
// also nur Zeilen zusammenführen, die es nicht geben kann. Was der Gast sammelt,
// liegt im Browser (`store.mjs`) — genau so, wie das Heft es sonst hält:
// anonymes Stöbern wird nicht serverseitig gespeichert.
//
// Die Übergabe gehört deshalb HIERHIN, in den Moment der Anmeldung: das Heft
// schiebt hoch, was es lokal hat. Ohne neue anonyme Schreibrechte auf einer
// Datenbank, die echte Zahlungen trägt.
//
// Diese Datei entscheidet nur — sie ruft nichts. So ist sie ohne Browser und ohne
// Datenbank prüfbar, dasselbe Muster wie `notbetrieb.mjs`.

/**
 * Was beim Anmelden nach oben gehört.
 *
 * @param {{stil?:object, saved?:string[]}} lokal   was im Heft liegt (Gast)
 * @param {{stil?:object, saved?:string[]}} server  was das Konto schon hat
 * @returns {{stil:object|null, merken:string[]}}
 *
 * Zwei Regeln, und beide gehen zugunsten dessen aus, was schon da ist:
 *
 *  1. **Die Linie wird nie überschrieben.** Hat das Konto bereits eine Linie,
 *     bleibt sie. Ein Gast-Durchlauf am fremden Rechner darf die gepflegte Linie
 *     eines Jahres nicht ersetzen.
 *  2. **Die Merkliste wird nur ergänzt, nie gekürzt.** Was der Gast gemerkt hat,
 *     kommt dazu; was im Konto liegt, bleibt. Löschen ist eine Handlung, die ein
 *     Mensch tut — nicht ein Nebeneffekt des Anmeldens.
 */
export function uebernahme(lokal = {}, server = {}) {
  const hatLokal = lokal.stil && Object.keys(lokal.stil).length > 0;
  const hatServer = server.stil && Object.keys(server.stil).length > 0;
  const imKonto = new Set(server.saved || []);
  return {
    stil: hatLokal && !hatServer ? lokal.stil : null,
    merken: (lokal.saved || []).filter((id) => !imKonto.has(id)),
  };
}
