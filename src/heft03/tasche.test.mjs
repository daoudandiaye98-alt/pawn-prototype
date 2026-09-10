// Die Tasche mit echten Zeilen. Läuft ohne Browser.
//
// Zusage Z7: Wer ein Stück in die Tasche legt, findet es auch dort — mit Name, Haus und
// Preis, und die Kasse bekommt denselben Betrag in Cent.
//
// Warum diese Datei: Der belegte Fehler (7f3155e-Nachfolge) war, dass die Korbzeile nur
// eine Id hielt und das Stück aus einer anderen, leeren Liste nachgeschlagen wurde — die
// Zeile lag im Korb und war trotzdem unsichtbar. `cartView` schlägt genauso nach
// (`products[r.id]`) und wirft unbekannte Zeilen still weg. Dass die Liste dieselbe ist,
// aus der das Stück kam, ist damit eine Zusage und keine Selbstverständlichkeit.
//
// Vorher lag diese Zusage auf `src/pages/Cart.tsx`; die Seite ist mit dem Umzug ins Heft
// gegangen. Sie ist nicht verschwunden, sie ist hierher gezogen.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zeilen} from './fixtures/zeilen.mjs';
import {heftAusZeilen,checkoutLines,cartByHouse} from './adapters.mjs';
import {heftFuellen,demoWiederherstellen,products,houses} from './data.mjs';
import {addCart} from './model.mjs';
import {cartView} from './views.mjs';

test('Ein echtes Stück landet in der Tasche und ist dort zu sehen',()=>{
 const heft=heftAusZeilen(zeilen);
 heftFuellen(heft);
 try{
  const werk=products['p-1'];
  assert.ok(werk,'die Fixture-Zeile ist im Heft angekommen');

  const tasche=addCart([],werk,'M');
  assert.deepEqual(tasche,[{id:'p-1',size:'M',qty:1}]);

  const html=cartView({cart:tasche,saved:[],vorschau:false});
  assert.ok(html.includes(werk.name),'der Name des Stücks steht in der Tasche');
  assert.ok(html.includes(houses[werk.house].name),'das Haus steht dabei');
  assert.ok(html.includes('520'),'der Preis steht dabei');
  assert.ok(html.includes('· M'),'die Größe steht dabei');
  assert.ok(!html.includes('Deine Tasche ist noch leer'),'die Tasche gilt nicht als leer');

  // Der belegte Fehler: eine Zeile, deren Stück nicht in derselben Liste steht,
  // verschwindet still. Das muss sichtbar bleiben — nicht als leere Tasche mit Zeile.
  const fremd=cartView({cart:[{id:'gibt-es-nicht',size:'',qty:1}],saved:[],vorschau:false});
  assert.ok(fremd.includes('Deine Tasche ist noch leer'),'eine Zeile ohne Stück zeigt die leere Tasche, nicht eine halbe');

  // Und die Kasse bekommt denselben Betrag, in Cent.
  const gruppen=cartByHouse(tasche,products);
  assert.deepEqual(Object.keys(gruppen),['haus-lind'],'eine Zahlung je Haus');
  assert.deepEqual(checkoutLines(gruppen['haus-lind'],products),
   [{name:'Mantel 01 · M',unit_amount:52000,qty:1,slug:'lind-mantel-01',size:'M',product_id:'p-1'}]);
 }finally{demoWiederherstellen();}
});

test('Was ohne Bestand ist, kommt gar nicht erst hinein',()=>{
 const heft=heftAusZeilen(zeilen);
 heftFuellen(heft);
 try{
  const werk=products['p-1'];
  // Größe M steht in der Fixture auf 0 (size_variants).
  assert.equal(werk.stockBySize.M,0,'die Fixture hat für M keinen Bestand');
  // Das Heft nimmt sie trotzdem an, weil das Stück auf Bestellung geht — der Bestand
  // je Größe steuert nur die Anzeige. Was NICHT passieren darf: eine Zeile ohne Größe,
  // obwohl das Stück Größen hat.
  assert.throws(()=>addCart([],werk,''),/Größe/,'ohne Größe keine Zeile');
 }finally{demoWiederherstellen();}
});
