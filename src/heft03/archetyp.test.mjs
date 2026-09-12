/**
 * Die Abnahme aus Auftrag O, Block C1 — gegen den ECHTEN Katalog, nicht gegen erfundene
 * Archetypen. Ein Test gegen selbstgebaute Daten prüft nur, ob die Formel sich selbst
 * treu ist; gegen die sechs Mode-Archetypen prüft er, ob sie auf den echten Daten das
 * Erwartete tut.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  archetypFuerGast, punkte, zuversichtAus, belegeAus, werkText, werkTrifft,
  punkteAnzeige, naechsteAlternative, GEWICHT, STUFEN,
} from './archetyp.mjs';
import katalogDatei from './fixtures/archetypen-mode.json' with { type: 'json' };

const KATALOG = katalogDatei.archetypen;

/** Werke in der Form, die adapters.mjs liefert. */
const WOLLMANTEL = { slug: 'wool-coat', name: 'Wool Coat', world: 'mode', material: 'Wolle',
  dna: { mood: ['Klar'], silhouette: ['Gerade'], materials: ['Wolle'], colors: ['Schwarz'], tags: ['mantel'] } };
const DENIM = { slug: 'denim-01', name: 'Denim', world: 'mode', material: 'Denim',
  dna: { mood: ['Roh'], silhouette: ['Gerade'], materials: ['Denim'], colors: ['Indigo'], tags: ['workwear'] } };
const SEIDE = { slug: 'seide-01', name: 'Seidenkleid', world: 'mode', material: 'Seide',
  dna: { mood: ['Weich'], silhouette: ['Weit'], materials: ['Seide'], colors: ['Creme'], tags: [] } };

test('das Quiz allein entscheidet: Klar + Gerade ist die Linie', () => {
  const a = archetypFuerGast(KATALOG, { welt: 'mode', richtung: 'Klar', form: 'Gerade' });
  assert.equal(a.archetyp_key, 'mode_linie');
  // 2,0 für die Richtung + 1,8 für die Form, keine Merkliste.
  assert.equal(a.alternativen[0].score, GEWICHT.richtung + GEWICHT.form);
});

test('dieselbe Richtung, andere Form — der Rahmen statt der Linie', () => {
  // „Klar" trifft sowohl mode_linie als auch mode_rahmen; die Form entscheidet.
  const a = archetypFuerGast(KATALOG, { welt: 'mode', richtung: 'Klar', form: 'Tailliert' });
  // Beide bekommen 2,0 + 1,8. Bei Gleichstand entscheidet der Schlüssel — wie in der RPC
  // (`order by score desc, key`). 'mode_linie' < 'mode_rahmen', also die Linie.
  assert.equal(a.archetyp_key, 'mode_linie');
  assert.equal(a.alternativen[0].score, a.alternativen[1].score, 'hier steht es wirklich gleich');
});

test('gemerkte Werke verschieben das Ergebnis — und zwar gedeckelt', () => {
  // „Laut" traegt im echten Katalog nur mode_signal — ein sauberer Fall ohne Gleichstand.
  const ohne = archetypFuerGast(KATALOG, { welt: 'mode', richtung: 'Laut' });
  assert.equal(ohne.archetyp_key, 'mode_signal');
  assert.equal(ohne.alternativen[0].score, GEWICHT.richtung);
  // Fünf Denim-Stücke auf „Roh": 5 × 0,5 = 2,5, gedeckelt auf 2,0.
  const viele = Array.from({ length: 5 }, () => DENIM);
  const mit = archetypFuerGast(KATALOG, { welt: 'mode', richtung: 'Roh' }, viele);
  assert.equal(mit.alternativen[0].score, GEWICHT.richtung + GEWICHT.werke_max,
    'der Deckel von 2,0 haelt — sonst kauft man sich seinen Archetyp mit Merken');
});

test('GEMESSEN AM ECHTEN KATALOG: „Roh" allein ist zweideutig', () => {
  /*
   * Das stand nicht im Auftrag, es fiel beim Testen auf. Zwei Mode-Archetypen tragen
   * „Roh" in `richtung`: mode_werkzeug (nur Roh) und mode_schicht (Weich UND Roh). Wer
   * im Quiz „Roh" antippt und die Form ueberspringt, bekommt bei BEIDEN 2,0 Punkte.
   *
   * Entschieden wird das wie in der RPC — `order by score desc, key` —, also alphabetisch:
   * mode_schicht gewinnt. Das ist keine Aussage ueber den Stil, sondern eine Muenze, die
   * immer auf dieselbe Seite faellt. Wichtig ist nur, dass sie IMMER auf dieselbe faellt:
   * dieselbe Person darf nicht je nach Laune eine andere Figur bekommen.
   *
   * Die Form loest den Gleichstand auf — und die stellt das Quiz ohnehin als naechstes.
   */
  const nurRichtung = archetypFuerGast(KATALOG, { welt: 'mode', richtung: 'Roh' });
  assert.equal(nurRichtung.archetyp_key, 'mode_schicht', 'alphabetisch, wie die RPC');
  assert.equal(nurRichtung.alternativen[0].score, nurRichtung.alternativen[1].score);
  // Zweimal dieselbe Frage, zweimal dieselbe Antwort.
  assert.equal(archetypFuerGast(KATALOG, { welt: 'mode', richtung: 'Roh' }).archetyp_key, 'mode_schicht');
  // Mit der Form ist es eindeutig.
  assert.equal(archetypFuerGast(KATALOG, { welt: 'mode', richtung: 'Roh', form: 'Lagen' }).archetyp_key, 'mode_schicht');
  assert.equal(archetypFuerGast(KATALOG, { welt: 'mode', richtung: 'Roh', form: 'Weit' }).archetyp_key, 'mode_werkzeug');
});

test('ohne Welt gibt es keinen Archetyp — und keine Behauptung', () => {
  assert.equal(archetypFuerGast(KATALOG, {}), null);
  assert.equal(archetypFuerGast(KATALOG, { richtung: 'Klar' }), null, 'Richtung allein reicht nicht');
  assert.equal(archetypFuerGast([], { welt: 'mode' }), null, 'leerer Katalog: lieber nichts');
  assert.equal(archetypFuerGast(KATALOG, { welt: 'interior' }), null, 'keine Interior-Zeilen in dieser Fixture');
});

test('die Zuversicht folgt der Belegstufe, NIE dem Punktestand', () => {
  // Derselbe Punktestand, zwei Belegstufen — das ist der ganze Punkt.
  const quiz = archetypFuerGast(KATALOG, { welt: 'mode', richtung: 'Klar', form: 'Gerade' });
  assert.equal(quiz.zuversicht, STUFEN.quiz, 'ein perfekter Treffer ist noch kein Wissen');

  assert.equal(zuversichtAus({}), STUFEN.quiz);
  assert.equal(zuversichtAus({ foto: true }), STUFEN.foto);
  assert.equal(zuversichtAus({ merkliste: 2 }), STUFEN.quiz, 'zwei reichen nicht');
  assert.equal(zuversichtAus({ merkliste: 3 }), STUFEN.merkliste);
  assert.equal(zuversichtAus({ anproben: 1 }), STUFEN.anprobe);
  assert.equal(zuversichtAus({ kaeufe: 1 }), STUFEN.kauf);
  assert.equal(zuversichtAus({ bestaetigt: true }), STUFEN.bestaetigt);
  // Aufsteigend, nie absteigend: ein Kauf macht die Zuversicht nicht kleiner, nur weil
  // die Merkliste leer ist.
  assert.equal(zuversichtAus({ kaeufe: 1, merkliste: 0, foto: false }), STUFEN.kauf);
});

test('jeder Beleg kommt aus echten Daten — keiner wird erfunden', () => {
  assert.deepEqual(belegeAus({}), [], 'ohne Quiz kein Beleg');
  const b = belegeAus({ welt: 'mode', richtung: 'Klar', form: 'Gerade' }, [WOLLMANTEL]);
  assert.equal(b.length, 2);
  assert.equal(b[0].art, 'quiz');
  assert.equal(b[0].text, 'mode · Klar · Gerade');
  assert.equal(b[1].text, '1 gemerktes Stück');
  assert.equal(belegeAus({ welt: 'mode' }, [WOLLMANTEL, DENIM])[1].text, '2 gemerkte Stücke');
  // Kein Foto, kein Foto-Beleg.
  assert.ok(!belegeAus({ welt: 'mode' }, []).some((x) => x.art === 'foto'));
  assert.ok(belegeAus({ welt: 'mode' }, [], { foto: true }).some((x) => x.art === 'foto'));
});

test('die Woerter greifen auf denselben Fliesstext wie beratung.mjs', () => {
  assert.equal(werkText(WOLLMANTEL), 'klar gerade wolle schwarz mantel wolle');
  assert.ok(werkTrifft(WOLLMANTEL, ['schwarz']));
  assert.ok(werkTrifft(WOLLMANTEL, ['KLAR']), 'Grossschreibung darf nichts aendern');
  assert.ok(!werkTrifft(WOLLMANTEL, ['denim']));
  assert.ok(!werkTrifft(WOLLMANTEL, []), 'ohne Woerter kein Treffer');
  assert.equal(werkText({}), '', 'ein leeres Werk wirft nicht — es ist nur leer');
  assert.equal(werkText(null), '', 'und null auch nicht');
});

test('Zuversicht wird als Punkte gezeigt, nie als Prozentwert', () => {
  // Drei bis fünf gefüllte Punkte (Auftrag O, C2) — niemals „55 %".
  for (const z of [0.4, 0.55, 0.7, 0.75, 0.85, 1.0]) {
    const p = punkteAnzeige(z);
    assert.equal(p.gesamt, 5);
    assert.ok(p.voll >= 3 && p.voll <= 5, `${z} ergibt ${p.voll} Punkte`);
  }
  assert.equal(punkteAnzeige(0.4).voll, 3);
  assert.equal(punkteAnzeige(1).voll, 5);
});

test('„Eher nicht" rueckt die naechste Alternative nach', () => {
  const alt = [{ key: 'mode_linie' }, { key: 'mode_rahmen' }, { key: 'mode_werkzeug' }];
  assert.equal(naechsteAlternative(alt, ['mode_linie']), 'mode_rahmen');
  assert.equal(naechsteAlternative(alt, ['mode_linie', 'mode_rahmen']), 'mode_werkzeug');
  assert.equal(naechsteAlternative(alt, ['mode_linie', 'mode_rahmen', 'mode_werkzeug']), null,
    'sind alle abgelehnt, wird nichts mehr behauptet');
  assert.equal(naechsteAlternative([], []), null);
  assert.equal(naechsteAlternative(['a', 'b'], ['a']), 'b', 'auch als blosse Schluesselliste');
});

test('die Gewichte stehen so im Auftrag und so in der RPC', () => {
  assert.deepEqual(GEWICHT, { richtung: 2.0, form: 1.8, je_werk: 0.5, werke_max: 2.0 });
  assert.equal(punkte(KATALOG[0], { welt: 'mode', richtung: 'Klar' }), 2.0);
  assert.equal(punkte(KATALOG[0], { welt: 'mode', form: 'Gerade' }), 1.8);
  assert.equal(punkte(KATALOG[0], {}, [WOLLMANTEL]), 0.5);
  assert.equal(punkte(KATALOG[0], {}, [SEIDE]), 0, 'Seide traegt kein Wort der Linie');
});

/**
 * Die Figuren des Katalogs — aus dem QUELLTEXT von extra-views.mjs gelesen.
 *
 * DER STILLE FEHLER, gegen den das steht: die Archetypen-Karte zeichnet `archetyp.figur`.
 * Kennt extra-views.mjs die Figur nicht, faellt sie stillschweigend auf den Bauern
 * zurueck — und drei der 18 Archetypen (figur='koenig') zeigen dann die falsche Figur,
 * ohne dass irgendetwas rot wird. Genau so lag es, bis der Koenig dazukam.
 */
function figurenAusDemCode() {
  const quelle = readFileSync(new URL('./extra-views.mjs', import.meta.url), 'utf8');
  const block = quelle.slice(quelle.indexOf('export const RANG_PFADE'), quelle.indexOf('const RANG_AUGEN'));
  return [...block.matchAll(/^\s*([a-z]+)\s*:/gm)].map((m) => m[1]).sort();
}

test('jede Figur des Archetypen-Katalogs ist auch gezeichnet', () => {
  // Gemessen am 12.09.2026: turm 6x, dame 3x, koenig 3x, laeufer 3x, springer 3x.
  // KEIN bauer im Katalog — aber er bleibt, weil die Rangleiter ihn braucht.
  const imKatalog = ['dame', 'koenig', 'laeufer', 'springer', 'turm'];
  const gezeichnet = new Set(figurenAusDemCode());
  const fehlt = imKatalog.filter((f) => !gezeichnet.has(f));
  assert.deepEqual(fehlt, [], 'diese Archetypen zeigten sonst stumm die falsche Figur');
  // Und die Fixture darf nicht von der Wirklichkeit abdriften.
  for (const a of KATALOG) assert.ok(gezeichnet.has(a.figur), a.key + ' traegt ' + a.figur);
});
