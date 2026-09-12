/**
 * Die Abnahme aus Auftrag O, Block A — als Code statt als Satz.
 *
 * Jeder Test hier steht für eine Zeile unter „Abnahme · Begleiter". Die Uhr wird
 * gedreht statt abgewartet: `uhr` ist eine Zahl, keine Wanduhr. Deshalb prüft diese
 * Datei in Millisekunden, was im Heft Minuten dauert.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  erschaffeBegleiter, gedaechtnisAus, fuelle, platzhalterIn,
  bedingungTrifft, merkSchluessel, waehleVariante, STARKE_EREIGNISSE,
} from './begleiter.mjs';
import katalog from './fixtures/begleiter-katalog.json' with { type: 'json' };

/** Ein kleiner Katalog in der Form, die die Datenbank liefert. */
const SAETZE = [
  { key: 'empfang', varianten: { de: ['Ich bin PAWN.', 'Willkommen.'] } },
  { key: 'werk', platzhalter: ['werk', 'ort'], varianten: { de: ['{werk} aus {ort}.'] } },
  { key: 'merk1', varianten: { de: ['Das erste Stück.'] } },
  { key: 'still', varianten: { de: ['Noch da?'] } },
];
const REGELN = [
  { key: 'heft.empfang', flaeche: 'heft', ereignis: 'betreten', bedingung: { besuch: 'erster' },
    satz_key: 'empfang', aktion: { art: 'sagen' }, prioritaet: 100, einmal: 'immer' },
  { key: 'heft.verweilen.werk', flaeche: 'heft', ereignis: 'verweilen', bedingung: { min_ms: 3000 },
    satz_key: 'werk', aktion: { art: 'sagen' }, prioritaet: 50, notiz: 'je Werk' },
  { key: 'heft.merken.erstes', flaeche: 'heft', ereignis: 'merken', bedingung: { merkliste_eq: 1 },
    satz_key: 'merk1', aktion: { art: 'sagen' }, prioritaet: 85, einmal: 'sitzung' },
  { key: 'heft.stillstand', flaeche: 'heft', ereignis: 'stillstand', bedingung: {},
    satz_key: 'still', aktion: { art: 'sagen' }, prioritaet: 10 },
  { key: 'studio.fremd', flaeche: 'studio', ereignis: 'betreten', bedingung: {},
    satz_key: 'empfang', aktion: { art: 'sagen' }, prioritaet: 999 },
];

function bauen(extra = {}) {
  let uhr = 1_000_000;
  const b = erschaffeBegleiter({
    saetze: SAETZE, regeln: REGELN, flaeche: 'heft',
    jetzt: () => uhr, zufall: () => 0,
    gedaechtnis: gedaechtnisAus(extra.gedaechtnis || {}),
    grenzen: extra.grenzen,
  });
  return { b, vor: (ms) => { uhr += ms; }, uhrJetzt: () => uhr };
}

test('erster Besuch: genau eine Blase, nicht zwei', () => {
  const { b } = bauen();
  const eins = b.melde('betreten', {}, { besuch: 'erster' });
  assert.ok(eins, 'der Empfang kommt');
  assert.equal(eins.text, 'Ich bin PAWN.');
  // Ein zweites `betreten` sofort danach schweigt — `einmal: immer`.
  assert.equal(b.melde('betreten', {}, { besuch: 'erster' }), null);
});

test('der Mindestabstand hält den Mund', () => {
  const { b, vor } = bauen();
  assert.ok(b.melde('betreten', {}, { besuch: 'erster' }));
  // Stillstand ist kein starkes Ereignis — 25 s Abstand gelten.
  assert.equal(b.melde('stillstand', {}, {}), null, 'zu früh');
  vor(24_000);
  assert.equal(b.melde('stillstand', {}, {}), null, 'immer noch zu früh');
  vor(2_000);
  assert.ok(b.melde('stillstand', {}, {}), 'nach 26 s darf er');
});

test('das Ehrlichkeitsgesetz: fehlt ein Platzhalter, fällt der Satz aus', () => {
  const { b, vor } = bauen();
  vor(30_000);
  // Werk ohne Ort → der Satz kann nicht gefüllt werden → keine Blase.
  const ohne = b.melde('verweilen', { ms: 5000, werk_id: 'w1' }, { werte: { werk: 'Wool Coat' } });
  assert.equal(ohne, null, 'kein erfundener Ort');
  vor(30_000);
  const mit = b.melde('verweilen', { ms: 5000, werk_id: 'w2' }, { werte: { werk: 'Wool Coat', ort: 'Berlin' } });
  assert.equal(mit.text, 'Wool Coat aus Berlin.');
});

test('das × schweigt 90 s und den Schlüssel für immer', () => {
  const { b, vor } = bauen();
  const blase = b.melde('betreten', {}, { besuch: 'erster' });
  b.ablehnen(blase.key);
  vor(60_000);
  assert.equal(b.melde('stillstand', {}, {}), null, 'in den 90 s gar nichts');
  vor(40_000);
  assert.ok(b.melde('stillstand', {}, {}), 'danach wieder');
  // Der abgelehnte Schlüssel bleibt weg, auch mit frischem Gedächtnis-Stand.
  const zweite = bauen({ gedaechtnis: { abgelehnt: ['heft.empfang'] } });
  assert.equal(zweite.b.melde('betreten', {}, { besuch: 'erster' }), null);
});

test('nach acht ungefragten Blasen nur noch starke Ereignisse', () => {
  const { b, vor } = bauen();
  for (let i = 0; i < 8; i++) { vor(30_000); assert.ok(b.melde('stillstand', {}, {}), `Blase ${i + 1}`); }
  vor(30_000);
  assert.equal(b.melde('stillstand', {}, {}), null, 'das Budget ist aufgebraucht');
  // `merken` ist stark — es ist eine Antwort auf etwas, das die Person getan hat.
  assert.ok(STARKE_EREIGNISSE.has('merken'));
  assert.ok(b.melde('merken', {}, { merkliste: 1 }), 'starke Ereignisse dürfen weiter');
});

test('stumm, solange Chat, Drawer, Dreh-Hinweis oder Kasse im Weg sind', () => {
  const { b, vor } = bauen();
  vor(30_000);
  assert.equal(b.melde('stillstand', {}, { stumm: true }), null);
  assert.ok(b.melde('stillstand', {}, { stumm: false }));
});

test('je Werk heisst je Werk — derselbe Satz über ein anderes Stueck ist neu', () => {
  const regel = { key: 'heft.verweilen.werk', notiz: 'je Werk' };
  assert.equal(merkSchluessel(regel, { werk_id: 'a' }), 'heft.verweilen.werk#a');
  assert.equal(merkSchluessel(regel, { werk_id: 'b' }), 'heft.verweilen.werk#b');
  assert.equal(merkSchluessel({ key: 'x' }, { werk_id: 'a' }), 'x');
});

test('Regeln der anderen Flaeche gelten nie, auch mit Prioritaet 999', () => {
  const { b } = bauen();
  const blase = b.melde('betreten', {}, { besuch: 'erster' });
  assert.equal(blase.regel_key, 'heft.empfang', 'die Studio-Regel bleibt draussen');
});

test('ein unbekannter Bedingungsschluessel laesst die Regel schweigen', () => {
  // Eine neue Regel mit einem Schlüssel, den dieser Code nicht kennt, darf NICHT
  // einfach durchrutschen — sonst redet der Bauer bei jedem Ereignis.
  assert.equal(bedingungTrifft({ voellig_neu: true }, {}, {}), false);
  assert.equal(bedingungTrifft({}, {}, {}), true);
  assert.equal(bedingungTrifft({ merkliste_min: 2 }, { merkliste: 3 }, {}), true);
  assert.equal(bedingungTrifft({ merkliste_min: 2 }, { merkliste: 1 }, {}), false);
  assert.equal(bedingungTrifft({ konto: true }, { konto: null }, {}), false);
});

test('die Stimme wiederholt sich nicht unmittelbar', () => {
  const varianten = { de: ['A', 'B', 'C'] };
  const erste = waehleVariante(varianten, 'de', undefined, () => 0);
  assert.equal(erste.text, 'A');
  const zweite = waehleVariante(varianten, 'de', 0, () => 0);
  assert.notEqual(zweite.index, 0, 'nie zweimal hintereinander dieselbe');
  // Eine einzige Fassung darf sich wiederholen — es gibt nichts zu wechseln.
  assert.equal(waehleVariante({ de: ['nur eine'] }, 'de', 0, () => 0).text, 'nur eine');
  assert.equal(waehleVariante({ de: [] }, 'de', undefined, () => 0), null);
});

test('Platzhalter und Fuellen', () => {
  assert.deepEqual(platzhalterIn('{werk}: {material}, von {haus}'), ['werk', 'material', 'haus']);
  assert.equal(fuelle('{a}-{b}', { a: '1', b: '2' }), '1-2');
  assert.equal(fuelle('{a}', { a: '' }), null, 'leer zaehlt als fehlend');
  assert.equal(fuelle('{a}', {}), null);
  assert.equal(fuelle('ohne', {}), 'ohne');
});

test('Rangaufstieg meldet sich, Rangverlust nicht', () => {
  const { b } = bauen({ gedaechtnis: { rang: 'springer' } });
  assert.equal(b.rangGewechselt('springer'), null, 'gleich bleibt still');
  assert.equal(b.rangGewechselt('bauer'), null, 'abwaerts meldet nichts');
  const auf = b.rangGewechselt('turm');
  assert.deepEqual(auf, { von: 'bauer', nach: 'turm' });
});

test('die Aktion der Regel reist mit', () => {
  const { b } = bauen();
  const blase = b.melde('betreten', {}, { besuch: 'erster' });
  assert.deepEqual(blase.aktion, { art: 'sagen' });
  assert.equal(blase.satz_key, 'empfang');
});

/**
 * Die Schlüssel, die bedingungTrifft() wirklich behandelt — aus dem QUELLTEXT gelesen,
 * nicht aus einer zweiten Liste.
 *
 * WARUM AUS DER DATEI: mein erster Versuch verglich eine handgepflegte Liste im Test
 * gegen die Fixture. Beide stimmten, der Code aber nicht — ich hatte zum Rotvorführen
 * eine `case`-Zeile entfernt, und der Test blieb grün. Ein Test, der zwei Listen
 * vergleicht und den Code auslässt, prüft nichts.
 */
function schluesselAusDemCode() {
  const quelle = readFileSync(new URL('./begleiter.mjs', import.meta.url), 'utf8');
  const block = quelle.slice(quelle.indexOf('export function bedingungTrifft'),
                             quelle.indexOf('export function merkSchluessel'));
  return [...block.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]).sort();
}

test('der Code versteht jeden Bedingungsschluessel des echten Katalogs', () => {
  /*
   * DER STILLE FEHLER, gegen den das hier steht: bedingungTrifft() gibt bei einem
   * unbekannten Schlüssel `false` zurück — die Regel schweigt dann für immer, ohne
   * dass irgendetwas rot wird. Legt jemand in der Datenbank eine Regel mit einem
   * neuen Schlüssel an, sagt der Bauer dazu nie etwas, und niemand merkt es.
   *
   * fixtures/begleiter-katalog.json trägt die 15 Schlüssel, die am 12.09.2026 auf
   * der Live-Datenbank wirklich vorkommen.
   */
  assert.deepEqual(schluesselAusDemCode(), [...katalog.bedingungsschluessel].sort(),
    'weder ein Schluessel im Katalog ohne case im Code noch einer im Code ohne Katalog');
});

/**
 * Die Ereignisse, die app.js WIRKLICH meldet — aus dem Quelltext gelesen.
 *
 * DER STILLE FEHLER dahinter: eine Regel im Katalog haengt an einem Ereignis. Meldet
 * app.js dieses Ereignis nie, feuert die Regel nie — und nichts wird rot. Die Regel
 * liegt dann als Karteileiche in der Datenbank, und niemand merkt es.
 */
function ereignisseAusAppJs() {
  const quelle = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  return [...new Set([...quelle.matchAll(/melden\('([a-z_]+)'/g)].map((m) => m[1]))].sort();
}

test('jedes Ereignis des Katalogs wird auch gemeldet — ausser denen spaeterer Bloecke', () => {
  const gemeldet = new Set(ereignisseAusAppJs());
  // Diese zwei entstehen erst mit Block C (Archetyp) und Block D (Anprobe). Steht der
  // Block, faellt der Name hier raus und der Test verlangt die Verdrahtung.
  const spaeter = new Set(['archetyp_bestaetigt', 'anprobe_fertig']);
  const fehlt = katalog.ereignisse.filter((e) => !gemeldet.has(e) && !spaeter.has(e));
  assert.deepEqual(fehlt, [], 'Regeln zu diesen Ereignissen koennten nie feuern');
  // Und umgekehrt: was gemeldet wird, sollte der Katalog kennen — sonst redet der Code
  // ins Leere. `blaettern` ist die eine bekannte Ausnahme (Auftrag O A2 nennt es, der
  // Katalog hat dazu keine Regel).
  const unbekannt = [...gemeldet].filter((e) => !katalog.ereignisse.includes(e) && e !== 'blaettern');
  assert.deepEqual(unbekannt, [], 'gemeldet, aber im Katalog unbekannt');
});

test('jede Aktionsart des Katalogs hat eine Hand', () => {
  // Die vier Arten aus Auftrag O, A1 "Hände". Mehr gibt es nicht, weniger auch nicht.
  assert.deepEqual([...katalog.aktionsarten].sort(), ['anbieten', 'fuehren', 'oeffnen', 'sagen']);
});
