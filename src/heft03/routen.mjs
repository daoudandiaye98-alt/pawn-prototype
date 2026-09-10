// Adressen des Hefts. Intern denkt das Heft in Routen {section,index,slug?,q?…};
// nach außen gibt es zwei Schreibweisen: den Hash der Vorschau (#/mode/1) und
// echte Pfade für pawn.vision (/mode, /haus/drape/2). Beide Richtungen stehen hier —
// App.tsx, routen.js und vercel.json des echten Projekts müssen dieselben Pfade kennen.
import {routeHash,parseRoute} from './model.mjs';
import {sections,counts,houses,products} from './data.mjs';

const ABFRAGE=['q','world','house','max','available','sort'];
// Sektion → Pfadsegment. Reihenfolge ist zugleich die Reihenfolge im Heft.
export const PFAD={entdecken:'',mode:'mode',interior:'interior',kunst:'kunst',haeuser:'haeuser',dna:'deine-dna','frag-pawn':'frag-pawn','fuer-designer':'fuer-designer',vision:'vision',suche:'suche',konto:'konto',haus:'haus'};
const SEKTION=Object.fromEntries(Object.entries(PFAD).map(([k,v])=>[v,k]));
// Umzüge aus dem alten Frontend (Ziel: 301 in vercel.json)
export const UMZUEGE={'/dna':'/deine-dna','/designers':'/haeuser','/designers/all':'/haeuser','/boutique':'/ausgewaehlt','/neu':'/ausgewaehlt','/cart':'/tasche','/account':'/konto','/shop':'/suche','/inhalt':'/','/kuratierter-raum':'/vision','/drei-welten':'/haeuser','/verzeichnis':'/suche','/apply':'/fuer-designer/2'};

function seitenName(route){
 const s=route.section;
 if(s==='dna')return sections.dna[route.index]||'intro';
 return String((route.index||0)+1);
}
function seitenIndex(section,teil){
 if(section==='dna'){const i=sections.dna.indexOf(teil);return i>=0?i:Math.max(0,(Number(teil)||1)-1);}
 return Math.max(0,(Number(teil)||1)-1);
}
/** Route → Pfad. Erste Seite ohne Nummer (/mode), weitere nummeriert (/mode/2), DNA mit Namen (/deine-dna/linie). */
export function pfadAusRoute(route){
 const params=new URLSearchParams();for(const k of ABFRAGE)if(route[k])params.set(k,String(route[k]));
 const q=params.size?'?'+params:'';
 if(route.werk){const p=Object.values(products).find(x=>x.id===route.werk||x.slug===route.werk);if(p)return '/werk/'+p.slug+q;}
 if(route.section==='entdecken')return (route.index?'/ausgewaehlt':'/')+q;
 if(route.section==='haus')return '/haus/'+route.slug+(route.index?'/'+(route.index+1):'')+q;
 const name=seitenName(route),erste=route.section==='dna'?name==='intro':name==='1';
 return '/'+PFAD[route.section]+(erste?'':'/'+name)+q;
}
/** Pfad → Route. Unbekanntes landet auf dem Hero; /werk/:slug öffnet das Werk über seiner Welt. */
export function routeAusPfad(pfad){
 const [roh,query='']=String(pfad||'/').split('?'),teile=roh.replace(/\/+$/,'').split('/').filter(Boolean);
 const params=new URLSearchParams(query),extra={};for(const k of ABFRAGE){const v=params.get(k);if(v)extra[k]=v.slice(0,240);}
 const [kopf,a,b]=teile;
 if(!kopf)return {section:'entdecken',index:0};
 if(kopf==='ausgewaehlt')return {section:'entdecken',index:1};
 if(kopf==='tasche')return {section:'entdecken',index:0,tasche:true};
 if(kopf==='werk'&&a){const p=Object.values(products).find(x=>x.slug===a||x.id===a);if(p)return {section:p.world,index:Math.max(0,sections[p.world].indexOf(p.house)),werk:p.id};}
 if(kopf==='haus'&&a&&houses[a])return {section:'haus',slug:a,index:Math.min(2,Math.max(0,(Number(b)||1)-1))};
 const section=SEKTION[kopf];
 if(section&&section in counts){const index=Math.min(section==='suche'?100:counts[section]-1,seitenIndex(section,a));return {section,index,...(section==='suche'?extra:{})};}
 return {section:'entdecken',index:0};
}
/** Alle Adressen, die das Heft heute kennt — für routen.js/vercel.json des echten Projekts und für Tests. */
export function alleAdressen(){
 const liste=[];
 for(const [s,seiten] of Object.entries(sections)){if(s==='suche'||s==='konto')continue;seiten.forEach((_,i)=>liste.push(pfadAusRoute({section:s,index:i})));}
 for(const h of Object.values(houses))for(let i=0;i<3;i++)liste.push(pfadAusRoute({section:'haus',slug:h.slug,index:i}));
 for(const p of Object.values(products))liste.push('/werk/'+p.slug);
 liste.push('/suche','/konto','/tasche');
 return [...new Set(liste)];
}
// Hash-Schreibweise der Vorschau (bleibt Standard im Prototyp)
export const hashAusRoute=routeHash;
export const routeAusHash=hash=>parseRoute(hash,counts,houses);
/** Adressadapter: 'hash' für die Vorschau, 'pfad' im echten Projekt (History API, Basis-Präfix möglich). */
export function adressen(art='hash',basis=''){
 if(art==='pfad')return {
  lesen:()=>routeAusPfad(location.pathname.replace(basis,'')+location.search),
  schreiben:(route,ersetzen=false)=>{const p=basis+pfadAusRoute(route);if(location.pathname+location.search!==p)history[ersetzen?'replaceState':'pushState'](null,'',p);},
  gleich:route=>location.pathname.replace(basis,'')+location.search===pfadAusRoute(route),
  ereignis:'popstate'
 };
 return {
  lesen:()=>routeAusHash(location.hash),
  schreiben:(route,ersetzen=false)=>{const h=hashAusRoute(route);if(location.hash!==h)history[ersetzen?'replaceState':'pushState'](null,'',h);},
  gleich:route=>location.hash===hashAusRoute(route),
  ereignis:'hashchange'
 };
}
