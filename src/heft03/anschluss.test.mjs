// Anschluss-Tests: echte Zeilenformen → Heft-Modell → Adressen → Kuration. Läuft ohne Browser.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zeilen} from './fixtures/zeilen.mjs';
import {heftAusZeilen,productFromRow,themeFromRow,checkoutLines,cartByHouse,stilToRow,stilFromRow} from './adapters.mjs';
import {heftFuellen,demoWiederherstellen,products,houses,sections,displays,counts,kuration} from './data.mjs';
import {pfadAusRoute,routeAusPfad,alleAdressen,UMZUEGE} from './routen.mjs';
import {kuratiere} from './kuration.mjs';
import {urteil,passform} from './beratung.mjs';
import {purchaseMode,reading} from './model.mjs';
import {chatAntwort,SPALTEN,demoQuelle} from './quelle.mjs';
import {readView} from './views.mjs';
import {extendedView} from './extra-views.mjs';

test('Zeilen → Heft: nur zeigbare, veröffentlichte Stücke aktiver, veröffentlichter Häuser',()=>{
 const h=heftAusZeilen(zeilen);
 assert.deepEqual(Object.keys(h.products).sort(),['p-1','p-2','p-3','p-4','p-5']); // p-6 draft, p-7 ohne Bild, p-8 Haus unveröffentlicht
 assert.deepEqual(Object.keys(h.houses).sort(),['haus-lind','haus-ocker','haus-spur']);
 const lind=h.houses['haus-lind'];
 assert.equal(lind.number,'31');assert.equal(lind.world,'mode');assert.equal(lind.color,'#7a2e35');
 assert.equal(lind.blocks.length,4);assert.equal(lind.theme.font,'Playfair');assert.equal(lind.published,true);
 assert.equal(h.houses['haus-ocker'].blocks.length,0,'Bausteine nur bei veröffentlichter Hausseite');
 assert.equal(h.houses['haus-ocker'].color,'#8b623e','Archetyp-Farbe ohne Theme');
 assert.equal(h.houses['haus-spur'].world,'kunst','Welt aus den Werken, wenn tags leer');
 assert.equal(h.houses['haus-spur'].theme.architecture,'arch','kantenhaerte rund → Bogen');
 assert.ok(!h.media['m-5'],'abgelehnte Medien fliegen raus');
 assert.deepEqual(h.kuration.slugs,['lind-mantel-01','spur-serie-iv-2','gibt-es-nicht']);
});

test('Produktzeile: Größen, Bestand, Angebotstyp, Material, Bühne',()=>{
 const p=productFromRow(zeilen.products[0]);
 assert.deepEqual(p.sizes,['S','M','L']);assert.equal(p.stock_quantity,3);assert.equal(p.stockBySize.M,0);
 assert.equal(p.material,'Wolle 100 %');assert.equal(p.kind,'produkt');assert.equal(purchaseMode(p),'cart');
 assert.equal(p.measurements.rows[0],'Brustumfang');assert.equal(p.stage.h,2.9,'Standhöhe aus product_dna.heft.hoehe');assert.equal(p.cutout,'./assets/cutout-noir.webp');
 assert.equal(productFromRow(zeilen.products[1]).cutout,null,'ohne Freistellung kein Aufsteller');
 const auftrag=productFromRow(zeilen.products[4]);
 assert.equal(auftrag.kind,'auftragsarbeit');assert.equal(purchaseMode(auftrag),'inquiry');
 const bestellung=productFromRow(zeilen.products[1]);
 assert.equal(bestellung.lead,'Anfertigung · 21 Tage');assert.equal(bestellung.stock_quantity,null);assert.equal(purchaseMode(bestellung),'cart');
 const kunst=productFromRow(zeilen.products[3]);
 assert.ok(kunst.stage.h>1.9&&kunst.stage.h<=3.4,'Höhe aus height_cm');
});

test('Theme-Zeile: farbwelt {bg,fg,accent,muted} wie theme.ts',()=>{
 const t=themeFromRow(zeilen.themes[0]);
 assert.equal(t.paper,'#f4efe6');assert.equal(t.ink,'#2a2521');assert.equal(t.accent,'#7a2e35');assert.equal(t.rhythm,'ruhig');
});

test('heftFuellen: Sektionen je Welt aus Häusern, ehrliche Leerzustände, Kuration',()=>{
 const h=heftAusZeilen(zeilen);
 const n=heftFuellen(h);
 try{
  assert.equal(n.houses,3);
  assert.deepEqual(sections.mode,['haus-lind']);assert.deepEqual(sections.interior,['haus-ocker']);assert.deepEqual(sections.kunst,['haus-spur']);
  assert.equal(counts.mode,1);assert.equal(displays['haus-lind'].kicker,'MODE / HAUS 31');assert.equal(displays['haus-lind'].product,'p-1');
  assert.deepEqual(displays.hero.pieces,['p-1','p-3','p-4']);
  assert.deepEqual(kuratiere('edit',{}),['p-1','p-4'],'Redaktion hat Vorrang, unbekannte Slugs fallen weg');
  assert.deepEqual(kuratiere('hero',{}),['p-1','p-3','p-4']);
  assert.deepEqual(kuratiere('haus-lind',{}),['p-1'],'Bühne eines Hauses zeigt nur seine freigestellten Stücke — p-2 hat keine Freistellung');
  assert.deepEqual(displays['haus-lind'].pieces,['p-1']);
  // Welt ohne Häuser
  const ohneKunst=heftAusZeilen({...zeilen,designers:zeilen.designers.filter(d=>d.id!=='d-3')});
  heftFuellen(ohneKunst);
  assert.deepEqual(sections.kunst,['leer-kunst']);assert.equal(displays['leer-kunst'].leer,true);assert.deepEqual(kuratiere('leer-kunst',{}),[]);
  assert.deepEqual(kuratiere('hero',{}).map(id=>products[id].world),['mode','interior'],'Hero rotiert, zeigt aber je Welt ein Stück');
  // Alle Doppelseiten rendern ohne Fehler
  heftFuellen(h);
  for(const [s,seiten] of Object.entries(sections))for(let i=0;i<seiten.length;i++){
   const r={section:s,index:i,q:''};if(!reading(r))continue;const html=extendedView(r,{saved:[],cart:[],stil:{},frag:{},measurements:{}})??readView(r,{saved:[],cart:[],stil:{},frag:{},measurements:{}});
   assert.ok(typeof html==='string'&&html.length>100,s+'/'+i);
  }
  for(const slug of Object.keys(houses))for(let i=0;i<3;i++){const html=readView({section:'haus',slug,index:i},{saved:[],cart:[],stil:{},frag:{},measurements:{}});assert.ok(html.length>100,slug+'/'+i);}
 }finally{demoWiederherstellen();}
 assert.deepEqual(sections.mode,['drape','noir'],'Beispieldaten sind zurück');
});

test('Urteil liest die Stil-DNA des Stücks, nicht eine Id-Liste',()=>{
 const p=productFromRow(zeilen.products[0]);
 assert.equal(urteil({welt:'mode',richtung:'Klar',form:'Gerade'},p).ja,true);
 assert.equal(urteil({welt:'mode',richtung:'Laut',form:'Lagen'},p).ja,false);
 assert.equal(urteil({welt:'interior',richtung:'Warm',form:'Ton'},productFromRow(zeilen.products[2])).text.startsWith('Ja.'),true);
});

test('Adressen: Route ↔ Pfad in beide Richtungen, Umzüge bekannt',()=>{
 for(const r of [{section:'entdecken',index:0},{section:'entdecken',index:1},{section:'mode',index:1},{section:'dna',index:4},{section:'haus',slug:'drape',index:2},{section:'suche',index:0,q:'wolle'},{section:'konto',index:1},{section:'fuer-designer',index:1}]){
  const p=pfadAusRoute(r),z=routeAusPfad(p);
  assert.equal(pfadAusRoute(z),p,JSON.stringify(r));
 }
 assert.equal(pfadAusRoute({section:'dna',index:4}),'/deine-dna/linie');
 assert.deepEqual(routeAusPfad('/werk/wool-coat'),{section:'mode',index:0,werk:'coat'});
 assert.deepEqual(routeAusPfad('/nirgends/3'),{section:'entdecken',index:0});
 assert.ok(alleAdressen().includes('/haus/drape/2'));
 assert.equal(UMZUEGE['/dna'],'/deine-dna');
});

test('Kasse: Zeilen in Cent, ein Haus je Aufruf',()=>{
 const cart=[{id:'coat',size:'M',qty:2},{id:'chair',size:'',qty:1}];
 const gruppen=cartByHouse(cart,products);
 assert.deepEqual(Object.keys(gruppen),['drape','forme']);
 const zeilen2=checkoutLines(gruppen.drape,products);
 assert.deepEqual(zeilen2,[{name:'Wool Coat · M',unit_amount:48000,qty:2,slug:'wool-coat',size:'M',product_id:'coat'}]);
});

test('Chat-Antwort: Karten werden zu Slugs, alte /product/-Adressen inklusive',()=>{
 const a=chatAntwort({reply:'Schau dir das an.',cards:[{href:'/werk/lind-mantel-01'},{href:'/product/plisse-01?x=1'},{href:'/haus/drape'}],session_id:'s1'});
 assert.deepEqual(a.treffer,['lind-mantel-01','plisse-01']);assert.equal(a.session_id,'s1');
 assert.equal(chatAntwort(null),null);
});

test('Spaltenmasken enthalten keine Stripe- oder Kontospalten',()=>{
 for(const [k,v] of Object.entries(SPALTEN))assert.ok(!/stripe|user_id|email|iban|application_fee/.test(v),k);
});

test('Stilprofil hin und zurück',()=>{
 const row=stilToRow({welt:'mode',richtung:'Klar',form:'Gerade'},{hautton:'warm'},'Damen');
 assert.equal(row.quelle,'heft-quiz');
 const zurueck=stilFromRow({...row,user_id:'u'});
 assert.deepEqual(zurueck.stil,{welt:'mode',richtung:'Klar',form:'Gerade'});assert.equal(zurueck.fuerWen,'Damen');
});

test('demoQuelle antwortet auf alles, ohne nach außen zu gehen',async()=>{
 const q=demoQuelle();
 assert.equal((await q.heft()).kuration,null);
 assert.equal(await q.chat({}),null);
 assert.equal((await q.kasse({})).fehler,'vorschau');
 assert.equal((await q.anfrage({})).vorschau,true);
});

test('Passform rechnet gegen die Maßtabelle des Hauses, nicht gegen eine Faustregel',()=>{
 const p=productFromRow(zeilen.products[0]);
 // Die Fixture-Zeile hat rows ['Brustumfang', …] mit Werten je Größe.
 assert.ok(p.measurements.rows.length,'die Maßtabelle ist angekommen');

 const eng=passform({chest_cm:'92',fit_preference:'eng'},p);
 const weit=passform({chest_cm:'92',fit_preference:'weit'},p);
 assert.equal(eng.moeglich,true);
 assert.equal(weit.moeglich,true);
 // Derselbe Körper, anderer Fall — das muss zu einer anderen Größe führen,
 // sonst rechnet die Passform den Spielraum gar nicht mit.
 assert.notEqual(eng.beste?.groesse,weit.beste?.groesse,'der gewählte Fall verschiebt die Größe');
 assert.match(eng.groessen[0].grund,/cm/,'die Begründung nennt Zentimeter, keine Vermutung');

 // Ohne Maße wird nichts behauptet.
 assert.equal(passform({},p).moeglich,false);
 // Ohne Maßtabelle ebenso.
 assert.equal(passform({chest_cm:'92'},{...p,measurements:{rows:[],values:{}}}).moeglich,false);
});
