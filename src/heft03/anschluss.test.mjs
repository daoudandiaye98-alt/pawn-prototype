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
import {chatAntwort,SPALTEN,demoQuelle,bildLoeser} from './quelle.mjs';
import {readView} from './views.mjs';
import {quelleWaehlen,anklopfen,FRIST_MS,ANKLOPF_FRIST_MS} from './notbetrieb.mjs';
import {extendedView} from './extra-views.mjs';
import {sections as SEKTIONEN,counts as ZAEHLER} from './data.mjs';

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

// ————————————————————————————————————————————————————————————————
// Vorschau-Betrieb. Die Frist stand als Promise.race mitten in startHeft() und war
// damit nur im Browser beobachtbar — also faktisch ungeprüft. Herausgezogen nach
// notbetrieb.mjs, hier sind alle drei Fälle belegt.
// ————————————————————————————————————————————————————————————————
test('Vorschau-Betrieb: eine Quelle, die nie antwortet, führt zu einem gefüllten Heft',async()=>{
 // Nie auflösen — genau der Fall, der pawn.vision auf dem Ladebild hängen ließ.
 const stumm={art:'supabase',heft:()=>new Promise(()=>{})};
 const ergebnis=await quelleWaehlen(stumm,demoQuelle,30);
 assert.equal(ergebnis.notbetrieb,true);
 assert.equal(ergebnis.quelle.art,'demo','die Beispielquelle übernimmt');
 assert.ok(ergebnis.heft,'und sie liefert ein Heft, keine Ausnahme');
 assert.ok(Object.keys(ergebnis.heft.products||{}).length,'mit Werken darauf');
 assert.match(ergebnis.fehler.message,/nicht geantwortet/,'der Grund wird nicht verschluckt');
});

test('Vorschau-Betrieb: eine Quelle, die absagt — auch synchron — landet im selben Pfad',async()=>{
 const absage={art:'supabase',heft:async()=>{throw new Error('ERR_NAME_NOT_RESOLVED');}};
 const a=await quelleWaehlen(absage,demoQuelle,30);
 assert.equal(a.notbetrieb,true);
 assert.equal(a.fehler.message,'ERR_NAME_NOT_RESOLVED');

 // Ein synchroner Wurf darf startHeft() nicht sprengen, sondern muss dieselbe Absage sein.
 const sofort={art:'supabase',heft(){throw new Error('kaputt');}};
 const b=await quelleWaehlen(sofort,demoQuelle,30);
 assert.equal(b.notbetrieb,true);
 assert.equal(b.fehler.message,'kaputt');
});

test('Vorschau-Betrieb: eine Quelle, die rechtzeitig antwortet, bleibt die Quelle',async()=>{
 const echt={art:'supabase',heft:async()=>heftAusZeilen(zeilen)};
 const ergebnis=await quelleWaehlen(echt,()=>{throw new Error('die Beispielquelle darf hier nicht angefasst werden');},500);
 assert.equal(ergebnis.notbetrieb,false);
 assert.equal(ergebnis.quelle,echt);
 assert.equal(ergebnis.fehler,null);
 assert.ok(ergebnis.heft.houses['haus-lind'],'die echten Zeilen sind durchgekommen');
});

test('Vorschau-Betrieb: die Frist ist eine Zahl, keine im Code versteckte Ziffer',()=>{
 assert.equal(typeof FRIST_MS,'number');
 assert.equal(FRIST_MS,30000,'30 Sekunden — nur noch letzte Rettung, nicht mehr das Gesetz (L13)');
 assert.equal(typeof ANKLOPF_FRIST_MS,'number');
});

// ————————————————————————————————————————————————————————————————
// L13 — Anklopfen statt Warten. Die Frist allein hat zwei Fehler gemacht:
// eine langsame, aber lebende Datenbank landete in der Beispielausgabe, und eine
// erreichbare Datenbank mit fehlender Tabelle ebenso — dann standen Beispielhäuser
// da, wo „noch nichts da" die Wahrheit gewesen wäre. Drei Fälle, drei Tests.
// ————————————————————————————————————————————————————————————————

test('L13: keine Antwort beim Anklopfen — sofort Vorschau, ohne die Frist abzuwarten',async()=>{
 // Genau der Fall vom September: rnakubexbqfgfciynqpt.supabase.co loeste nicht mehr auf.
 const befund=await anklopfen('https://weg.example',{fetch:async()=>{throw new TypeError('Failed to fetch');}});
 assert.equal(befund.erreichbar,false);

 // Die Quelle antwortet NIE. Wuerde noch auf die Frist gewartet, liefe dieser Test
 // 30 Sekunden. Er muss in Millisekunden fertig sein — das ist der Beweis.
 const stumm={art:'supabase',heft:()=>new Promise(()=>{})};
 const vorher=Date.now();
 const ergebnis=await quelleWaehlen(stumm,demoQuelle,{anklopfen:befund});
 assert.ok(Date.now()-vorher<1000,'es wird nicht gewartet, wenn niemand oeffnet');
 assert.equal(ergebnis.notbetrieb,true);
 assert.equal(ergebnis.leer,false);
 assert.equal(ergebnis.quelle.art,'demo');
 assert.ok(Object.keys(ergebnis.heft.products||{}).length,'die Beispielausgabe steht');
});

test('L13: jede HTTP-Antwort — auch 401 — heisst nie Vorschau; fehlende Tabellen sind kein Grund',async()=>{
 // /auth/v1/health laeuft mit mode:'no-cors'. Wir lesen den Inhalt nicht, nur ob
 // ueberhaupt jemand antwortet. 401 ist eine Antwort: der Server lebt.
 const befund=await anklopfen('https://lebt.example',{fetch:async()=>({status:401})});
 assert.equal(befund.erreichbar,true);

 const ohneTabelle={art:'supabase',heft:async()=>{throw new Error('relation "public.heft_produkte" does not exist');}};
 const ergebnis=await quelleWaehlen(ohneTabelle,()=>{throw new Error('die Beispielquelle darf hier nicht angefasst werden');},{anklopfen:befund});
 assert.equal(ergebnis.notbetrieb,false,'keine Beispielhaeuser vor eine lebende Datenbank');
 assert.equal(ergebnis.leer,true);
 assert.match(ergebnis.fehler.message,/does not exist/,'der Grund wird nicht verschluckt');

 // Und was daraus wird, ist ehrlich leer — nicht erfunden.
 assert.deepEqual(Object.keys(ergebnis.heft.products),[]);
 assert.deepEqual(Object.keys(ergebnis.heft.houses),[]);
 try{
  heftFuellen(ergebnis.heft);
  assert.deepEqual(sections.mode,['leer-mode']);
  assert.equal(displays['leer-mode'].leer,true);
 }finally{demoWiederherstellen();}
});

test('L13: die Frist bleibt die letzte Rettung, auch wenn angeklopft wurde',async()=>{
 const befund=await anklopfen('https://lebt.example',{fetch:async()=>({status:200})});
 assert.equal(befund.erreichbar,true);

 // Erreichbar, aber die Abfrage haengt. Dagegen — und nur dagegen — gibt es die Frist.
 const haengt={art:'supabase',heft:()=>new Promise(()=>{})};
 const ergebnis=await quelleWaehlen(haengt,demoQuelle,{anklopfen:befund,frist:30});
 assert.equal(ergebnis.notbetrieb,true,'haengt sie ueber die Frist, rettet die Beispielausgabe');
 assert.equal(ergebnis.leer,false);
 assert.equal(ergebnis.fehler.art,'frist','und der Grund sagt, dass es die Frist war');

 // Ohne Adresse wird nicht angeklopft — dann gilt wie frueher allein die Frist.
 const ohne=await anklopfen(undefined);
 assert.equal(ohne.erreichbar,null,'nicht angeklopft ist nicht dasselbe wie nicht erreichbar');
});

// ————————————————————————————————————————————————————————————————
// Bildadressen. Vorher stand in quelle.mjs `bild(karte[u]||u)` und in der Hülle
// `(await signiereMedia(u)) ?? u`. Beide machten aus „nicht signierbar" wieder den
// blanken Bucket-Pfad — eine Adresse, die der Browser nie laden kann.
// ————————————————————————————————————————————————————————————————
test('Bildlöser: ohne Signatur überlebt nur, was sich selbst tragen kann',()=>{
 const karte={
  'product-shots/a.png':'https://signiert/a.png', // erfolgreich signiert
  'product-shots/b.png':null,                     // signieren fehlgeschlagen
  'https://fremd.example/c.jpg':null,             // fremde Adresse, nicht signierbar
 };
 const loese=bildLoeser(karte,u=>u);

 assert.equal(loese('product-shots/a.png'),'https://signiert/a.png');
 assert.equal(loese('product-shots/b.png'),null,'ein blanker Bucket-Pfad wird null, nie eine kaputte Adresse');
 assert.equal(loese('https://fremd.example/c.jpg'),null,'auch eine fremde Adresse, die als nicht ladbar gemeldet wurde, wird null');
 // Gar nicht angemeldet — die Bilder des Hefts kommen als './assets/…'. Genau hier hat ein
 // erster Versuch, die Form zu RATEN, jedes Bild geleert. Die Karte entscheidet, nicht das Muster.
 assert.equal(loese('./assets/cutout-coat.webp'),'./assets/cutout-coat.webp');
 assert.equal(loese('/heft/assets/cutout-coat.webp'),'/heft/assets/cutout-coat.webp');
 // Scheiterte die ganze Runde, ist die Karte leer: dann wissen wir über nichts etwas
 // und alles bleibt stehen. Alles zu leeren wäre schlimmer als ein Versuch zu laden.
 const leer=bildLoeser({},u=>u);
 assert.equal(leer('product-shots/b.png'),'product-shots/b.png');
 // Leeres und Fehlendes geht unverändert durch bild().
 assert.equal(loese(''),'');
 assert.equal(loese(null),null);
});

test('Bildlöser: ein Werk ohne ladbares Bild kommt nicht auf die Bühne',()=>{
 // Genau die Folge, die den grauen Kasten verhindert: heftAusZeilen() lässt Stücke
 // ohne Bild weg (wie p-7 in den Fixtures). Mit null statt Bucket-Pfad greift das auch
 // bei einer fehlgeschlagenen Signatur — vorher kam ein totes Bild durch.
 const loese=bildLoeser({[zeilen.products[0].image_url]:null},u=>u);
 const h=heftAusZeilen(zeilen,{bild:loese});
 assert.ok(!h.products['p-1'],'p-1 hatte keine ladbare Adresse und fehlt');
 assert.ok(h.products['p-2'],'die übrigen Werke stehen weiter');
});

// ————————————————————————————————————————————————————————————————
// L5 — Der Zugang zieht ins Heft. Vorher lag er auf einer eigenen React-Seite
// ausserhalb: wer sich anmelden wollte, fiel aus dem Heft heraus, sah eine andere
// Gestaltung und kam an anderer Stelle wieder herein.
//
// Die neue Seite steht VORNE in der Sektion — damit ruecken alle anderen um eins.
// Genau daran sind solche Umbauten sonst gestorben: ein „data-page" zeigt danach
// auf die falsche oder auf gar keine Seite, und niemand merkt es.
// ————————————————————————————————————————————————————————————————
const leererZustand=()=>({saved:[],cart:[],orders:[],requests:[],stil:{},frag:{},measurements:{},profile:null});

test('L5: die Zugang-Doppelseite ist die erste Seite von Mein PAWN',()=>{
 assert.equal(SEKTIONEN.konto[0],'zugang');
 assert.equal(ZAEHLER.konto,SEKTIONEN.konto.length,'die Zahl der Seiten zaehlt mit');

 const html=extendedView({section:'konto',index:0},leererZustand());
 assert.ok(html.includes('data-zugang-form="anmelden"'),'Anmelden ist die Voreinstellung');
 assert.ok(!html.includes('data-zugang-form="registrieren"'),'und Registrieren ist eine EIGENE Ansicht, kein zweites Formular daneben');
 assert.ok(html.includes('data-zugang-google'),'der Google-Weg steht daneben');
 assert.ok(html.includes('data-zugang-publikum="haus"'),'und die zweite Publikumstuer');
});

test('L5: Registrieren ist die zweite Ansicht — und verlangt das Passwort zweimal',()=>{
 const html=extendedView({section:'konto',index:0},{...leererZustand(),zugang:{modus:'registrieren'}});
 assert.ok(html.includes('data-zugang-form="registrieren"'));
 assert.ok(!html.includes('data-zugang-form="anmelden"'),'zwei Ansichten, nie beide gleichzeitig');
 assert.equal((html.match(/type="password"/g)||[]).length,2,'Passwort und Wiederholung');
 assert.ok(html.includes('name="wiederholung"'));

 // Haeuser bewerben sich. Ein Formular, das so tut, als koenne man sich einkaufen,
 // waere ein Bruch der Zusage „Rang ist nie kaeuflich".
 const haus=extendedView({section:'konto',index:0},{...leererZustand(),zugang:{publikum:'haus'}});
 assert.ok(!haus.includes('data-zugang-form'),'fuer ein Haus gibt es hier kein Anmeldeformular');
 assert.ok(haus.includes('data-route="fuer-designer"'),'sondern den Weg zur Bewerbung');
});

test('L5: wer angemeldet ist, sieht die Tuer seiner Rolle statt einer zweiten Anmeldemaske',()=>{
 const kunde=extendedView({section:'konto',index:0},{...leererZustand(),profile:{name:'Mina',email:'m@x.de',rollen:[]}});
 assert.ok(!kunde.includes('data-zugang-form'),'keine Anmeldemaske fuer Angemeldete');
 assert.ok(kunde.includes('data-logout'));
 assert.ok(!kunde.includes('data-aussen'),'Kundschaft hat keine Tuer nach draussen');

 const haus=extendedView({section:'konto',index:0},{...leererZustand(),profile:{name:'DRAPÉ',email:'d@x.de',rollen:['designer']}});
 assert.ok(haus.includes('data-aussen="/studio"'),'ein Haus geht ins Studio');
 const cockpit=extendedView({section:'konto',index:0},{...leererZustand(),profile:{name:'D',email:'a@x.de',rollen:['admin','designer']}});
 assert.ok(cockpit.includes('data-aussen="/admin"'),'Admin schlaegt Designer');
});

test('L5: kein Verweis in Mein PAWN zeigt nach dem Umbau ins Leere',()=>{
 const letzte=SEKTIONEN.konto.length-1;
 const zustand={...leererZustand(),profile:{name:'Mina',email:'m@x.de',rollen:[]}};
 const gesehen=new Set();
 for(let i=0;i<SEKTIONEN.konto.length;i++){
  const html=extendedView({section:'konto',index:i},zustand);
  assert.ok(typeof html==='string'&&html.length>100,'Seite '+i+' rendert');
  for(const m of html.matchAll(/data-page="(\d+)"/g)){
   const ziel=Number(m[1]);
   assert.ok(ziel>=0&&ziel<=letzte,'Seite '+i+' verweist auf data-page='+ziel+', es gibt aber nur 0 bis '+letzte);
   gesehen.add(ziel);
  }
 }
 // Die Verweise muessen die verschobenen Seiten treffen, nicht die alten Zahlen.
 assert.ok(gesehen.has(1),'„Mein PAWN" ist jetzt Seite 1');
 assert.ok(gesehen.has(2),'der Merkzettel Seite 2');
 assert.ok(gesehen.has(5),'die Einstellungen Seite 5');
});
