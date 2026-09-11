// Bilder des Hefts. Die Basis ist umstellbar (assetBasis('/heft/assets/')), damit das Heft auch unter Vite/public liegt.
export const ASSETS={basis:'./assets/'};
export const asset=name=>ASSETS.basis+name;
export function assetBasis(b){ASSETS.basis=b.endsWith('/')?b:b+'/';}
export const products={
 coat:{id:'coat',slug:'wool-coat',name:'Wool Coat',house:'drape',price:480,image:asset('cutout-coat.webp'),material:'Wolle · Futter aus Viskose',description:'Ein Mantel mit großzügigem Revers und weicher, gebundener Taille. Die Silhouette lässt dem Material Raum.',sizes:['XS','S','M','L'],inventory_mode:'made_to_order',stock_quantity:null,lead:'Anfertigung · 3–4 Wochen',world:'mode',kind:'produkt',dna:{materials:['Wolle'],silhouette:['Weit','Gerade'],colors:['Elfenbein'],mood:['Klar','Weich'],tags:['mantel']},stage:{h:3.08,lift:.17},note:'Weiche Wolle. Eine starke, ruhige Silhouette.'},
 dress:{id:'dress',slug:'plisse-01',name:'Plissé No. 01',house:'drape',price:290,image:asset('cutout-dress.webp'),material:'Plissierter Stoff · Seidenmischung',description:'Eine helle Silhouette zwischen Bewegung und Ruhe. Feine Falten geben dem Kleid seine eigene Architektur.',sizes:['S','M','L'],inventory_mode:'stock',stock_quantity:3,lead:'Versand in 3–5 Tagen',world:'mode',kind:'produkt',dna:{materials:['Seide'],silhouette:['Weit','Lagen'],colors:['Creme'],mood:['Weich','Laut'],tags:['kleid']},stage:{h:2.92,lift:.17},note:'Plissé, das Bewegung sichtbar macht.'},
 noir:{id:'noir',slug:'coat-noir',name:'Coat / 02',house:'noir',price:540,image:asset('cutout-noir.webp'),material:'Schwarze Wolle',description:'Reduziert auf Proportion, Linie und Haltung. Ein langes Revers trifft auf einen ruhigen, geraden Fall.',sizes:['S','M','L'],inventory_mode:'stock',stock_quantity:0,lead:'Aktuell vergriffen',world:'mode',kind:'produkt',dna:{materials:['Wolle'],silhouette:['Gerade','Tailliert'],colors:['Schwarz'],mood:['Klar','Roh'],tags:['mantel']},stage:{h:2.9,lift:.17},note:'Eine klare Linie. Konsequent in Schwarz.'},
 chair:{id:'chair',slug:'curve-chair',name:'Curve Chair',house:'forme',price:720,image:asset('cutout-chair.webp'),material:'Bouclé · Gepolsterter Korpus',description:'Ein weicher Sessel als stiller Gegenpol. Gerundete Formen, ein warmer Bezug und eine großzügige Sitzfläche.',sizes:[],inventory_mode:'made_to_order',stock_quantity:null,lead:'Anfertigung · 6–8 Wochen',world:'interior',kind:'produkt',dna:{materials:['Textil','Holz'],silhouette:[],colors:['Creme'],mood:['Still','Warm'],tags:['sessel']},stage:{h:1.85,lift:.22},note:'Runde Formen, die einem Raum Ruhe geben.'},
 vessel:{id:'vessel',slug:'vessel-02',name:'Vessel No. 02',house:'forme',price:160,image:asset('cutout-vessel.webp'),material:'Steinzeug · Von Hand aufgebaut',description:'Eine Gefäßstudie mit unregelmäßiger Kontur. Kleine Unterschiede sind Teil der Arbeit.',sizes:[],inventory_mode:'stock',stock_quantity:2,lead:'Versand in 3–5 Tagen',world:'interior',kind:'produkt',dna:{materials:['Ton'],silhouette:[],colors:['Sand'],mood:['Warm','Roh'],tags:['gefaess']},stage:{h:1.48,lift:.39},note:'Die Handschrift bleibt im Material.'},
 art:{id:'art',slug:'traces-01',name:'Traces / 01',house:'traces',price:null,image:asset('cutout-art.webp'),material:'Pigment und Öl auf Leinwand',description:'Eine freie Arbeit über Spuren, Schichten und das, was zwischen zwei Gesten bleibt. Auftragsarbeiten entstehen im Austausch.',sizes:[],inventory_mode:'made_to_order',stock_quantity:null,lead:'Auftragsarbeit · Nach Vereinbarung',world:'kunst',kind:'auftragsarbeit',dna:{materials:['Öl','Pigment'],silhouette:['Wandfüllend','Serie'],colors:['Schwarz','Weiß'],mood:['Abstrakt','Geste'],tags:['malerei']},stage:{h:2.48,lift:.22},note:'Eine freie Geste, die Raum für Deutung lässt.'}
};
export const houses={
 drape:{slug:'drape',name:'DRAPÉ',number:'07',world:'mode',location:'Berlin',title:'The shape<br>of a moment.',intro:'Kleidung beginnt für uns mit Bewegung. Wir arbeiten mit der Spannung zwischen großzügigem Volumen und einer einzigen klaren Linie.',quote:'Nicht mehr Form.<br>Mehr Gefühl für Form.',image:asset('cutout-coat.webp'),work:asset('haeuser-werkbank-894.webp'),lookbook:['edit-atelier','mode-stange'],products:['coat','dress'],color:'#722d33',blocks:[
 {id:'b1',kind:'auftakt',position:0,content:{media_asset_id:'atelier',ton:'ruhig'}},
 {id:'b2',kind:'editorial_text',position:1,content:{heading:'In Bewegung.',text:'Wir entwickeln kleine Kollektionen in ruhigen Schritten. Eine Falte, ein Schnitt, die Berührung eines Stoffes: Daraus entsteht die nächste Silhouette.'}},
 {id:'b3',kind:'zitat',position:2,content:{quote:'Ein gutes Stück begleitet. Es drängt sich nicht auf.',author:'Lea Marquardt, DRAPÉ'}},
 {id:'b4',kind:'lookbook_streifen',position:3,content:{media_asset_ids:['edit-atelier','mode-stange','editorial']}},
 {id:'b5',kind:'produktreihe',position:4,content:{product_ids:['coat','dress']}}
 ]},
 noir:{slug:'noir',name:'NOIR',number:'12',world:'mode',location:'Antwerpen',title:'Form follows<br>character.',intro:'Eine reduzierte Garderobe mit klarer Haltung. Dunkle Stoffe, markante Proportionen und Raum für Persönlichkeit.',quote:'Die Linie bleibt.',image:asset('mode-stange-894.webp'),work:asset('archetyp-atelier.webp'),lookbook:['editorial','noir'],products:['noir'],color:'#29282b'},
 forme:{slug:'forme',name:'FORME',number:'18',world:'interior',location:'Kopenhagen',title:'Objects with<br>presence.',intro:'Objekte, die Räume leiser machen. Holz, Ton und das Wissen der Hände treffen auf einfache, bewusste Formen.',quote:'Dinge, mit denen<br>wir leben wollen.',image:asset('interior-ecke-894.webp'),work:asset('interior-ocker.webp'),lookbook:['edit-interior','boutique'],products:['chair','vessel'],color:'#c1622f'},
 traces:{slug:'traces',name:'TRACES',number:'24',world:'kunst',location:'Paris',title:'A trace.<br>A possibility.',intro:'Jede Schicht hält einen Moment fest. Unsere Arbeiten entstehen zwischen Beobachtung, Material und freier Geste.',quote:'Das Bild beginnt<br>vor dem ersten Strich.',image:asset('kunst-staffelei-894.webp'),work:asset('kunst-haende.webp'),lookbook:['kunst-malerei','pigmente'],products:['art'],color:'#1f3a2c'}
};
export const media={coat:{url:asset('cutout-coat.webp'),kind:'bild'},mode:{url:asset('mode-stange-894.webp'),kind:'bild'},atelier:{url:asset('haeuser-werkbank-894.webp'),kind:'bild'},'edit-atelier':{url:asset('edit-atelier.webp'),kind:'bild'},'mode-stange':{url:asset('mode-stange-894.webp'),kind:'bild'},editorial:{url:asset('archetyp-editorial.webp'),kind:'bild'},noir:{url:asset('cutout-noir.webp'),kind:'bild'},'edit-interior':{url:asset('edit-interior.webp'),kind:'bild'},boutique:{url:asset('boutique-objekte-894.webp'),kind:'bild'},'kunst-malerei':{url:asset('kunst-malerei.webp'),kind:'bild'},pigmente:{url:asset('pigmente.webp'),kind:'bild'}};
export const displays={
 hero:{kicker:'PAWN / AUSGABE 03',title:'Independent minds.<br><em>Extraordinary things.</em>',text:'Ein Heft, das sich vor dir aufstellt: Mode, Interior und Kunst von unabhängigen Häusern — kuratiert, nummeriert, mit Menschen dahinter. Tipp eine Welt an.',action:'Unsere Häuser',section:'haeuser',pieces:['coat','chair','art'],layout:'fan',color:'#722d33',house:'drape'},
 edit:{kicker:'AUSGEWÄHLT FÜR DICH',title:'Was zu dir<br><em>passt.</em>',text:'Drei Stücke aus drei Welten — sortiert nach dem, was du uns gezeigt hast. Je mehr du ansiehst, desto genauer.',action:'Deine Linie lesen',section:'dna',pieces:['coat','chair','art'],layout:'fan',color:'#887861',house:'forme'},
 drape:{kicker:'MODE / HAUS 07',title:'DRAPÉ.<br><em>In Bewegung.</em>',text:'Weiche Wolle. Fließende Silhouetten. Eine Inszenierung zwischen Stoff und Skulptur.',action:'Wool Coat ansehen',product:'coat',pieces:['coat','dress'],layout:'frame',color:'#722d33',house:'drape'},
 noir:{kicker:'MODE / HAUS 12',title:'NOIR.<br><em>Klare Haltung.</em>',text:'Architektonische Schnitte und dunkle Wolle. Eine Kollektion, die durch ihre Form spricht.',action:'Coat / 02 ansehen',product:'noir',pieces:['noir'],layout:'fan',color:'#29282b',house:'noir'},
 forme:{kicker:'INTERIOR / HAUS 18',title:'FORME.<br><em>Zum Bleiben.</em>',text:'Weiche Texturen. Runde Formen. Besondere Dinge brauchen einen eigenen Raum.',action:'Curve Chair ansehen',product:'chair',pieces:['chair','vessel'],layout:'frame',color:'#c1622f',house:'forme'},
 terre:{kicker:'INTERIOR / HAUS 18',title:'Eine stille<br><em>Präsenz.</em>',text:'Formen, die aus dem Material entstehen. Eine kleine Auswahl handgefertigter Objekte.',action:'Vessel No. 02 ansehen',product:'vessel',pieces:['vessel'],layout:'fan',color:'#b3552a',house:'forme'},
 traces:{kicker:'KUNST / HAUS 24',title:'Spuren.<br><em>Die bleiben.</em>',text:'Jede Schicht hält einen Moment fest. Freie Arbeiten und neue Perspektiven aus dem Atelier.',action:'Arbeit entdecken',product:'art',pieces:['art'],layout:'frame',color:'#1f3a2c',house:'traces'},
 gestures:{kicker:'KUNST / HAUS 24',title:'Im Dialog<br><em>entstehen.</em>',text:'Manche Arbeiten beginnen mit einem Gespräch. Entdecke Auftragsarbeiten und die Menschen dahinter.',action:'Auftragsarbeit anfragen',product:'art',inquiry:'art',pieces:['art'],layout:'fan',color:'#2b4a3a',house:'traces'}
};
export const sections={entdecken:['hero','edit'],mode:['drape','noir'],interior:['forme','terre'],kunst:['traces','gestures'],haeuser:['welten','mode','interior','kunst'],dna:['intro','welt','richtung','form','linie','foto','massband','privacy'],suche:['results'],konto:['zugang','start','saved','orders','requests','settings'],'frag-pawn':['dialog'],'fuer-designer':['invitation','studio'],vision:['vision','belief','work']};
export const labels={entdecken:'Entdecken',mode:'Mode',interior:'Interior',kunst:'Kunst',haeuser:'Unsere Häuser',dna:'DNA','fuer-designer':'Für Designer',vision:'Vision',haus:'Haus',suche:'Suche',konto:'Mein PAWN','frag-pawn':'Frag PAWN'};
export const counts=Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,v.length]));
export const demoNotice='Gestaltungsvorschau · Beispielhäuser und Beispielpreise';
// Derselbe Satz plus den dritten Teil, den der Streifen im Vorschau-Betrieb braucht:
// wer Beispielpreise sieht, muss erfahren, dass er sie nicht bezahlen kann. Ein Satz,
// eine Quelle — sonst driften Streifen und Hinweis auseinander.
export const vorschauHinweis=demoNotice+' · Es kann nichts bestellt werden';

// ---------------------------------------------------------------------------
// Anschluss: Das Heft wird mit echten Daten GEFÜLLT, nicht neu importiert.
// products/houses/media/displays/sections/counts sind Objekte — sie werden an
// Ort und Stelle geleert und neu befüllt, damit jedes Modul dieselben Daten sieht.
// ---------------------------------------------------------------------------
export const WELTEN=['mode','interior','kunst'];
// Auf die Bühne kommt nur, was freigestellt ist. In der Vorschau sind das die Beispiel-Freistellungen; mit echten Daten product.cutout.
export const heftModus={demo:true};
export const buehnenfaehig=p=>!!p&&(heftModus.demo||!!p.cutout);
const LEER={mode:'Die ersten Häuser<br><em>ziehen ein.</em>',interior:'Die ersten Objekte<br><em>kommen an.</em>',kunst:'Die ersten Arbeiten<br><em>werden gehängt.</em>'};
const kuerzen=(t,n=150)=>{const s=String(t||'').replace(/<[^>]+>/g,'');return s.length>n?s.slice(0,n).replace(/\s+\S*$/,'')+' …':s;};
const titelZeilen=h=>{
 if(h.title)return h.title.includes('<em>')?h.title:h.title.replace(/<br\s*\/?>(.*)$/,'<br><em>$1</em>');
 return h.name+'.<br><em>'+(h.quote?kuerzen(h.quote,40):'Haus '+h.number)+'</em>';
};
/** Eine liegende Bühne je Haus — aus dem, was das Haus pflegt. */
export function displayAusHaus(h,i=0){
 const stuecke=h.products.filter(id=>buehnenfaehig(products[id])).slice(0,2),erstes=products[h.products[0]];
 return {kicker:labels[h.world].toUpperCase()+' / HAUS '+h.number,title:titelZeilen(h),text:kuerzen(h.intro||h.manifesto||h.quote,170),
  action:erstes?erstes.name+' ansehen':'Das Haus besuchen',product:erstes?erstes.id:undefined,section:erstes?undefined:'haus',
  inquiry:erstes&&erstes.kind!=='produkt'?erstes.id:undefined,
  pieces:stuecke,layout:i%2?'fan':'frame',color:h.color||'#722d33',house:h.slug};
}
/** Ehrlicher Leerzustand einer Welt ohne Häuser — nie Fake-Daten. */
export function displayLeer(welt){
 return {kicker:labels[welt].toUpperCase(),title:LEER[welt],text:'Diese Welt öffnet mit den ersten Häusern. Bis dahin: Deine Linie lesen oder ein Haus eröffnen.',action:'Für Designer',section:'fuer-designer',pieces:[],layout:'fan',color:'#887861',house:null,leer:true};
}
function leeren(o){for(const k of Object.keys(o))delete o[k];}
/**
 * heftFuellen({products,houses,media,kuration}) — ersetzt Beispieldaten durch echte.
 * Erhalten bleiben hero/edit (Kuration), die Sektionen dna/konto/frag-pawn/… und alle Texte des Hefts.
 */
export function heftFuellen(heft){
 heftModus.demo=false;
 leeren(products);Object.assign(products,heft.products||{});
 leeren(houses);Object.assign(houses,heft.houses||{});
 leeren(media);Object.assign(media,heft.media||{});
 const hero=displays.hero,edit=displays.edit;leeren(displays);displays.hero=hero;displays.edit=edit;
 const haeuser=Object.values(houses).sort((a,b)=>Number(a.number)-Number(b.number)||a.name.localeCompare(b.name));
 for(const w of WELTEN){
  const eigene=haeuser.filter(h=>h.world===w&&h.products.length);
  sections[w]=eigene.length?eigene.map((h,i)=>{displays[h.slug]=displayAusHaus(h,i);return h.slug;}):[(displays['leer-'+w]=displayLeer(w),'leer-'+w)];
 }
 const stuecke=WELTEN.map(w=>Object.values(products).find(p=>p.world===w&&buehnenfaehig(p))?.id).filter(Boolean);
 displays.hero.pieces=stuecke;displays.edit.pieces=stuecke;displays.hero.house=haeuser[0]?.slug||null;
 kuration.slugs=heft.kuration?.slugs||[];kuration.title=heft.kuration?.title||'';
 for(const k of Object.keys(sections))counts[k]=sections[k].length;
 return {products:Object.keys(products).length,houses:haeuser.length};
}
/** Redaktionelle Reihe (curated_collections) — leer heißt: PAWN kuratiert nach Linie. */
export const kuration={slugs:[],title:''};
/** Die Beispieldaten als Heft-Paket — für Tests und um nach dem Füllen zurückzukehren. */
const schnappschuss=JSON.parse(JSON.stringify({products,houses,media,displays,sections}));
export function demoHeft(){return JSON.parse(JSON.stringify({demo:true,products:schnappschuss.products,houses:schnappschuss.houses,media:schnappschuss.media,kuration:null}));}
export function demoWiederherstellen(){
 heftModus.demo=true;
 leeren(products);Object.assign(products,JSON.parse(JSON.stringify(schnappschuss.products)));
 leeren(houses);Object.assign(houses,JSON.parse(JSON.stringify(schnappschuss.houses)));
 leeren(media);Object.assign(media,JSON.parse(JSON.stringify(schnappschuss.media)));
 leeren(displays);Object.assign(displays,JSON.parse(JSON.stringify(schnappschuss.displays)));
 for(const k of Object.keys(sections))delete sections[k];Object.assign(sections,JSON.parse(JSON.stringify(schnappschuss.sections)));
 for(const k of Object.keys(sections))counts[k]=sections[k].length;kuration.slugs=[];kuration.title='';
}
