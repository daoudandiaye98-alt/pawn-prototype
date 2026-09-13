import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUEHNE, buehneX, buehneZ, EBENE_ZWEI, WERKE_MINDESTENS, ebeneVon, klemmeStueck, klemmeDeko, fehltZumVeroeffentlichen, platzFuer, schreibEntwurf, nachDemZiehen, dekoNachEbenen, ausBuehneX, ausBuehneZ, HOEHE, mitHoehe, geliehenerAufsteller} from './buehne.mjs';

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

test('platzFuer reproduziert die heutige Buehne Stelle fuer Stelle', () => {
  /*
   * Der eigentliche Beweis fuer B1: eine Buehne, aus den heutigen Zahlen
   * zurueckgerechnet, muss durch makeBuehne wieder GENAU dort landen, wo
   * makeStage sie hinstellt. Die Erwartungswerte stammen aus world.mjs:208,
   * nicht aus dieser Datei.
   */
  const zurueck = (welt, achse) => achse === 'x'
    ? 0.5 + welt / BUEHNE.breite
    : (welt - BUEHNE.z0) / BUEHNE.tiefe;

  HEUTE_X.forEach((wx, i) => {
    const wz = HEUTE_Z[i];
    const stueck = {werk_id: 'w' + i, x: zurueck(wx, 'x'), z: zurueck(wz, 'z')};
    const platz = platzFuer(stueck, {stage: {lift: 0.17, h: 2.9}});
    assert.ok(Math.abs(platz.x - wx) < 0.001, `x ${platz.x} statt ${wx}`);
    assert.ok(Math.abs(platz.z - wz) < 0.001, `z ${platz.z} statt ${wz}`);
    assert.equal(platz.lift, 0.17, 'der Sockel bleibt der des Werks');
    assert.equal(platz.hoehe, 2.9, 'ohne hoehe_m gilt product_dna.heft.hoehe');
  });
});

test('die Ausnahme der Buehne gewinnt, die Regel des Werks bleibt stehen', () => {
  const produkt = {stage: {lift: 0.22, h: 2.9}};
  assert.equal(platzFuer({x: .5, z: .5, hoehe_m: 3.4}, produkt).hoehe, 3.4);
  assert.equal(platzFuer({x: .5, z: .5}, produkt).hoehe, 2.9);
  assert.equal(platzFuer({x: .5, z: .5}, null).hoehe, 2.6, 'ohne beides der Vorgabewert aus standee');
  assert.equal(platzFuer({x: .5, z: .5}, produkt).lift, 0.22, 'der Sockel kommt immer vom Werk');
});

test('die Drehung kommt in Grad und wird zu Bogenmass', () => {
  assert.equal(platzFuer({x: .5, z: .5, drehung: 0}, null).drehung, 0);
  assert.ok(Math.abs(platzFuer({x: .5, z: .5, drehung: -8}, null).drehung - (-8 * Math.PI / 180)) < 1e-9);
  assert.equal(platzFuer({x: .5, z: .5}, null).drehung, 0, 'ohne Angabe keine Drehung');
});

test('platzFuer klemmt, bevor es rechnet', () => {
  // Ein Stueck ausserhalb der Ebene 2 darf nie eine Welt-Stelle bekommen,
  // die der Trigger spaeter ablehnt.
  const zuWeitVorn = platzFuer({x: .5, z: .95}, null);
  assert.ok(Math.abs(zuWeitVorn.z - buehneZ(EBENE_ZWEI.bis)) < 1e-9);
});

test('der Versionsriegel haelt das aeltere Fenster auf', () => {
  const gelesen = {id: 'b1', version: 7, stuecke: [{x: .5, z: .5}]};
  const {bedingung, zeile} = schreibEntwurf(gelesen);
  assert.deepEqual(bedingung, {id: 'b1', version: 7}, 'geschrieben wird gegen die gelesene Version');
  assert.equal(zeile.version, 8, 'und die Zeile traegt danach die naechste');
});

test('schreibEntwurf klemmt, statt den Trigger ablehnen zu lassen', () => {
  const {zeile} = schreibEntwurf({id: 'b1', version: 1, stuecke: [
    {werk_id: 'a', x: 2, z: .95},
    {werk_id: 'b', x: -1, z: .1},
  ]});
  zeile.stuecke.forEach((s) => assert.equal(ebeneVon(s.z), 2, 'jedes Stueck liegt auf Ebene 2'));
  assert.equal(zeile.stuecke[0].x, 1);
  assert.equal(zeile.stuecke[1].x, 0);
});

test('eine neue Buehne faengt bei Version 1 an', () => {
  const {bedingung, zeile} = schreibEntwurf({stuecke: []});
  assert.equal(bedingung.version, 0, 'ungelesen heisst Version 0');
  assert.equal(zeile.version, 1);
  assert.deepEqual(zeile.ruecken, {papier: 'weiss'}, 'die Vorgabe der Spalte');
  assert.equal(zeile.eigenhaendig, false);
  assert.equal(zeile.layout, 'fan');
});

test('das erste Ziehen macht die Buehne eigenhaendig', () => {
  const vorher = {id: 'b1', version: 3, layout: 'fan', eigenhaendig: false,
    stuecke: [{werk_id: 'a', x: .2, z: .5}, {werk_id: 'b', x: .8, z: .5}]};
  const nachher = nachDemZiehen(vorher, 1, {x: .6, z: .42});
  assert.equal(nachher.eigenhaendig, true);
  assert.equal(nachher.layout, 'frei');
  assert.deepEqual(nachher.stuecke[0], vorher.stuecke[0], 'das andere Stueck bleibt unberuehrt');
  assert.equal(nachher.stuecke[1].x, .6);
  assert.equal(nachher.stuecke[1].z, .42);
  assert.equal(nachher.stuecke[1].werk_id, 'b', 'das Werk bleibt dasselbe');
});

test('auch beim Ziehen haelt die Klemme', () => {
  const nachher = nachDemZiehen({stuecke: [{werk_id: 'a', x: .5, z: .5}]}, 0, {x: 9, z: .99});
  assert.equal(nachher.stuecke[0].x, 1);
  assert.equal(nachher.stuecke[0].z, EBENE_ZWEI.bis);
});

const KATALOG = {
  wand_beton:     {ebene: 'hinten', cutout_url: '/d/wand.webp',  seitenverhaeltnis: 1.4, hoehe_m: 3.2},
  bogen_schwarz:  {ebene: 'hinten', cutout_url: '/d/bogen.webp', seitenverhaeltnis: 0.8, hoehe_m: 2.2},
  pflanze_olive:  {ebene: 'vorn',   cutout_url: '/d/olive.webp', seitenverhaeltnis: 0.6, hoehe_m: 1.7},
  ohne_bild:      {ebene: 'vorn',   cutout_url: null,            hoehe_m: 1.0},
};

test('die Ebene entscheidet der Katalog, nicht die Zeile', () => {
  // Eine Wand mit z=0.9 (also scheinbar vorn) gehoert trotzdem nach hinten.
  const {hinten, vorn} = dekoNachEbenen([{key: 'wand_beton', x: .5, z: .9}], KATALOG);
  assert.equal(hinten.length, 1, 'die Wand steht hinten, was auch immer die Zeile sagt');
  assert.equal(vorn.length, 0);
  assert.ok(hinten[0].z < buehneZ(EBENE_ZWEI.von), 'und wirklich hinter der Ebene der Werke');
});

test('Deko ohne Freistellung erscheint nicht', () => {
  const {vorn} = dekoNachEbenen([{key: 'ohne_bild', x: .5, z: .9}], KATALOG);
  assert.deepEqual(vorn, [], 'kein Platzhalter, kein graues Rechteck');
  const unbekannt = dekoNachEbenen([{key: 'gibt_es_nicht', x: .5, z: .9}], KATALOG);
  assert.deepEqual(unbekannt, {hinten: [], vorn: []});
});

test('Deko landet nie auf der Ebene der Werke', () => {
  const {hinten, vorn} = dekoNachEbenen([
    {key: 'bogen_schwarz', x: .2, z: .5},
    {key: 'pflanze_olive', x: .8, z: .5},
  ], KATALOG);
  assert.ok(hinten[0].z < buehneZ(EBENE_ZWEI.von));
  assert.ok(vorn[0].z > buehneZ(EBENE_ZWEI.bis));
});

test('die Hoehe der Zeile gewinnt vor der des Katalogs', () => {
  const {vorn} = dekoNachEbenen([{key: 'pflanze_olive', x: .5, z: .9, hoehe_m: 0.9}], KATALOG);
  assert.equal(vorn[0].hoehe, 0.9);
  const ohne = dekoNachEbenen([{key: 'pflanze_olive', x: .5, z: .9}], KATALOG);
  assert.equal(ohne.vorn[0].hoehe, 1.7, 'sonst die des Katalogs');
});

test('Deko traegt einen eigenen Namensraum und das Seitenverhaeltnis', () => {
  const {hinten} = dekoNachEbenen([{key: 'wand_beton', x: .5, z: .1}], KATALOG);
  assert.equal(hinten[0].id, 'deko:wand_beton', 'nie mit einer Werk-UUID zu verwechseln');
  assert.equal(hinten[0].cutout, '/d/wand.webp');
  assert.equal(hinten[0].ratio, 1.4, 'spart das Nachmessen am Bild');
});

/* ——— B6/B7/B8: Ziehen, Hoehe, geliehene Aufsteller ——— */

test('Hin und zurueck ergibt wieder dasselbe — sonst wandert ein Stueck beim Ziehen',()=>{
 for(const x of [0,0.25,0.5,0.731,1]){
  assert.ok(Math.abs(ausBuehneX(buehneX(x))-x)<1e-12,'x '+x);
 }
 for(const z of [EBENE_ZWEI.von,0.5,EBENE_ZWEI.bis]){
  assert.ok(Math.abs(ausBuehneZ(buehneZ(z))-z)<1e-12,'z '+z);
 }
});

test('Die Umkehrung trifft die heutigen Welt-Werte — bis auf die Rundung, und die ist benannt',()=>{
 // x geht exakt auf: 5,6 ist keine gerundete Zahl.
 assert.ok(Math.abs(ausBuehneX(-1.95)-0.1517857)<1e-6,'x trifft genau');

 // z NICHT. Und das ist kein Fehler, sondern der Preis der Lesbarkeit: die exakte
 // Tiefe waere 1,0666666…, das exakte z0 -0,0733333…. BUEHNE nennt drei LESBARE
 // Zahlen (1.067 / -0.073), und die kosten hier eine Abweichung. Gemessen:
 //
 //   Welt-z 0,30 → 0,3495783  statt 0,35  →  0,450 mm auf der Buehne
 //   Welt-z 0,62 → 0,6494845  statt 0,65  →  0,550 mm auf der Buehne
 //
 // Eine halbe Millimeter-Abweichung an einem 3 m hohen Mantel sieht niemand. Diese
 // Pruefung nagelt sie auf ein Zehntel Prozent fest, damit sie klein BLEIBT — wer die
 // Konstanten groeber rundet, wird hier rot.
 for(const [weltZ,soll] of [[0.30,0.35],[0.62,0.65]]){
  const ist=ausBuehneZ(weltZ);
  assert.ok(Math.abs(ist-soll)<1e-3,'z '+weltZ+' ergibt '+ist.toFixed(7)+', erwartet ~'+soll);
 }

 // Worauf es beim Ziehen wirklich ankommt, ist die Umkehrbarkeit — und die ist exakt
 // (eigener Test darueber). Die Rundung verschiebt die ganze Skala, sie verzerrt sie nicht.
});

test('mitHoehe klemmt auf 0,3 bis 4,0 und rundet auf Zentimeter',()=>{
 assert.equal(mitHoehe({werk_id:'a'},2.5).hoehe_m,2.5);
 assert.equal(mitHoehe({werk_id:'a'},0.05).hoehe_m,HOEHE.von,'eine Vase ist nicht 5 cm');
 assert.equal(mitHoehe({werk_id:'a'},99).hoehe_m,HOEHE.bis,'und kein Werk ist 99 m hoch');
 assert.equal(mitHoehe({werk_id:'a'},1.23456).hoehe_m,1.23,'Zentimeter reichen');
 assert.deepEqual(mitHoehe({werk_id:'a',hoehe_m:2},'unsinn'),{werk_id:'a',hoehe_m:2},
  'was keine Zahl ist, aendert nichts — lieber die alte Hoehe als NaN in der Datenbank');
});

test('B8: geliehen ist, was aus dem Beispielvorrat kommt — nicht nur was fehlt',()=>{
 // Die gemessene Lage: drei von vier Werken tragen ein Beispielbild des Prototyps.
 assert.equal(geliehenerAufsteller({dna:{heft:{cutout_url:'/heft/assets/cutout-coat.webp'}}}),true);
 assert.equal(geliehenerAufsteller({dna:{heft:{cutout_url:'./heft/assets/cutout-art.webp'}}}),true);
 assert.equal(geliehenerAufsteller({}),true,'gar keiner ist auch geliehen');
 assert.equal(geliehenerAufsteller({dna:{heft:{cutout_url:''}}}),true);
 // Und der eine echte, aus product-shots — der Knopf darf ihn NICHT anbieten.
 assert.equal(geliehenerAufsteller({dna:{heft:{cutout_url:'product-shots/haus/cutouts/x.png'}}}),false);
 assert.equal(geliehenerAufsteller({dna:{heft:{cutout_url:'https://x.supabase.co/storage/v1/object/sign/product-shots/a.png'}}}),false);
 // Die Falle, die eine zu breite Regel stellen wuerde: ein Haus, das "heft/assets" im
 // eigenen Pfad hat, aber aus dem Speicher kommt. Deshalb wird auf das Segment geprueft.
 assert.equal(geliehenerAufsteller({dna:{heft:{cutout_url:'product-shots/mein-heft/assetsammlung/a.png'}}}),false);
});
