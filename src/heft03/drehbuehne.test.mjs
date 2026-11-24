import test from 'node:test';
import assert from 'node:assert/strict';
import {stueckWaehlen,drehFlaechen,drehIndex,drehZu,ringTiefe,drehbuehneHtml,spiegelHtml,MAX_STUECKE} from './drehbuehne.mjs';

test('Auswahl: an, ab, und beim vierten Stueck bleibt sie stehen',()=>{
 let r=stueckWaehlen([],'a');assert.deepEqual(r,{auswahl:['a'],zuViele:false});
 r=stueckWaehlen(['a','b'],'a');assert.deepEqual(r.auswahl,['b']);
 r=stueckWaehlen(['a','b','c'],'d');assert.deepEqual(r,{auswahl:['a','b','c'],zuViele:true});
 assert.equal(MAX_STUECKE,3);
 assert.deepEqual(stueckWaehlen(null,'x').auswahl,['x']);
});

test('Flaechen: was entsteht, wartet — was gescheitert ist, faellt weg',()=>{
 const laeuft=drehFlaechen({url:'v.jpg',ansichtenStatus:'laeuft',ansichten:{}});
 assert.deepEqual(laeuft.map(f=>[f.k,!!f.url,f.wartet]),[['vorne',true,false],['seite',false,true],['hinten',false,true]]);
 const teils=drehFlaechen({url:'v.jpg',ansichtenStatus:'fehler',ansichten:{vorne:'v.jpg',hinten:'h.jpg'}});
 assert.deepEqual(teils.map(f=>f.k),['vorne','hinten']);
 const alt=drehFlaechen({url:'v.jpg'});                    // alte Function: nur die Vorderansicht
 assert.deepEqual(alt.map(f=>f.k),['vorne']);
 assert.deepEqual(drehFlaechen({}),[]);
});

test('Drehen: der Zaehler laeuft unbegrenzt, die Flaeche bleibt im Kreis',()=>{
 assert.equal(drehIndex(0,1,3),1);
 assert.equal(drehIndex(2,1,3),0);
 assert.equal(drehIndex(0,-1,3),2);
 assert.equal(drehIndex(-7,0,3),2);
 assert.equal(drehIndex(5,0,0),0);
});

test('Antippen einer Ansicht: immer der kurze Weg',()=>{
 assert.equal(drehZu(0,2,3),-1);       // von vorne zum Ruecken: einen zurueck, nicht zwei vor
 assert.equal(drehZu(0,1,3),1);
 assert.equal(drehZu(4,1,3),0);        // 4 mod 3 = 1: steht schon vorne
 assert.equal(drehZu(-1,0,3),1);       // vom Ruecken nach vorne: einen weiter
 assert.equal(drehZu(0,1,2),1);
 assert.equal(drehZu(3,0,0),0);
});

test('Ring: drei Flaechen ergeben ein Dreieck mit 28,87 cqw Tiefe',()=>{
 assert.equal(ringTiefe(3),28.87);
 assert.equal(ringTiefe(2),0);
 assert.equal(ringTiefe(1),0);
});

test('HTML: ehrlich beschriftet, maskiert, Ansichten nur wenn es etwas zu drehen gibt',()=>{
 const eine=drehbuehneHtml({url:'v.jpg'},{titel:'Mantel',ergebnis:'Du trägst es.',anhang:'<div class="anprobe-urteil"></div>'});
 assert.match(eine,/Mit KI erzeugt/);
 assert.match(eine,/anprobe-urteil/);
 assert.doesNotMatch(eine,/data-anprobe-ansicht/);
 const drei=drehbuehneHtml({url:'v.jpg',dreh:4,ansichtenStatus:'fertig',ansichten:{vorne:'v.jpg',seite:'s.jpg',hinten:'h.jpg'}},{titel:'<b>Mantel</b>',ergebnis:'Du trägst es.'});
 assert.equal((drei.match(/data-anprobe-ansicht=/g)||[]).length,3);
 assert.match(drei,/--dreh:4;--winkel:120deg;--tiefe:28.87cqw/);
 assert.match(drei,/data-anprobe-ansicht="1" aria-pressed="true">Seite/);   // 4 mod 3 = 1 → die Seite steht vorne
 assert.doesNotMatch(drei,/<b>Mantel<\/b>/);
 assert.match(drei,/&lt;b&gt;Mantel&lt;\/b&gt;/);
 const wartend=drehbuehneHtml({url:'v.jpg',ansichtenStatus:'laeuft'});
 assert.match(wartend,/Rücken <small>entsteht<\/small>/);
 assert.match(wartend,/Der Rücken entsteht\./);
 assert.doesNotMatch(drei,/data-anprobe-ansichten-neu/);
 const gescheitert=drehbuehneHtml({url:'v.jpg',ansichtenStatus:'fehler',ansichten:{vorne:'v.jpg',seite:'s.jpg'}});
 assert.match(gescheitert,/data-anprobe-ansichten-neu/);                    // nur Seite kam: noch einmal anbieten
 assert.doesNotMatch(drehbuehneHtml({url:'v.jpg'}),/data-anprobe-ansichten-neu/);   // alte Function: kein Knopf
 const boese=drehbuehneHtml({url:'x" onerror="alert(1)'});
 assert.doesNotMatch(boese,/" onerror="/);
 assert.equal(drehbuehneHtml({}),'');
});

test('Vorher, Drehknopf und Enthuellung: nur wenn es sie braucht',()=>{
 const drei={url:'v.jpg',ansichtenStatus:'fertig',ansichten:{vorne:'v.jpg',seite:'s.jpg',hinten:'h.jpg'}};
 const ohne=drehbuehneHtml(drei);
 assert.doesNotMatch(ohne,/data-anprobe-vorher/);                    // kein eigenes Bild bekannt: kein Vorher
 assert.doesNotMatch(ohne,/enthuellt/);
 assert.match(ohne,/data-anprobe-drehen="1"/);                       // drei Flaechen: der Drehknopf im Bild
 const mit=drehbuehneHtml({...drei,vorherAn:true},{vorher:'ich.jpg',enthuellen:true});
 assert.match(mit,/class="drehbuehne enthuellt zeigt-vorher" style="--vorhang-seit:-0ms"/);
 const mitten=drehbuehneHtml(drei,{enthuellen:420.6});
 assert.match(mitten,/style="--vorhang-seit:-421ms"/);               // neu gezeichnet: der Vorhang setzt fort
 assert.doesNotMatch(drehbuehneHtml(drei,{enthuellen:1500}),/enthuellt/);   // vorbei: kein Vorhang mehr
 assert.match(mit,/data-anprobe-vorher aria-pressed="true"/);
 assert.match(mit,/class="drehbuehne-vorher" src="ich.jpg" alt="Vorher: dein Bild" aria-hidden="false"/);
 assert.doesNotMatch(drehbuehneHtml({url:'v.jpg'}),/data-anprobe-drehen/);   // eine Flaeche: nichts zu drehen
});

test('Spiegel: dein Bild im selben Rahmen — wartend mit Scan, maskiert, ohne Bild leer',()=>{
 const bereit=spiegelHtml({bild:'ich.jpg',titel:'Mantel 01',anzahl:1});
 assert.match(bereit,/Dein Spiegel/);
 assert.match(bereit,/Outfit anprobieren/);
 assert.doesNotMatch(bereit,/spiegel-scan/);
 assert.doesNotMatch(bereit,/data-drehbuehne/);                     // der Spiegel dreht nicht
 const laeuft=spiegelHtml({bild:'ich.jpg',titel:'<i>Mantel</i>',laeuft:true});
 assert.match(laeuft,/aria-busy="true"/);
 assert.match(laeuft,/spiegel-scan/);
 assert.match(spiegelHtml({bild:'ich.jpg',laeuft:true,laeuftSeit:1234.4}),/--scan-seit:-1234ms/);   // neu gezeichnet: der Scan faehrt weiter
 assert.match(laeuft,/PAWN legt an/);
 assert.match(laeuft,/&lt;i&gt;Mantel&lt;\/i&gt;/);
 assert.match(spiegelHtml({bild:'ich.jpg'}),/Noch nichts gewählt/);
 assert.equal(spiegelHtml({}),'');
});
