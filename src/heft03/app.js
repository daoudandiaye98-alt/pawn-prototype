import {Magazine,reading,key,routeHash,parseRoute,addCart,clamp} from './model.mjs';
import {products,houses,displays,sections,labels,counts,asset,heftFuellen,ASSETS,assetBasis,buehnenfaehig} from './data.mjs';
import {createWorld} from './world.mjs';
import {readView,productView,cartView,applicationView,productCard,esc,money} from './views.mjs';
import {prepareCutouts,prepareBilder,cutouts} from './cutouts.mjs';
import {extendedView,searchToolbar,pawnChat,pawnGlyph,begleiterSaetze} from './extra-views.mjs';
import {themes,housePresentation,searchProducts,searchCount,presentationExport,houseBlocks,houseProducts} from './presentation.mjs';
import {kuratiere,kurationsNotiz} from './kuration.mjs';
import {laden,speichern,vergessen} from './store.mjs';
import {demoQuelle} from './quelle.mjs';
import {adressen} from './routen.mjs';
import {massZeile} from './store.mjs';

// ---------------------------------------------------------------------------
// startHeft(optionen) — das Heft in einer Seite aufstellen.
//   optionen.quelle   : Datenquelle (quelle.mjs). Standard: demoQuelle() — Beispieldaten, nichts geht nach außen.
//   optionen.adresse  : 'hash' (Vorschau, #/mode/1) oder 'pfad' (pawn.vision, /mode). Standard 'hash'.
//   optionen.basis    : Pfad-Präfix bei 'pfad' (z. B. ''), optional.
//   optionen.assets   : Basis der Heft-Bilder (Standard './assets/'; unter Vite z. B. '/heft/assets/').
//   optionen.zustimmung: true|false|null — Zustimmung der Hülle (ConsentProvider) vorbelegen; optional.
//   optionen.auf      : Rückrufe {navigiert(route), kauf(antwort), anfrage(ereignis), zustimmung(wert), fehler(e)} — optional.
// Rückgabe: {go, route, state, refresh, stop}. Die Hülle (React) hält die Kopf-/Fußzeile, das Heft die Bühne.
// ---------------------------------------------------------------------------
export async function startHeft(optionen={}){
const quelle=optionen.quelle||demoQuelle();
const adresse=adressen(optionen.adresse||'hash',optionen.basis||'');
const auf=optionen.auf||{};
if(optionen.assets)assetBasis(optionen.assets);
const zustimmungMelden=()=>{if(auf.zustimmung)auf.zustimmung(state.consent);};
const hoerer=[];
const hoeren=(ziel,typ,fn,opt)=>{ziel.addEventListener(typ,fn,opt);hoerer.push([ziel,typ,fn,opt]);};
// Erst die Daten, dann das Heft: Sektionen und Häuser hängen davon ab.
const heft=await quelle.heft();
if(heft&&!heft.demo)heftFuellen(heft);
const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={saved:[],cart:[],orders:[],style:'',consent:null,pawnNote:null,denkt:false,stil:{},frag:{},foto:'',presentations:{},profile:null,goal:'',measurements:{},message:'',reference:'',fitProduct:null};
// Was mit Zustimmung gespeichert wurde, kommt zurück.
{const alt=laden();if(alt&&alt.consent===true)Object.assign(state,alt,{denkt:false,message:'',reference:''});}
if(optionen.zustimmung!==undefined&&optionen.zustimmung!==null)state.consent=!!optionen.zustimmung;
const nav=new Magazine(adresse.lesen(),reduced.matches);
if(quelle.art!=='demo')state.vorschau=false;
let world,paging=null,raf=null,dirty=true,lastTime=0,uiKey='',displayKey='',speed=1,fold=1,angle=0,activeProduct=null,lastFocus=null,toastTimer,wheelSum=0,wheelTime=0,wheelLock=0,applicationStep=0,applicationValues={},pointerStart;
const drawer=$('drawer');
// Flacher Lesemodus, wenn die Doppelseite keine Fläche hätte (Handy quer, Hochformat-Tablet) oder kein 3D läuft.
const istLeser=()=>innerWidth<760||innerHeight<540||!world;
// Hochformat auf kleinen Geräten: Drehhinweis mit sichtbarem Ausweg in die gestapelte Lesespalte.
const portrait=matchMedia('(orientation: portrait) and (max-width: 900px)');
let rotateDismissed=false;
function syncRotate(){
 const show=portrait.matches&&!rotateDismissed;
 $('rotate').hidden=!show;document.body.classList.toggle('is-rotate',show);
}
$('rotate-skip').onclick=()=>{rotateDismissed=true;syncRotate();uiKey='';invalidate();};
portrait.addEventListener('change',()=>{if(!portrait.matches)rotateDismissed=false;syncRotate();});
syncRotate();
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function invalidate(){dirty=true;if(!raf){lastTime=performance.now();raf=requestAnimationFrame(frame);}}
function count(){return nav.route.section==='haus'?3:nav.route.section==='suche'?searchCount(nav.route):counts[nav.route.section];}
function rememberHash(route,ersetzen=false){adresse.schreiben(route,ersetzen);if(auf.navigiert)auf.navigiert(route);}
function closeMenu(){$('main-nav').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');}
function resetFold(){fold=1;$('fold').value='100';$('fold-value').textContent='100 %';}
let weiterTimer=null,prefetchKey='',pendingPush=true;
// Ein Seitenfenster kann aus zwei Gründen zugehen: der Mensch schließt es (dann führt die
// Adresse zurück auf die Bühne) oder die Route wechselt ohnehin (dann steht die neue Adresse schon).
let schliesstStill=false;
function go(route,push=true){
 if(route.section==='suche')route={...route,index:clamp(route.index,0,searchCount(route)-1)};
 if(drawer.open){schliesstStill=true;drawer.close();}closeMenu();resetFold();
 // Läuft gerade ein Blatt, wird die Route nur vorgemerkt; frame() startet sie, sobald das Blatt liegt.
 if(nav.status==='turn'){nav.go(route);pendingPush=push;invalidate();return;}
 const from={...nav.route};
 if(push)rememberHash(route);nav.go(route);
 if(reduced.matches){while(nav.status!=='ready')nav.tick(10);}
 else if(nav.status==='turn'&&nav.target&&reading(from)&&reading(nav.target))startPaging(from,nav.target,1);
 wheelLock=performance.now()+2200/speed;invalidate();
 // Eine Adresse kann ein Werk oder die Tasche mitbringen (/werk/<slug>, /tasche) — auch
 // mitten in der Sitzung, wenn React Router hierher navigiert. Vorher tat das nur der Start.
 if(route.werk)product(route.werk);else if(route.tasche)cart();
}
function house(slug){if(!reading(nav.route))nav.origin={...nav.route};go({section:'haus',slug,index:0});}
function returnDisplay(){go(nav.origin||{section:nav.route.section==='haus'?houses[nav.route.slug].world:'entdecken',index:0});}
function step(dir){if(drawer.open||nav.status!=='ready')return;const from={...nav.route};if(nav.step(dir,count())){resetFold();rememberHash(nav.target);wheelLock=performance.now()+2300/speed;if(reduced.matches)nav.tick(10);else if(reading(from)&&reading(nav.target))startPaging(from,nav.target,dir);invalidate();}else toast('Du bist '+(dir>0?'am Ende':'am Anfang')+' dieser Sektion.');}

// Echtes Blättern: die alte Seite bleibt auf dem Blatt, die neue liegt schon darunter.
function viewHtml(route){return extendedView(route,state)??readView(route,state);}
function themeFor(route){return route.section==='haus'?housePresentation(route.slug,state):undefined;}
function pagesOf(html){const d=document.createElement('div');d.innerHTML=html;const g=d.firstElementChild;return g&&g.children.length===2?{grid:g,left:g.children[0],right:g.children[1]}:null;}
function startPaging(from,to,dir){
 if(reduced.matches||istLeser())return;
 const a=pagesOf(viewHtml(from)),b=pagesOf(viewHtml(to));
 if(!a||!b)return;
 // Der Rahmen der Doppelseite ist schon der der Zielseite — so springt beim Landen nichts mehr.
 const altLinks=a.left,altRechts=a.right,neuLinks=b.left,neuRechts=b.right;
 if(dir>0)b.grid.replaceChild(altLinks,b.grid.children[0]);else b.grid.replaceChild(altRechts,b.grid.children[1]);
 // Eine Blattfläche, zwei Drucke. Bei 90 Grad wird umgeschaltet und gespiegelt,
 // weil backface-visibility im CSS3D-Baum nicht verlässlich greift.
 const sheet=document.createElement('div');sheet.className='leaf3d'+(dir>0?'':' rueckwaerts');
 const face=document.createElement('div');face.className='face';
 const vorne=document.createElement('div');vorne.className='blatt';vorne.append(dir>0?altRechts:altLinks);
 const hinten=document.createElement('div');hinten.className='blatt';hinten.hidden=true;hinten.append(dir>0?neuLinks:neuRechts);
 face.append(vorne,hinten);sheet.append(face);
 world.setContent('',themeFor(to)||themeFor(from));
 world.spread.classList.remove('still');
 world.spread.append(b.grid,sheet);worteSpalten(world.spread);videosLaden(world.spread);
 paging={sheet,dir,vorne,hinten,gedreht:false,ziel:key(to)};
 document.body.classList.add('is-paging');
}
function endPaging(){if(!paging)return;paging=null;landete=true;document.body.classList.remove('is-paging');}
// Nachbarseiten vorladen: Was beim nächsten Blättern gebraucht wird, liegt dann schon im Speicher.
const vorgeladen=new Set();
function quellenAus(html){
 const q=new Set();
 for(const m of html.matchAll(/(?:src|data-quelle|poster)="([^"]+)"/g))q.add(m[1]);
 for(const m of html.matchAll(/url\(([^)]+)\)/g))q.add(m[1].replace(/["']/g,''));
 return [...q].filter(u=>u.startsWith(ASSETS.basis));
}
function nachbarnVorladen(route){
 const kandidaten=[];
 const n=count();
 for(const d of [1,-1,2]){const i=route.index+d;if(i>=0&&i<n)kandidaten.push({...route,index:i});}
 if(route.section==='entdecken'||!reading(route))kandidaten.push({section:'haeuser',index:0},{section:'dna',index:0});
 const lauf=()=>{
  for(const r of kandidaten){
   let html='';try{html=viewHtml(r)||''}catch(e){continue}
   for(const u of quellenAus(html)){
    if(vorgeladen.has(u))continue;vorgeladen.add(u);
    if(/\.mp4$/.test(u)){if(!videoSpeicher.has(u))fetch(u).then(r=>r.ok?r.blob():null).then(b=>{if(b&&!videoSpeicher.has(u))videoSpeicher.set(u,URL.createObjectURL(new Blob([b],{type:'video/mp4'})));}).catch(()=>{});}
    else{const im=new Image();im.decoding='async';im.src=u;}
   }
  }
 };
 ('requestIdleCallback' in window)?requestIdleCallback(lauf,{timeout:900}):setTimeout(lauf,120);
}
// Bewegtbild wird als Blob geladen. So hängt die Wiedergabe nicht am
// Content-Type des Servers und braucht keinen Neustart.
const videoSpeicher=new Map();
async function videosLaden(wurzel){
 for(const el of wurzel.querySelectorAll('video[data-quelle]')){
  const quelle=el.dataset.quelle;
  try{
   if(!videoSpeicher.has(quelle)){
    const daten=await fetch(quelle).then(r=>{if(!r.ok)throw Error(r.status);return r.blob();});
    videoSpeicher.set(quelle,URL.createObjectURL(new Blob([daten],{type:'video/mp4'})));
   }
   el.src=videoSpeicher.get(quelle);
   el.play().catch(()=>{});
  }catch(fehler){el.remove();}
 }
 // Zwei Hälften, ein Film: die rechte folgt der linken, damit die Naht nicht springt.
 for(const g of new Set([...wurzel.querySelectorAll('video[data-gruppe]')].map(v=>v.dataset.gruppe))){
  const [a,b]=wurzel.querySelectorAll('video[data-gruppe="'+g+'"]');if(!a||!b)continue;
  const takt=()=>{if(!a.isConnected||!b.isConnected)return;if(Math.abs(a.currentTime-b.currentTime)>.06)b.currentTime=a.currentTime;requestAnimationFrame(()=>setTimeout(takt,400));};
  a.addEventListener('playing',()=>{b.currentTime=a.currentTime;b.play().catch(()=>{});takt();},{once:true});
 }
}
// Schlagzeilen steigen wortweise ein. Der Text bleibt vollständig im DOM.
function worteSpalten(wurzel){
 wurzel.querySelectorAll('h1,h2,.house-line').forEach(el=>{
  if(el.dataset.gespalten)return;el.dataset.gespalten='1';
  const gehen=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),knoten=[];
  while(gehen.nextNode())knoten.push(gehen.currentNode);
  let i=0;
  for(const n of knoten){
   if(!n.textContent.trim())continue;
   const frag=document.createDocumentFragment();
   for(const teil of n.textContent.split(/(\s+)/)){
    if(!teil)continue;
    if(!teil.trim()){frag.append(teil);continue;}
    const aussen=document.createElement('span');aussen.className='wort';
    const innen=document.createElement('span');innen.textContent=teil;
    innen.style.animationDelay=(.12+i++*.055)+'s';
    aussen.append(innen);frag.append(aussen);
   }
   n.replaceWith(frag);
  }
 });
}
// Fokus über ein Neuzeichnen hinweg halten: wir merken uns, was den Fokus hatte, und suchen es danach wieder.
function fokusMerken(){const a=document.activeElement;if(!a||a===document.body)return null;
 for(const attr of ['data-wahl','data-frag','data-fit','data-page','data-route','name','data-block-toggle','data-prod-toggle'])if(a.hasAttribute(attr))return '['+attr+'="'+a.getAttribute(attr).replace(/"/g,'\\"')+'"]';return null;}
function fokusZurueck(sel){if(!sel)return;requestAnimationFrame(()=>{const el=(world?world.spread:document).querySelector(sel)||document.querySelector(sel);if(el&&document.activeElement===document.body)el.focus({preventScroll:true});});}
// still=true: Zustand nachzeichnen, ohne die Einstiegs-Choreografie der Seite noch einmal abzuspielen.
function readRefresh(still=true){speichern(state);chatRefresh();
 if(world&&reading(nav.route)){
  const html=extendedView(nav.route,state)??readView(nav.route,state),theme=nav.route.section==='haus'?housePresentation(nav.route.slug,state):undefined;
  const fokus=fokusMerken();
  world.spread.classList.toggle('still',still);$('mobile-reader').classList.toggle('still',still);
  world.setContent(html,theme);worteSpalten(world.spread);videosLaden(world.spread);
  if(istLeser()){$('mobile-reader').innerHTML=html;worteSpalten($('mobile-reader'));videosLaden($('mobile-reader'));
   if(['konto','dna'].includes(nav.route.section)&&nav.route.index===0){const grid=$('mobile-reader').firstElementChild;if(grid&&grid.children.length>1)grid.append(grid.firstElementChild);}}
  else $('mobile-reader').innerHTML='';
  fokusZurueck(fokus);
  const vars=theme||{paper:'#f9f7f2',ink:'#252421',accent:'#733039',font:'Playfair'};
  for(const [k,v]of Object.entries(vars))$('mobile-reader').style.setProperty('--house-'+k,v);
 }invalidate();
}
function showDrawer(html){
 if(!drawer.open)lastFocus=document.activeElement;
 $('drawer-content').innerHTML=html;
 if(!drawer.open)drawer.showModal();
 drawer.scrollTop=0;invalidate();
}
// Ein geöffnetes Werk hat seine eigene Adresse (/werk/<slug>): Teilen, Zurück-Taste und die
// Produktangaben für Suchmaschinen hängen daran. Steht sie schon (Aufruf von außen), wird nicht
// noch einmal geschrieben.
function product(id){if(!products[id])return;activeProduct=id;
 const mitWerk={...nav.route,werk:id};
 if(!adresse.gleich(mitWerk))rememberHash(mitWerk);
 nav.route.werk=id;
 showDrawer(productView(products[id],state));quelle.signal('ansehen',{product:products[id]});}
function cart(){activeProduct=null;showDrawer(cartView(state));}
function account(){go({section:'konto',index:0});}
function saved(){go({section:'konto',index:1});}
function search(){go({section:'suche',index:0});}
function inquiry(id){
 const p=products[id];showDrawer('<p class="eyebrow">ANFRAGE AN '+houses[p.house].name+'</p><h2 id="dialog-title">'+p.name+'</h2><p>Erzähle dem Haus, was du dir vorstellst.</p><form data-inquiry-form><label>Deine E-Mail<input type="email" name="email" required></label><label>Deine Nachricht<textarea name="message" rows="6" minlength="15" required placeholder="Wunsch, Format oder eine Frage zur Arbeit"></textarea></label><button class="solid" type="submit">Anfrage prüfen</button></form><p class="small-note">In dieser Vorschau wird keine Nachricht verschickt.</p>');
}
function apply(){applicationStep=0;showDrawer(applicationView(applicationStep,applicationValues));}
const BLOCK_NAMEN={auftakt:'Auftakt',editorial_text:'Geschichte',zitat:'Zitat',produktreihe:'Arbeiten',lookbook_streifen:'Lookbook',banner_seitlich:'Banner seitlich',banner_vollbreite:'Banner vollbreite',ueberlappend:'Überlagert'};
function studioState(slug){
 const h=houses[slug];
 const s=state.presentations[slug]||(state.presentations[slug]={});
 if(!s.blocks)s.blocks=houseBlocks(slug,state).map(b=>({kind:b.kind,on:true}));
 if(!s.products)s.products=[...h.products];
 return s;
}
function studio(slug=nav.route.section==='haus'?nav.route.slug:Object.keys(houses)[0]){
 if(!houses[slug])return;
 const h=houses[slug],t=housePresentation(slug,state),eigen=studioState(slug);
 const bloecke=eigen.blocks.map((b,i)=>'<li'+(b.on?'':' class="aus"')+'><button type="button" data-block-toggle="'+i+'" aria-pressed="'+(b.on?'true':'false')+'">'+(b.on?'●':'○')+'</button><span>'+(BLOCK_NAMEN[b.kind]||b.kind)+'</span><button type="button" data-block-up="'+i+'" '+(i===0?'disabled':'')+' aria-label="nach oben">↑</button><button type="button" data-block-down="'+i+'" '+(i===eigen.blocks.length-1?'disabled':'')+' aria-label="nach unten">↓</button></li>').join('');
 const arbeiten=Object.values(products).filter(p=>p.house===slug||h.products.includes(p.id)).map(p=>'<button type="button" class="werk-wahl'+(eigen.products.includes(p.id)?' an':'')+'" data-prod-toggle="'+p.id+'"><img src="'+p.image+'" alt=""><span>'+p.name+'</span></button>').join('');
 showDrawer('<p class="eyebrow">DAS STUDIO / '+h.name+'</p><h2 id="dialog-title">Dein Haus.<br>Deine Handschrift.</h2>'
 +'<p>Alles hier verändert deine Doppelseite sofort. Was du behältst, wandert beim Export in den bestehenden Themen- und Blockvertrag.</p>'
 +'<form data-presentation-form data-slug="'+slug+'">'
 +'<label>Gestaltungsrichtung<select name="theme">'+Object.entries(themes).map(([k,v])=>'<option value="'+k+'" '+(t.theme===k?'selected':'')+'>'+v.label+'</option>').join('')+'</select></label>'
 +'<div class="theme-swatches">'+Object.entries(themes).map(([k,v])=>'<span style="background:'+v.paper+';color:'+v.accent+'">Aa<small>'+v.label+'</small></span>').join('')+'</div>'
 +'<label>Headline<input name="title" maxlength="75" required value="'+esc(t.title||h.title.replace(/<br>/g,' '))+'"></label>'
 +'<label>Schrift<select name="font">'+[['Playfair','Editorial · Playfair'],['Inter','Archiv · Inter'],['Georgia','Zart · Georgia']].map(([k,v])=>'<option value="'+k+'" '+(t.font===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'
 +'<label>Schaufenster<select name="architecture">'+[['arch','Bogen & Vorhang'],['frame','Offene Galerie'],['fan','Gefaltete Kulisse']].map(([k,v])=>'<option value="'+k+'" '+(t.architecture===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'
 +'<div class="farbpaar"><label>Papier<input type="color" name="paper" value="'+t.paper+'"></label><label>Akzent<input type="color" name="accent" value="'+t.accent+'"></label></div>'
 +'<p class="feld-titel">Blockfolge</p><ol class="block-liste">'+bloecke+'</ol>'
 +'<p class="feld-titel">Arbeiten im Schaufenster</p><div class="werk-wahl-reihe">'+arbeiten+'</div>'
 +'<button class="solid">Meine Doppelseite ansehen ↗</button></form>'
 +'<button class="outline" data-export-house="'+slug+'">Gestaltungsentwurf exportieren</button>'
 +'<p class="small-note">Demo an DRAPÉ: Reihenfolge, Sichtbarkeit und Auswahl werden als position und productIds exportiert.</p>');
}
function studioAnwenden(slug,{navigieren=false}={}){
 if(world)world.updateHouse(slug,housePresentation(slug,state));
 if(nav.route.section==='haus'&&nav.route.slug===slug){displayKey='';readRefresh();}
 else if(navigieren)house(slug);
}
// Ein hochgeladenes Bild zeigt sich sofort als kleines Polaroid neben dem Knopf — nicht als Dateiname.
let polaroidUrl=null;
function polaroid(datei,anker){
 if(!anker)return;const alt=anker.parentElement.querySelector('.polaroid');if(alt)alt.remove();
 if(polaroidUrl){URL.revokeObjectURL(polaroidUrl);polaroidUrl=null;}
 if(!datei||!datei.type.startsWith('image/'))return;
 polaroidUrl=URL.createObjectURL(datei);
 const img=document.createElement('img');img.className='polaroid';img.src=polaroidUrl;img.alt='Dein Bild';anker.insertAdjacentElement('afterend',img);
}
// Der Bauer im Raum: das kleine Gesprächsfenster und die wechselnden Blasen.
let blasenTimer=null,blasenIndex=0;
function chatRefresh(){const box=$('pawn-chat');if(box.hidden)return;const fokus=document.activeElement;const wert=fokus&&fokus.name==='message'?fokus.value:null;box.innerHTML=pawnChat(state);if(wert!=null){const t=box.querySelector('textarea[name="message"]');if(t){t.value=wert;}}}
function chat(){
 // Auf der Frag-PAWN-Seite lebt das Gespräch schon auf dem Papier — dorthin, statt ein zweites zu öffnen.
 if(nav.route.section==='frag-pawn'&&nav.status==='ready'){const ziel=(istLeser()?$('mobile-reader'):world.spread).querySelector('.chip,textarea[name="message"]');if(ziel){ziel.focus({preventScroll:true});blaseWeg();return;}}
 const box=$('pawn-chat');box.hidden=false;chatRefresh();$('begleiter-knopf').setAttribute('aria-expanded','true');blaseWeg();const t=box.querySelector('textarea');if(t&&innerWidth>760)t.focus({preventScroll:true});}
// Einmal fragen, ob PAWN sich etwas merken darf — genau dann, wenn es zum ersten Mal etwas zu merken gäbe.
function zustimmungFragen(){
 if(state.consent!==null)return;
 const b=$('begleiter-blase');clearTimeout(blasenTimer);
 b.innerHTML='<b>PAWN</b>Darf ich mir das merken? Dann ist es beim nächsten Öffnen noch da.<span class="blase-knoepfe"><button class="chip" data-consent-ja>Ja, merk es dir</button><button class="chip leise" data-consent-nein>Nur jetzt</button></span>';
 b.classList.add('da');
}
function chatSchliessen(){$('pawn-chat').hidden=true;$('begleiter-knopf').setAttribute('aria-expanded','false');}
function blaseWeg(){$('begleiter-blase').classList.remove('da');}
function begleiterKontext(){const r=nav.route;if(!reading(r))return r.section==='entdecken'&&r.index===0?'hero':'stage';return r.section==='dna'?'dna':'lesen';}
function begleiterTakt(){
 clearTimeout(blasenTimer);
 const zeigen=()=>{
  if(nav.status!=='ready'||!$('pawn-chat').hidden||drawer.open||document.body.classList.contains('is-rotate')||$('begleiter-blase').querySelector('[data-consent-ja]')){blasenTimer=setTimeout(zeigen,4000);return;}
  const liste=begleiterSaetze[begleiterKontext()];const text=liste[blasenIndex++%liste.length];
  const b=$('begleiter-blase');b.innerHTML='<b>PAWN</b>'+text;b.classList.add('da');
  blasenTimer=setTimeout(()=>{blaseWeg();blasenTimer=setTimeout(zeigen,9000);},5200);
 };
 blasenTimer=setTimeout(zeigen,2600);
}
$('begleiter-knopf').innerHTML=pawnGlyph('klein');
async function checkout(slug){
 const zeilen=slug?state.cart.filter(r=>products[r.id]&&products[r.id].house===slug):state.cart;
 const antwort=await quelle.kasse({cart:zeilen,products,email:state.profile?.email,locale:'de'});
 if(antwort?.url){if(auf.kauf)auf.kauf(antwort);location.assign(antwort.url);return;}
 if(antwort?.fehler&&antwort.fehler!=='vorschau'){showDrawer('<p class="eyebrow">DEINE TASCHE / KASSE</p><h2 id="dialog-title">Noch nicht.</h2><p>'+esc(antwort.text||'Die Kasse ist gerade nicht erreichbar.')+'</p>'+((antwort.fehlt||[]).length?'<p class="small-note">Dem Haus fehlt: '+antwort.fehlt.map(esc).join(', ')+'.</p>':'')+'<button class="solid" data-cart>Zurück zur Tasche</button>');return;}
 showDrawer('<p class="eyebrow">DEINE AUSWAHL / KASSE</p><h2 id="dialog-title">Ein letzter Blick.</h2>'+zeilen.map(r=>'<div class="cart-total"><span>'+products[r.id].name+(r.size?' · '+r.size:'')+' × '+r.qty+'</span><strong>'+money(products[r.id].price*r.qty)+'</strong></div>').join('')+'<div class="cart-total"><span>Gesamt</span><strong>'+money(zeilen.reduce((n,r)=>n+products[r.id].price*r.qty,0))+'</strong></div><p>Jedes Haus verkauft selbst — darum eine Zahlung pro Haus. Adresse, Versand und Zahlung folgen im nächsten Schritt.</p><button class="solid" data-cart>Zurück zur Tasche</button><p class="small-note">Vorschau — es wird nichts bestellt, nichts gesendet.</p>');
}

// Ein freier Satz geht an die Quelle (pawn-chat); antwortet sie nicht, bleibt der Regelsatz des Hefts.
async function fragen(text){
 const kontext={route:nav.route.section==='frag-pawn'?'/frag-pawn':'/heft',seite:key(nav.route),stil:state.stil,frag:state.frag,product_slug:activeProduct?products[activeProduct]?.slug:undefined};
 let antwort=null;
 try{antwort=await quelle.chat({messages:[{role:'user',content:text}],kontext});}catch(e){antwort=null;}
 if(state.message!==text)return;
 state.denkt=false;
 if(antwort&&antwort.reply)state.antwort={zu:text,reply:antwort.reply,treffer:antwort.treffer||[]};
 readRefresh();
}
// Anfrage an ein Haus: ohne Konto gibt es den Zutritt zuerst, mit Konto einen Faden im Postfach des Hauses.
async function anfrageSenden(data){
 const p=products[activeProduct]||Object.values(products).find(x=>x.kind!=='produkt')||Object.values(products)[0];
 const antwort=await quelle.anfrage({product:p,text:data.message,kontakt:data.email});
 if(antwort?.anmelden){showDrawer('<p class="eyebrow">ZUTRITT</p><h2 id="dialog-title">Trag dich ein.</h2><p>Anfragen an ein Haus laufen über dein Konto — so bleibt das Gespräch bei dir.</p><button class="solid" data-konto>Konto anlegen ↗</button>');return;}
 if(antwort?.ok===false){toast(antwort.fehler||'Die Anfrage kam nicht durch.');return;}
 const vorschau=antwort?.vorschau;
 showDrawer('<p class="eyebrow">DEINE ANFRAGE'+(vorschau?' / VORSCHAU':'')+'</p><h2 id="dialog-title">'+(vorschau?'Bereit zum Gespräch.':'Unterwegs zum Haus.')+'</h2><p>'+esc(data.email||state.profile?.email||'')+'</p><blockquote>'+esc(data.message)+'</blockquote>'+(vorschau?'<p class="small-note">Nur eine Prüfung der Ansicht. Es wurde keine Nachricht gesendet.</p>':'<p class="small-note">Das Haus antwortet in dein Postfach unter Mein PAWN.</p>')+'<button class="outline" data-house="'+p.house+'">Das Haus kennenlernen ↗</button>');
 if(auf.anfrage)auf.anfrage({product:p,antwort});
}
// Bewerbung: die sechs Schritte des Hefts → Felder von submit-application.
async function bewerbungSenden(){
 const v=applicationValues,werte={email:v.email,password:v.password,displayName:v.name,brandName:v.brand||v.brandName,legalName:v.legalName,location:v.location,country:v.country,website:v.website,instagram:v.instagram,story:v.story,tags:[v.world].filter(Boolean),productionStatus:v.production,acceptedContractIds:v.contracts?[v.contracts]:[]};
 const antwort=await quelle.bewerbung(werte);
 if(antwort?.vorschau){showDrawer('<p class="eyebrow">BEWERBUNG / GESTALTUNGSVORSCHAU</p><h2 id="dialog-title">Ein neues Kapitel.</h2><p>Du hast den Bewerbungsablauf vollständig durchgespielt. Deine Angaben wurden nicht eingereicht.</p><button class="solid" data-route="fuer-designer">Zurück zu Für Designer ↗</button>');return;}
 if(!antwort?.ok){toast(antwort?.fehler||antwort?.error||'Die Bewerbung kam nicht durch.');return;}
 showDrawer('<p class="eyebrow">BEWERBUNG</p><h2 id="dialog-title">Ein neues Kapitel.</h2><p>Deine Bewerbung ist da.'+(antwort.needs_email_confirmation?' Bestätige noch deine E-Mail — der Link ist unterwegs.':'')+'</p><button class="solid" data-route="fuer-designer">Zurück zu Für Designer ↗</button>');
}
// Konto & Gedächtnis aus der Quelle (eingeloggt) über das Gerätegedächtnis legen.
async function kontoLaden(){
 try{
  const k=await quelle.konto.aktuell();
  if(!k)return;
  state.profile={name:k.name,email:k.email,id:k.id};if(state.consent===null)state.consent=true;
  const [merk,stil,masse,orders]=await Promise.all([quelle.merkliste.laden(),quelle.stil.laden(),quelle.masse.laden(),quelle.konto.bestellungen?quelle.konto.bestellungen():[]]);
  if(Array.isArray(orders))state.orders=orders;
  if(Array.isArray(merk))state.saved=[...new Set([...merk.filter(id=>products[id]),...state.saved])];
  if(stil&&stil.stil&&Object.keys(stil.stil).length){state.stil={...stil.stil,...state.stil};if(stil.fuerWen)state.measurements.fuerWen=state.measurements.fuerWen||stil.fuerWen;}
  if(masse)for(const [k2,v] of Object.entries(masse))if(v!=null&&state.measurements[k2]===undefined)state.measurements[k2]=String(v);
  updateCart();if(reading(nav.route))readRefresh();
 }catch(e){if(auf.fehler)auf.fehler(e);}
}
let landete=false;
function sync(){
 const route=nav.route,ready=nav.status==='ready',isRead=reading(route),id=isRead?'':sections[route.section][route.index];
 if(!paging&&displayKey!==key(route)){
  displayKey=key(route);
  $('search-toolbar').hidden=route.section!=='suche';
  if(route.section==='suche')$('search-toolbar').innerHTML=searchToolbar(route);
  if(isRead){readRefresh(!!landete);$('mobile-reader').scrollTop=0;}
  else {
   const stuecke=kuratiere(id,state);world.display(id,stuecke);const c=displays[id];
   $('kicker').textContent=c.kicker;$('scene-title').innerHTML=c.title;$('description').textContent=c.text;$('scene-action').innerHTML=c.action+' <span>↗</span>';
   $('note-text').textContent=id==='hero'?'DEIN ZUG · Tipp eine Welt an':id==='edit'?(state.stil?.richtung?'Nach deiner Linie: '+state.stil.richtung+(state.stil.form?' & '+state.stil.form:''):'Bis PAWN dich kennt: was gerade auf der Bühne steht'):kurationsNotiz(id,state);
   $('scene-action').hidden=id==='hero';
   // Im Hero schweben die Welten vor den Stücken; sonst öffnet das Plus das Stück.
   $('hotspots').innerHTML=stuecke.map(pid=>id==='hero'
    ?'<button class="hotspot welt" data-route="'+products[pid].world+'" aria-label="'+labels[products[pid].world]+' entdecken"><span>'+labels[products[pid].world]+'</span><i aria-hidden="true">→</i></button>'
    :'<button class="hotspot" data-product="'+pid+'" data-title="'+products[pid].name+'" aria-label="'+products[pid].name+' ansehen">+</button>').join('');
   document.body.classList.toggle('is-hero',id==='hero');
  }
  if(!$('begleiter-blase').querySelector('[data-consent-ja]')){blaseWeg();begleiterTakt();}landete=false;
 }
 if(ready&&prefetchKey!==key(route)){prefetchKey=key(route);nachbarnVorladen(route);}
 const opening=nav.status==='intro'&&nav.progress>.34;
 const nextUI=[key(route),nav.status,opening,innerWidth<760,fold<.9].join('|');
 if(nextUI===uiKey)return;uiKey=nextUI;
 document.body.classList.toggle('is-intro',nav.status==='intro');document.body.classList.toggle('is-opening',opening);document.body.classList.toggle('is-turning',nav.status==='turn');document.body.classList.toggle('is-reading',isRead);
 document.body.dataset.section=route.section;document.body.dataset.page=String(route.index+1);document.body.dataset.motion=nav.status;
 $('editorial').inert=!ready||isRead||fold<.9;$('editorial').setAttribute('aria-hidden',String($('editorial').inert));
 $('hotspots').inert=!ready||isRead||fold<.9;$('hotspots').style.opacity=fold<.9?'0':'';
 $('skip').hidden=nav.status!=='intro';$('intro-caption').hidden=nav.status!=='intro';
 $('mobile-reader').hidden=!(isRead&&ready&&innerWidth<760);
 $('return-display').textContent='← Zur Bühne';
 $('reading-label').textContent=route.section==='haus'?'HAUS '+houses[route.slug].number+' / '+houses[route.slug].name:labels[route.section].toUpperCase();
 $('section-label').textContent=route.section==='haus'?houses[route.slug].name:labels[route.section];
 $('counter').textContent=String(route.index+1).padStart(2,'0')+' / '+String(count()).padStart(2,'0');
 $('previous').disabled=!ready||route.index===0;$('next').disabled=!ready||route.index===count()-1;
 $('scroll-hint').textContent=route.index===count()-1?'Letzte Seite · Der Zug führt weiter':isRead&&istLeser()?'Seite lesen · Mit den Pfeilen weiterblättern':'Scrollen, um zu blättern →';
 $('fold').disabled=!ready||isRead;$('angle').disabled=isRead;$('replay').disabled=nav.status==='turn';
 $('page-dots').innerHTML=Array.from({length:count()},(_,i)=>'<button data-page="'+i+'" aria-label="Doppelseite '+(i+1)+'" '+(i===route.index?'aria-current="page"':'')+' '+(!ready?'disabled':'')+'></button>').join('');
 document.querySelectorAll('#main-nav [data-route]').forEach(b=>{const active=b.dataset.route===route.section||(route.section==='haus'&&b.dataset.route==='haeuser');b.toggleAttribute('aria-current',active);if(active)b.setAttribute('aria-current','page');});
}
function frame(now){
 if(!world){raf=null;return;}const dt=Math.min((now-lastTime)/1000,.2);lastTime=now;
 if(!drawer.open)nav.tick(dt,speed);
 if(paging&&nav.status==='turn'&&nav.target&&paging.ziel!==key(nav.target)){
  // Das alte Blatt ist gelandet, ein vorgemerktes beginnt: sauber neu aufsetzen.
  endPaging();if(pendingPush)rememberHash(nav.target);
  if(reading(nav.from)&&reading(nav.target))startPaging(nav.from,nav.target,1);
 }
 if(paging){
  if(nav.status!=='turn')endPaging();
  else{
   const l=nav.pose().leaf;
   paging.sheet.style.transform='perspective(2200px) rotateY('+(paging.dir>0?-180:180)*l+'deg)';
   const um=l>=.5;
   if(um!==paging.gedreht){paging.gedreht=um;paging.vorne.hidden=um;paging.hinten.hidden=!um;paging.sheet.classList.toggle('gedreht',um);}
  }
 }
 sync();
 world.render(nav.pose(),{angle,manualFold:fold,interactive:nav.status==='ready',search:nav.route.section==='suche',paging:!!paging});
 if(!reading(nav.route)&&nav.status==='ready'){const hero=document.body.classList.contains('is-hero');world.hotspots(hero).forEach(p=>{const b=$('hotspots').querySelector('[data-product="'+p.id+'"],[data-route="'+products[p.id].world+'"]');if(b){b.style.left=p.x+'px';b.style.top=(hero?Math.max(p.y,118):p.y)+'px';}});}
 dirty=false;
 raf=nav.status!=='ready'&&!drawer.open?requestAnimationFrame(frame):null;
}
hoeren(document,'click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.route){go({section:b.dataset.route,index:0});return;}
 if(b.dataset.goto){const [sec,idx]=b.dataset.goto.split(':');if(b.dataset.welt){state.stil.welt=b.dataset.welt;}if(b.dataset.stueck){state.fitProduct=b.dataset.stueck;}go({section:sec,index:isNaN(Number(idx))?(sections[sec]||[]).indexOf(idx):Number(idx)});return;}
 if(b.dataset.groesse){const r=b.closest('#drawer-content')?.querySelector('input[name="size"][value="'+b.dataset.groesse+'"]');if(r){r.checked=true;toast('Größe '+b.dataset.groesse+' gesetzt.');}return;}
 if(b.dataset.house){house(b.dataset.house);return;}
 if(b.dataset.product){if(nav.status==='ready'||drawer.open)product(b.dataset.product);return;}
 if(b.dataset.page!==undefined){go({...nav.route,index:Number(b.dataset.page)});return;}
 if(b.hasAttribute('data-return'))returnDisplay();
 if(b.dataset.save){zustimmungFragen();const id=b.dataset.save;state.saved=state.saved.includes(id)?state.saved.filter(s=>s!==id):[...state.saved,id];quelle.merkliste.setzen(id,state.saved.includes(id)).catch(()=>{});quelle.signal('merken',{product:products[id],an:state.saved.includes(id)});b.textContent=state.saved.includes(id)?'♥ Gemerkt':'♡ Stück merken';readRefresh();toast(state.saved.includes(id)?'Gemerkt. Du findest es unter Mein PAWN — und ich lese es als Beleg.':'Aus deiner Merkliste entfernt.');}
 if(b.hasAttribute('data-pawn')){state.pawnNote=state.pawnNote==null?0:(state.pawnNote+1)%3===0?null:state.pawnNote+1;readRefresh();return;}
 if(b.dataset.wahl){const [feld,wert]=b.dataset.wahl.split(':');const neu=state.stil[feld]!==wert;state.stil[feld]=neu?wert:'';
  const formular=b.closest('form[data-measure-form]');if(formular)Object.assign(state.measurements,Object.fromEntries(new FormData(formular)));
  if(feld==='richtung')zustimmungFragen();
  if(feld==='richtung'||feld==='form')quelle.stil.speichern(state.stil,{},state.measurements.fuerWen||'').catch(()=>{});quelle.signal('quiz',{feld,wert:state.stil[feld],stil:{...state.stil}});
  if(feld==='welt'&&neu){state.stil.richtung='';state.stil.form='';state.fitProduct=null;}
  if(feld==='richtung'&&neu){state.fitProduct=null;}
  readRefresh();
  // Das Quiz blättert von selbst weiter — kurz genug, dass die Wahl noch sichtbar ist.
  if(neu&&b.dataset.weiter!==undefined){clearTimeout(weiterTimer);weiterTimer=setTimeout(()=>go({...nav.route,index:Number(b.dataset.weiter)}),620);}
  return;}
 if(b.dataset.frag){const [feld,wert]=b.dataset.frag.split(':');const neu=state.frag[feld]!==wert;state.frag[feld]=neu?wert:'';
  if(feld==='was'){state.frag.anlass='';state.frag.rahmen='';state.message='';}
  if(feld==='anlass'){state.frag.rahmen='';state.message='';}
  readRefresh();return;}
 if(b.dataset.inquiry)inquiry(b.dataset.inquiry);
 if(b.dataset.remove){const [id,size]=b.dataset.remove.split('|');state.cart=state.cart.filter(r=>r.id!==id||r.size!==size);cart();updateCart();}
 if(b.hasAttribute('data-checkout'))checkout(b.dataset.checkout||undefined);
 if(b.hasAttribute('data-cart'))cart();
 if(b.hasAttribute('data-apply'))apply();
 if(b.hasAttribute('data-apply-back')){applicationStep--;showDrawer(applicationView(applicationStep,applicationValues));}
 if(b.hasAttribute('data-studio'))studio(b.dataset.studio||undefined);
 if(b.hasAttribute('data-saved'))saved();
 if(b.hasAttribute('data-chat')||b.hasAttribute('data-pawn-chat')){if(b.hasAttribute('data-pawn-chat')&&!$('pawn-chat').hidden)chatSchliessen();else chat();return;}
 if(b.hasAttribute('data-chat-schliessen')){chatSchliessen();return;}
 if(b.hasAttribute('data-consent-ja')){state.consent=true;speichern(state);zustimmungMelden();blaseWeg();toast('PAWN merkt sich das — auf diesem Gerät.');readRefresh();begleiterTakt();return;}
 if(b.hasAttribute('data-consent-nein')){state.consent=false;vergessen();zustimmungMelden();blaseWeg();begleiterTakt();return;}
 if(b.hasAttribute('data-konto')){chatSchliessen();go({section:'konto',index:0});return;}
 if(b.hasAttribute('data-clear-memory')){vergessen();state.style='';state.saved=[];state.goal='';state.pawnNote=null;state.stil={};state.frag={};state.foto='';state.message='';state.measurements={};state.fitProduct=null;state.reference='';state.consent=false;readRefresh();toast('Vorschau-Erinnerungen gelöscht.');}
 if(b.hasAttribute('data-export')){const blob=new Blob([JSON.stringify({scope:'PAWN Gestaltungsvorschau',style:state.style,goal:state.goal,measurements:state.measurements,saved:state.saved,consent:state.consent},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='pawn-vorschau-dna.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast('Deine Vorschau-DNA wurde exportiert.');}
 if(b.hasAttribute('data-reset-search'))go({section:'suche',index:0});
 if(b.hasAttribute('data-logout')){state.profile=null;quelle.konto.abmelden().catch(()=>{});readRefresh();toast('Abgemeldet.');}
 if(b.hasAttribute('data-dna-privacy'))go({section:'dna',index:7});
 if(b.hasAttribute('data-search-chat'))go({section:'suche',index:0});
 if(b.dataset.prompt){const [was,anlass,rahmen,satz]=b.dataset.prompt.split('|');state.frag={was,anlass,rahmen};state.message=satz||'';state.denkt=false;readRefresh();return;}
 if(b.dataset.fit){state.fitProduct=b.dataset.fit;readRefresh();}
 if(b.dataset.styleCheck){state.fitProduct=b.dataset.styleCheck;go({section:'dna',index:5});}
 if(b.dataset.blockUp!==undefined||b.dataset.blockDown!==undefined||b.dataset.blockToggle!==undefined){
  const slug=b.closest('[data-slug]').dataset.slug,st=studioState(slug),L=st.blocks;
  if(b.dataset.blockToggle!==undefined){const i=+b.dataset.blockToggle;L[i].on=!L[i].on;}
  else{const i=+(b.dataset.blockUp??b.dataset.blockDown),j=b.dataset.blockUp!==undefined?i-1:i+1;[L[i],L[j]]=[L[j],L[i]];}
  studio(slug);studioAnwenden(slug);return;
 }
 if(b.dataset.prodToggle){
  const slug=b.closest('[data-slug]').dataset.slug,st=studioState(slug),id=b.dataset.prodToggle;
  st.products=st.products.includes(id)?st.products.filter(x=>x!==id):[...st.products,id];
  if(!st.products.length)st.products=[id];
  studio(slug);studioAnwenden(slug);return;
 }
 if(b.dataset.exportHouse){downloadJSON('pawn-'+b.dataset.exportHouse+'-gestaltung.json',presentationExport(b.dataset.exportHouse,state));toast('Gestaltungsentwurf exportiert.');}

});
hoeren(document,'submit',e=>{
 const f=e.target;e.preventDefault();const data=Object.fromEntries(new FormData(f));
 if(f.hasAttribute('data-cart-form')){try{state.cart=addCart(state.cart,products[f.dataset.id],data.size);updateCart();toast('In der Tasche.');}catch(error){toast(error.message);}return;}
 if(f.hasAttribute('data-style-form')){state.style=data.style;readRefresh();toast('Gemerkt. Ich lese es als Hinweis.');}
 if(f.hasAttribute('data-search-form')){const route={section:'suche',index:0};for(const k of ['q','world','house','max','sort','available'])if(data[k])route[k]=String(data[k]);if(key(route)===key(nav.route)){displayKey='';invalidate();}else go(route);}
 if(f.hasAttribute('data-profile-form')){if(quelle.art!=='demo'){quelle.konto.anmelden();return;}state.profile={name:data.name,email:data.email};if(state.consent===null)state.consent=true;speichern(state);readRefresh();toast('Willkommen, '+data.name+'. PAWN merkt sich das auf diesem Gerät.');}
 if(f.hasAttribute('data-goal-form')){state.goal=data.goal;readRefresh();toast('Deine Richtung ist vorgemerkt.');}
 if(f.hasAttribute('data-measure-form')){state.measurements={...state.measurements,...data};zustimmungFragen();quelle.masse.speichern(massZeile(state.measurements,state.stil)).catch(()=>{});readRefresh();toast(f.hasAttribute('data-raum')?'Gespeichert. Jede Empfehlung wird jetzt räumlich geprüft.':'Gespeichert. Jedes Stück wird jetzt gegen deine Maße geprüft.');}
if(f.hasAttribute('data-foto-form'))return;
 if(f.hasAttribute('data-conversation-form')){state.message=data.message;state.denkt=true;state.antwort=null;readRefresh();fragen(data.message);}
 if(f.hasAttribute('data-presentation-form')){
  const slug=f.dataset.slug,st=studioState(slug);
  Object.assign(st,{theme:data.theme,title:data.title,architecture:data.architecture,accent:data.accent,paper:data.paper,font:data.font});
  world.updateHouse(slug,housePresentation(slug,state));
  if(nav.route.section==='haus'&&nav.route.slug===slug&&nav.route.index===0){displayKey='';readRefresh();drawer.close();}else house(slug);
  toast('Dein Haus trägt jetzt diese Handschrift.');
 }
 if(f.hasAttribute('data-inquiry-form')){anfrageSenden(data);return;}
 if(f.hasAttribute('data-application')){const {portfolioFiles,...textValues}=data;applicationValues={...applicationValues,...textValues};if(applicationStep<5){applicationStep++;showDrawer(applicationView(applicationStep,applicationValues));}else bewerbungSenden();}
});

hoeren(document,'change',e=>{
 const pf=e.target.closest('[data-presentation-form]');
 if(pf){
  const f=e.target.form;
  if(e.target.name==='theme'){const preset=themes[e.target.value];f.elements.accent.value=preset.accent;f.elements.paper.value=preset.paper;f.elements.architecture.value=preset.architecture;f.elements.font.value=preset.font;}
  const d=Object.fromEntries(new FormData(f)),slug=pf.dataset.slug,st=studioState(slug);
  Object.assign(st,{theme:d.theme,title:d.title,architecture:d.architecture,accent:d.accent,paper:d.paper,font:d.font});
  studioAnwenden(slug);
 }
 if(e.target.hasAttribute('data-foto')){state.foto=e.target.files?.[0]?.name||'';
  const feld=e.target.closest('.reference-upload');
  if(feld){feld.classList.toggle('hat-datei',!!state.foto);const t=feld.childNodes[1];if(t)t.textContent=state.foto?'Foto liegt vor':'Foto hinzufügen';const i=feld.querySelector('i');if(i)i.textContent=state.foto?'✓':'+';}
  polaroid(e.target.files?.[0],feld);zustimmungFragen();
  toast(state.foto?'Foto ausgewählt. Es bleibt auf deinem Gerät.':'Foto entfernt.');}
 if(e.target.hasAttribute('data-reference')){state.reference=e.target.files?.[0]?.name||'';polaroid(e.target.files?.[0],e.target.closest('.reference-upload'));
  // Der Knopf quittiert sofort — ohne die Seite neu zu setzen, damit der Entwurf im Feld bleibt.
  const feld=e.target.closest('.reference-upload');
  if(feld){feld.classList.toggle('hat-datei',!!state.reference);
   const beschriftung=feld.childNodes[1];
   if(beschriftung)beschriftung.textContent=state.reference?state.reference.slice(0,26):'Referenz hinzufügen';}
  toast(state.reference?'Referenz ausgewählt. Sie wird nicht hochgeladen.':'Referenz entfernt.');}
 if(e.target.hasAttribute('data-consent')){state.consent=e.target.checked;if(!state.consent)vergessen();else speichern(state);zustimmungMelden();toast(state.consent?'PAWN merkt sich das — auf diesem Gerät.':'PAWN vergisst alles nach dem Schließen.');readRefresh();}
});
function downloadJSON(name,value){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function updateCart(){$('cart-count').textContent=state.cart.reduce((n,r)=>n+r.qty,0);}
$('menu-toggle').onclick=()=>{const open=$('main-nav').classList.toggle('open');$('menu-toggle').setAttribute('aria-expanded',String(open));};
$('search-open').onclick=search;$('account-open').onclick=account;$('cart-open').onclick=cart;
$('close-drawer').onclick=()=>drawer.close();
drawer.addEventListener('close',()=>{
 // Zu heißt zurück auf die Bühne — mit replaceState, sonst pendelt die Zurück-Taste
 // zwischen offenem und geschlossenem Fenster statt eine Seite zurückzugehen.
 if(schliesstStill)schliesstStill=false;
 else if(nav.route.werk||nav.route.tasche){const {werk,tasche,...ohne}=nav.route;nav.route=ohne;if(!adresse.gleich(ohne))rememberHash(ohne,true);}
 lastFocus?.focus({preventScroll:true});wheelLock=performance.now()+500;invalidate();});
drawer.addEventListener('click',e=>{if(e.target===drawer&&e.clientX<drawer.getBoundingClientRect().left)drawer.close();});
$('previous').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('return-display').onclick=returnDisplay;
$('scene-action').onclick=()=>{const c=displays[sections[nav.route.section][nav.route.index]];if(c.inquiry)inquiry(c.inquiry);else if(c.product)product(c.product);else go({section:c.section,index:0});};
$('skip').onclick=()=>{nav.skip();invalidate();};
$('tools-toggle').onclick=()=>{const show=$('tools-panel').hidden;$('tools-panel').hidden=!show;$('tools-toggle').setAttribute('aria-expanded',String(show));};
$('tools-close').onclick=()=>{$('tools-panel').hidden=true;$('tools-toggle').setAttribute('aria-expanded','false');$('tools-toggle').focus();};
$('fold').oninput=e=>{fold=Number(e.target.value)/100;$('fold-value').textContent=e.target.value+' %';invalidate();};
$('angle').oninput=e=>{angle=Number(e.target.value)*Math.PI/180;invalidate();};
$('slow').onchange=e=>{speed=e.target.checked?.4:1;};
$('replay').onclick=()=>{nav.replay();resetFold();angle=0;$('angle').value=0;$('tools-close').click();rememberHash(nav.route);invalidate();};
hoeren(window,adresse.ereignis,()=>go(adresse.lesen(),false));
hoeren(window,'resize',()=>{world?.resize();syncRotate();uiKey='';invalidate();});
hoeren(window,'keydown',e=>{
 if(drawer.open||e.target.closest('input,textarea,select,form'))return;
 if(e.key==='Escape'){closeMenu();if(!$('pawn-chat').hidden){chatSchliessen();$('begleiter-knopf').focus({preventScroll:true});}}
 if(['ArrowRight','PageDown','ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();step(['ArrowRight','PageDown'].includes(e.key)?1:-1);}
});
hoeren(window,'wheel',e=>{
 if(e.ctrlKey||drawer.open||e.target.closest('.motion-tools,#mobile-reader,form,nav,.profile-saved,.conversation,#pawn-chat,#begleiter,#rotate,.lesetext,#search-toolbar'))return;
 e.preventDefault();const now=performance.now();if(nav.status!=='ready'||now<wheelLock)return;
 const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);
 if(now-wheelTime>240||Math.sign(dy)!==Math.sign(wheelSum))wheelSum=0;wheelTime=now;wheelSum+=dy;
 if(Math.abs(wheelSum)>80){step(Math.sign(wheelSum));wheelSum=0;}
},{passive:false});
try{
 await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1800))]);
 await Promise.all([prepareCutouts(Object.values(products).filter(buehnenfaehig)),prepareBilder(['cover.webp'])]);
 world=createWorld($('stage'),$('reader-layer'),invalidate);
 world.display('hero');begleiterTakt();
 if(nav.route.section==='suche')nav.route.index=clamp(nav.route.index,0,searchCount(nav.route)-1);
 world.canvas.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};});
 world.canvas.addEventListener('pointerup',e=>{
  if(!pointerStart||nav.status!=='ready'||drawer.open||reading(nav.route))return;
  const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;pointerStart=null;
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){step(dx<0?1:-1);return;}
  if(Math.hypot(dx,dy)<8&&fold>.9){const id=world.hit(e.clientX,e.clientY);if(id)product(id);}
 });
 $('loading').hidden=true;invalidate();
 if(nav.route.werk)product(nav.route.werk);if(nav.route.tasche)cart();
}catch(error){
 // Kein 3D? Dann liest man flach: die Doppelseiten stehen als Lesespalte, die Bühnen als Kapitel „Unsere Häuser“.
 console.error(error);world=null;document.body.classList.add('ohne-3d');
 $('loading').hidden=true;
 if(!reading(nav.route))nav.route={section:'haeuser',index:0};
 nav.status='ready';nav.progress=1;
 $('mobile-reader').hidden=false;displayKey='';uiKey='';
 const html=viewHtml(nav.route);$('mobile-reader').innerHTML=html;worteSpalten($('mobile-reader'));videosLaden($('mobile-reader'));
 document.body.classList.add('is-reading');document.body.dataset.motion='ready';document.body.dataset.section=nav.route.section;
 begleiterTakt();
}
kontoLaden();
return {
 go,route:()=>nav.route,state,refresh:readRefresh,quelle,kontoLaden,
 // Nach bezahlter Kasse: die Stücke dieses Hauses aus der Tasche nehmen. Muss hier stehen —
 // store.mjs schreibt nur den Zustand weg und kennt weder Fenster noch die Zahl im Kopf.
 tascheLeeren(haus){state.cart=haus?state.cart.filter(r=>!products[r.id]||products[r.id].house!==haus):[];updateCart();readRefresh();},
 stop(){for(const [z,t,f,o] of hoerer)z.removeEventListener(t,f,o);for(const k of [...document.body.classList])if(/^(is-|ohne-3d)/.test(k))document.body.classList.remove(k);delete document.body.dataset.section;delete document.body.dataset.page;delete document.body.dataset.motion;if(raf)cancelAnimationFrame(raf);raf=null;clearTimeout(blasenTimer);clearTimeout(weiterTimer);clearTimeout(toastTimer);if(world?.dispose)world.dispose();world=null;}
};
}

// HINWEIS FÜR DEN NÄCHSTEN ABGLEICH MIT DEM PROTOTYP: Hier stand eine Sicherung, die das Heft
// selbst mit Beispieldaten startete, falls keine index.html es tat. Im Projekt ruft HeftRoute03.tsx
// startHeft() — die Sicherung hätte ein ZWEITES Heft mit Beispieldaten danebengestellt.
// Sie bleibt draußen. Siehe LIESMICH.md.
