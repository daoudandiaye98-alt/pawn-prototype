/**
 * studioQuelle — geprueft ohne Datenbank, mit einem nachgebauten Client.
 *
 * WARUM DAS EINEN EIGENEN NACHBAU BRAUCHT. `studioQuelle` ist der Grund, warum der
 * Menuepunkt „Auftritt" leer war, und sie schreibt in `heft_buehnen` — die Tabelle, aus
 * der die oeffentliche Ausgabe liest. Ein Fehler hier ist nicht hässlich, er ist teuer.
 * Der Client hier merkt sich JEDE Abfrage; geprueft wird nicht nur das Ergebnis, sondern
 * auch, WAS gefragt wurde: dass genau ein Haus gelesen wird und dass die Bedingung auf
 * die Version wirklich mitgeschickt wird.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {studioQuelle,SPALTEN_BUEHNE} from './quelle.mjs';
import {heftFuellen,demoWiederherstellen,displays} from './data.mjs';

/** Ein Client, der sich merkt, was man ihn gefragt hat. Kein Netz, kein Zufall. */
function nachbau(tabellen={}){
 const protokoll=[];
 const bauer=(tabelle)=>{
  const schritt={tabelle,filter:[],art:'select',nutzlast:null};
  protokoll.push(schritt);
  const antwort=()=>{
   const t=tabellen[tabelle];
   const wert=typeof t==='function'?t(schritt):t;
   return wert===undefined?{data:null,error:null}:wert;
  };
  const kette={
   select(spalten){schritt.spalten=spalten;return kette;},
   insert(zeile){schritt.art='insert';schritt.nutzlast=zeile;return kette;},
   update(zeile){schritt.art='update';schritt.nutzlast=zeile;return kette;},
   eq(feld,wert){schritt.filter.push([feld,wert]);return kette;},
   neq(){return kette;},in(){return kette;},order(){return kette;},limit(){return kette;},
   maybeSingle(){return Promise.resolve(antwort());},
   then(aufloesen){return Promise.resolve(antwort()).then(aufloesen);}
  };
  return kette;
 };
 return {protokoll,
  from:bauer,
  auth:{getUser:async()=>({data:{user:{id:'u-1',email:'haus@pawn.vision'}}})},
  functions:{invoke:async()=>({data:null,error:null})}};
}

const HAUS={id:'d-1',slug:'drape',brand_name:'DRAPÉ',house_number:'07',tags:['mode'],status:'draft',published:false};
const WERK={id:'p-1',slug:'wool-coat',name:'Wool Coat',world:'mode',price:480,image_url:'bild.webp',
 status:'draft',designer_id:'d-1',product_dna:{heft:{cutout_url:'frei.png'}}};

test('studioQuelle liest genau EIN Haus — und auch einen Entwurf',async()=>{
 const c=nachbau({
  designers:{data:HAUS,error:null},
  products:{data:[WERK],error:null},
  heft_buehnen:{data:[],error:null},
  heft_deko:{data:[],error:null}
 });
 const q=studioQuelle({client:c,haus:'drape'});
 const heft=await q.heft();
 const frage=c.protokoll.find(s=>s.tabelle==='designers');
 assert.deepEqual(frage.filter,[['slug','drape']],'genau dieses Haus, nicht alle');
 const werke=c.protokoll.find(s=>s.tabelle==='products');
 assert.deepEqual(werke.filter,[['designer_id','d-1']],'nur die eigenen Werke');
 // Der Punkt: status 'draft' und published:false — die oeffentliche Quelle liesse beides
 // weg. Im Studio MUSS es durch, sonst koennte niemand eine Seite vorbereiten.
 assert.ok(heft.houses.drape,'das eigene Haus kommt durch, obwohl es unveroeffentlicht ist');
 assert.ok(heft.products['p-1'],'das eigene Werk kommt durch, obwohl es ein Entwurf ist');
});

test('studioQuelle haengt Buehne UND Katalog an — ohne Katalog kein Aufsteller',async()=>{
 const buehne={id:'b-1',designer_id:'d-1',welt:'mode',blatt:0,layout:'frei',version:3,
  stuecke:[{werk_id:'p-1',x:.5,z:.5}],deko:[{key:'stuhl',x:.2,z:.1}],veroeffentlicht:false};
 const c=nachbau({
  designers:{data:HAUS,error:null},products:{data:[WERK],error:null},
  heft_buehnen:{data:[buehne],error:null},
  heft_deko:{data:[{key:'stuhl',art:'moebel',ebene:'hinten',hoehe_m:1.1,cutout_url:'stuhl.png',seitenverhaeltnis:.7,aktiv:true}],error:null}
 });
 const heft=await studioQuelle({client:c,haus:'drape'}).heft();
 assert.equal(heft.buehnen.drape.id,'b-1');
 assert.equal(heft.buehnen.drape.version,3);
 assert.equal(heft.buehnen.drape.dekoKatalog.stuhl.ebene,'hinten','der Katalog reist MIT der Buehne');
 const katalogFrage=c.protokoll.find(s=>s.tabelle==='heft_deko');
 assert.deepEqual(katalogFrage.filter,[['aktiv',true]],'nur aktive Aufsteller');
 assert.equal(katalogFrage.spalten,SPALTEN_BUEHNE.deko,'benannte Spalten, nie select(*)');
});

test('heftFuellen haengt die Buehne an displays — der Zweig in world.mjs lief vorher nie',()=>{
 const heft={
  products:{'p-1':{id:'p-1',slug:'wool-coat',name:'Coat',world:'mode',house:'drape',image:'b.webp',price:480,dna:{},kind:'produkt'}},
  houses:{drape:{slug:'drape',name:'DRAPÉ',number:'07',world:'mode',products:['p-1'],blocks:[]}},
  media:{},kuration:null,
  buehnen:{drape:{id:'b-1',version:2,stuecke:[],deko:[],dekoKatalog:{}}}
 };
 heftFuellen(heft);
 assert.equal(displays.drape.buehne.id,'b-1','ohne dieses Feld faellt world.mjs auf makeStage zurueck');
 assert.equal(displays.drape.buehne.version,2,'die Version gehoert in den Zwischenspeicher-Schluessel');
 demoWiederherstellen();
 assert.equal(displays.drape.buehne,undefined,'und sie bleibt nicht kleben');
});

test('Schreiben ohne Buehne legt die erste an — mit designer_id und Version 1',async()=>{
 const c=nachbau({
  designers:{data:{id:'d-1'},error:null},
  heft_buehnen:(s)=>s.art==='insert'?{data:{id:'b-neu',version:1},error:null}:{data:null,error:null}
 });
 const antwort=await studioQuelle({client:c,haus:'drape'}).buehneSchreiben({welt:'mode',blatt:0,stuecke:[]});
 const schreiben=c.protokoll.find(s=>s.art==='insert');
 assert.equal(schreiben.nutzlast.designer_id,'d-1','ohne Haus gehoert die Zeile niemandem');
 assert.equal(schreiben.nutzlast.version,1,'die erste Fassung ist Version 1');
 assert.equal(schreiben.nutzlast.eigenhaendig,false,'eigenhaendig wird gesetzt, nicht geraten');
 assert.equal(antwort.ok,true);
 assert.equal(antwort.buehne.id,'b-neu');
});

test('DER VERSIONSRIEGEL: geschrieben wird nur gegen die Version, die beim Lesen galt',async()=>{
 const c=nachbau({
  designers:{data:{id:'d-1'},error:null},
  heft_buehnen:(s)=>s.art==='update'?{data:{id:'b-1',version:8},error:null}:{data:null,error:null}
 });
 const antwort=await studioQuelle({client:c,haus:'drape'})
  .buehneSchreiben({id:'b-1',version:7,welt:'mode',stuecke:[{werk_id:'p-1',x:.4,z:.5}]});
 const schreiben=c.protokoll.find(s=>s.art==='update');
 assert.deepEqual(schreiben.filter,[['id','b-1'],['version',7]],
  'die GELESENE Version ist die Bedingung — sonst gewinnt lautlos das aeltere Fenster');
 assert.equal(schreiben.nutzlast.version,8,'und die neue Fassung zaehlt eins hoch');
 assert.equal(antwort.ok,true);
});

test('Ueberholt: trifft die Bedingung keine Zeile, wird NICHTS ueberschrieben',async()=>{
 let runde=0;
 const c=nachbau({
  designers:{data:{id:'d-1'},error:null},
  // Das Update trifft nichts (data:null) — jemand anderes war schneller.
  heft_buehnen:(s)=>{if(s.art==='update')return {data:null,error:null};runde++;return {data:{version:11},error:null};}
 });
 const antwort=await studioQuelle({client:c,haus:'drape'}).buehneSchreiben({id:'b-1',version:7,stuecke:[]});
 assert.equal(antwort.ueberholt,true,'der Aufrufer erfaehrt es');
 assert.equal(antwort.version,11,'und bekommt die Version, die jetzt gilt');
 assert.ok(!antwort.ok,'kein stilles ok');
 assert.equal(runde,1,'genau einmal nachgesehen, welche Version jetzt gilt');
});

test('Stuecke werden GEKLEMMT, bevor sie geschrieben werden — der Trigger darf nicht ablehnen',async()=>{
 const c=nachbau({designers:{data:{id:'d-1'},error:null},
  heft_buehnen:(s)=>s.art==='insert'?{data:{id:'b',version:1},error:null}:{data:null,error:null}});
 await studioQuelle({client:c,haus:'drape'}).buehneSchreiben({
  stuecke:[{werk_id:'p-1',x:-3,z:0.9},{werk_id:'p-2',x:4,z:0.01}]});
 const [a,b]=c.protokoll.find(s=>s.art==='insert').nutzlast.stuecke;
 assert.equal(a.x,0,'x unter 0 wird auf 0 geklemmt');
 assert.equal(a.z,0.65,'z ueber 0.65 waere werk_nicht_auf_ebene_zwei');
 assert.equal(b.x,1,'x ueber 1 wird auf 1 geklemmt');
 assert.equal(b.z,0.35,'z unter 0.35 ebenso');
});

test('Veroeffentlichen sagt VORHER, was fehlt — nicht als Datenbankfehler',async()=>{
 const c=nachbau({designers:{data:{id:'d-1'},error:null}});
 const q=studioQuelle({client:c,haus:'drape'});
 const zuWenig=await q.buehneVeroeffentlichen({id:'b-1',version:1,stuecke:[{werk_id:'p-1',x:.5,z:.5}]});
 assert.equal(zuWenig.fehler,'unfertig');
 assert.deepEqual(zuWenig.gruende,['noch 2 Werke bis zum Veröffentlichen']);
 assert.equal(zuWenig.mindestens,3);
 assert.equal(c.protokoll.filter(s=>s.art==='update').length,0,'und es wird GAR NICHT geschrieben');
});

test('Veroeffentlichen mit drei Werken schreibt — gegen die Version',async()=>{
 const c=nachbau({designers:{data:{id:'d-1'},error:null},
  heft_buehnen:(s)=>s.art==='update'?{data:{id:'b-1',version:5,veroeffentlicht:true},error:null}:{data:null,error:null}});
 const drei=[{werk_id:'a',x:.2,z:.5},{werk_id:'b',x:.5,z:.5},{werk_id:'c',x:.8,z:.5}];
 const antwort=await studioQuelle({client:c,haus:'drape'}).buehneVeroeffentlichen({id:'b-1',version:4,stuecke:drei});
 assert.equal(antwort.ok,true);
 const schreiben=c.protokoll.find(s=>s.art==='update');
 assert.deepEqual(schreiben.filter,[['id','b-1'],['version',4]]);
 assert.equal(schreiben.nutzlast.veroeffentlicht,true);
});

test('Ein Editor ist kein Laden: Kasse, Chat und Bewerbung sind ausdruecklich zu',async()=>{
 const q=studioQuelle({client:nachbau(),haus:'drape'});
 assert.equal((await q.kasse({})).fehler,'studio','im Editor wird nicht gekauft');
 assert.equal((await q.anfrage({})).fehler,'studio');
 assert.equal((await q.bewerbung({})).fehler,'studio');
 assert.equal(await q.chat({}),null,'kein Chat — das Heft antwortet sich selbst');
 // Und die Methoden, die app.js OHNE ?. ruft, sind da. Fehlten sie, stuerzte der Start ab.
 for(const pfad of [['stil','laden'],['masse','laden'],['merkliste','laden'],['konto','aktuell'],['konto','bestellungen'],['zugang','anmelden']]){
  assert.equal(typeof q[pfad[0]][pfad[1]],'function','quelle.'+pfad.join('.')+' wird ohne ?. gerufen');
 }
});

test('Ohne Client oder ohne Haus haelt sie an, statt halb zu laufen',()=>{
 assert.throws(()=>studioQuelle({haus:'drape'}),/Client/);
 assert.throws(()=>studioQuelle({client:nachbau()}),/Slug/);
});

/**
 * Die Voraussetzung, unter der world.mjs > masse() im oeffentlichen Heft NICHTS aendert.
 *
 * `masse()` liest `container.getBoundingClientRect()` statt `innerWidth/innerHeight`.
 * Im Studio ist das noetig (dort ist der Kasten 390 px breit), im oeffentlichen Heft
 * darf es keinen Unterschied machen. Es macht keinen, WEIL `#stage` per CSS
 * `position:fixed;inset:0` ist — dann ist der Kasten exakt das Fenster.
 *
 * Gemessen in Chromium auf dem gebauten Heft, drei Breiten:
 *   1440x900 · 390x844 · 834x1112  →  stage = {l:0, t:0, b:Fenster, h:Fenster}
 *
 * Faellt diese CSS-Zeile weg, faellt die Begruendung mit — und zwar lautlos, weil das
 * Heft dann einfach falsch gross rendert statt einen Fehler zu werfen. Darum die Wache.
 *
 * (Der Versuch, das ueber byteweise gleiche Aufnahmen zu belegen, ist gescheitert:
 *  drei Aufnahmen DESSELBEN Baus ergaben drei verschiedene Pruefsummen — die Buehne
 *  animiert. Arithmetik schlaegt hier Pixel.)
 */
test('#stage ist im oeffentlichen Heft das Fenster — sonst ist masse() kein No-op',()=>{
 const css=readFileSync(new URL('./style.css',import.meta.url),'utf8');
 const ohneUmbruch=css.replace(/\s+/g,'');
 assert.ok(ohneUmbruch.includes('#stage,#reader-layer{position:fixed;inset:0}'),
  'style.css muss #stage auf position:fixed;inset:0 halten — daran haengt, dass '+
  'world.mjs > masse() im oeffentlichen Heft dieselben Zahlen liefert wie innerWidth/innerHeight');
});
