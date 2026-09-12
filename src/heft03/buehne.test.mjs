import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  BUEHNE, buehneX, buehneZ, EBENE_ZWEI, WERKE_MINDESTENS,
  ebeneVon, klemmeStueck, klemmeDeko, fehltZumVeroeffentlichen,
} from './buehne.mjs';

/*
 * Die Zahlen in diesen Tests sind KEINE Wunschwerte. Sie stehen so in
 * world.mjs:208 und sind die Stellen, an denen die drei Werke heute stehen.
 * Ein Test, der die Abbildung gegen sich selbst prüft, prüft nichts.
 */
const HEUTE_X = [-1.95, 0.15, 2.05];
const HEUTE_Z = [0.60, 0.30, 0.62];

test('die Breite bildet die heutigen drei x-Stellen ab', () => {
  // Rückwärts: welches normalisierte x ergibt die heutige Welt-Stelle?
  const norm = HEUTE_X.map((welt) => 0.5 + welt / BUEHNE.breite);
  norm.forEach((x, i) => {
    assert.ok(x >= 0 && x <= 1, `x ${x} liegt außerhalb des Feldes`);
    assert.ok(Math.abs(buehneX(x) - HEUTE_X[i]) < 0.001,
      `x ${x} ergibt ${buehneX(x)}, erwartet ${HEUTE_X[i]}`);
  });
});

test('die Tiefe legt die Ebene 2 auf die heutigen Werk-Stellen', () => {
  // Die Spanne, die der Trigger erzwingt, muss die heutige Spanne treffen.
  const vorn = Math.max(...HEUTE_Z), hinten = Math.min(...HEUTE_Z);
  assert.ok(Math.abs(buehneZ(EBENE_ZWEI.von) - hinten) < 0.01,
    `z ${EBENE_ZWEI.von} ergibt ${buehneZ(EBENE_ZWEI.von)}, erwartet ${hinten}`);
  assert.ok(Math.abs(buehneZ(EBENE_ZWEI.bis) - vorn) < 0.01,
    `z ${EBENE_ZWEI.bis} ergibt ${buehneZ(EBENE_ZWEI.bis)}, erwartet ${vorn}`);
});

test('die Vorgabe aus dem Auftrag haette die Buehne verschoben', () => {
  // Festgehalten, damit die verworfene Fassung nicht zurueckkommt: z0 -1.35
  // mit Tiefe 2.4 legt die Werke rund 0,6 Einheiten hinter ihre heutige Stelle.
  const vorgabe = (z) => -1.35 + z * 2.4;
  const abstand = Math.min(...HEUTE_Z) - vorgabe(EBENE_ZWEI.von);
  assert.ok(abstand > 0.5,
    `die Vorgabe laege nur ${abstand.toFixed(2)} daneben — dann waere die Berichtigung unnoetig`);
});

test('die drei Ebenen greifen an den Grenzen des Triggers', () => {
  assert.equal(ebeneVon(0.34), 1);
  assert.equal(ebeneVon(EBENE_ZWEI.von), 2, 'die untere Grenze gehoert zur Ebene 2');
  assert.equal(ebeneVon(0.5), 2);
  assert.equal(ebeneVon(EBENE_ZWEI.bis), 2, 'die obere Grenze gehoert zur Ebene 2');
  assert.equal(ebeneVon(0.66), 3);
});

test('die Klemme haelt ein Werk auf der Ebene 2 und federt nicht zurueck', () => {
  assert.equal(klemmeStueck({x: 0.5, z: 0.2}).z, EBENE_ZWEI.von);
  assert.equal(klemmeStueck({x: 0.5, z: 0.9}).z, EBENE_ZWEI.bis);
  assert.equal(klemmeStueck({x: -3, z: 0.5}).x, 0);
  assert.equal(klemmeStueck({x: 7, z: 0.5}).x, 1);
  // Was innerhalb liegt, wird nicht angefasst.
  const frei = {x: 0.42, z: 0.51, werk_id: 'a'};
  assert.deepEqual(klemmeStueck(frei), frei);
});

test('Deko landet nie auf der Ebene der Werke', () => {
  assert.notEqual(ebeneVon(klemmeDeko({x: .5, z: .5}, 'hinten').z), 2);
  assert.notEqual(ebeneVon(klemmeDeko({x: .5, z: .5}, 'vorn').z), 2);
  assert.equal(ebeneVon(klemmeDeko({x: .5, z: .1}, 'hinten').z), 1);
  assert.equal(ebeneVon(klemmeDeko({x: .5, z: .95}, 'vorn').z), 3);
});

test('was dem Veroeffentlichen fehlt, steht VOR dem Datenbankfehler da', () => {
  assert.deepEqual(fehltZumVeroeffentlichen({stuecke: []}),
    ['noch 3 Werke bis zum Veröffentlichen']);
  // Der heutige Bestand: drape hat je Welt EIN Werk.
  assert.deepEqual(fehltZumVeroeffentlichen({stuecke: [{x: .5, z: .5}]}),
    ['noch 2 Werke bis zum Veröffentlichen']);
  assert.deepEqual(fehltZumVeroeffentlichen({stuecke: [{x: .5, z: .5}, {x: .2, z: .5}]}),
    ['noch 1 Werk bis zum Veröffentlichen']);
  const drei = [{x: .2, z: .5}, {x: .5, z: .5}, {x: .8, z: .5}];
  assert.deepEqual(fehltZumVeroeffentlichen({stuecke: drei}), []);
  assert.equal(WERKE_MINDESTENS, 3);
});

test('ein Werk neben der Ebene wird eigens genannt, nicht nur gezaehlt', () => {
  const gruende = fehltZumVeroeffentlichen({
    stuecke: [{x: .2, z: .5}, {x: .5, z: .5}, {x: .8, z: .9}],
  });
  assert.deepEqual(gruende, ['ein Werk liegt nicht auf der mittleren Ebene']);
});
