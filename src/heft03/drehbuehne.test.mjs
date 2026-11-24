import test from 'node:test';
import assert from 'node:assert/strict';
import {stueckWaehlen,drehFlaechen,drehIndex,drehZu,ringTiefe,drehbuehneHtml,MAX_STUECKE} from './drehbuehne.mjs';

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
 const boese=drehbuehneHtml({url:'x" onerror="alert(1)'});
 assert.doesNotMatch(boese,/" onerror="/);
 assert.equal(drehbuehneHtml({}),'');
});
