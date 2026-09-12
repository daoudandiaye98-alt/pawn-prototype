// Die liegenden Bühnen zeigen keine feste Auswahl, sondern ein Karussell:
// bei jedem Betreten kuratiert PAWN neu — nach Linie, Merkliste und Reihenfolge.
// Im verbundenen System liefert die DNA diese Reihenfolge; hier steht die Regel dafür.
import {products,displays,kuration as reihe,WELTEN,buehnenfaehig} from './data.mjs';
import {urteil} from './beratung.mjs';
import {werkTrifft} from './archetyp.mjs';
const besuche={};
/**
 * C3 — die Wörter des BESTÄTIGTEN Archetyps. Ohne Bestätigung: keine.
 *
 * Die Einschränkung steht so im Auftrag und sie ist der Kern: ein berechneter Archetyp
 * ist eine Vermutung mit 0,4 Zuversicht. Danach zu kuratieren hiesse, jemandem eine
 * Schublade zu bauen, bevor er sie bestätigt hat — und ihn dann nur noch darin zu
 * zeigen, was hineinpasst. Erst wenn er „Das bin ich" gesagt hat, darf die Bühne
 * danach sortieren.
 */
export function archetypWoerter(state){
 const a=state.archetyp;
 if(!a||!a.bestaetigt)return [];
 const k=(state.archetypen||[]).find(x=>x&&x.key===a.archetyp_key);
 return (k&&k.woerter)||[];
}

/**
 * Das Gewicht des Archetyps in der Kuration.
 *
 * Es sitzt bewusst ZWISCHEN Welt (0,5) und Merkliste (1,5): stärker als „ist in der
 * richtigen Welt", schwächer als „hat sich das gemerkt". Der Archetyp ist eine
 * Beschreibung, das Merken eine Handlung — und eine Handlung wiegt schwerer als eine
 * Beschreibung, auch wenn die Beschreibung bestätigt ist.
 */
export const ARCHETYP_GEWICHT=1;

export function passung(p,state){
 const u=urteil(state.stil||{},p);
 let n=u?(u.ja===true?(/beiden/.test(u.text)?3:2):u.ja===false?0:1):1;
 if((state.saved||[]).includes(p.id))n+=1.5;
 if((state.stil||{}).welt===p.world)n+=.5;
 const woerter=archetypWoerter(state);
 if(woerter.length&&werkTrifft(p,woerter))n+=ARCHETYP_GEWICHT;
 return n;
}
export function kuratiere(id,state={}){
 const d=displays[id];if(!d)return [];
 const runde=besuche[id]||0;besuche[id]=runde+1;
 const nachPassung=welt=>Object.values(products).filter(p=>p.world===welt&&buehnenfaehig(p)).sort((a,b)=>passung(b,state)-passung(a,state));
 // Redaktionelle Reihe (curated_collections) hat Vorrang, sobald sie gepflegt ist.
 const redaktion=reihe.slugs.map(slug=>Object.values(products).find(p=>p.slug===slug)).filter(buehnenfaehig);
 // Hero und „Ausgewählt für dich“: ein Stück je Welt. Der Hero rotiert, die Auswahl zeigt die beste Passung.
 if(id==='hero')return WELTEN.map(w=>{const l=nachPassung(w);return l.length?l[runde%l.length].id:null;}).filter(Boolean);
 if(id==='edit'){
  if(redaktion.length)return redaktion.slice(0,3).map(p=>p.id);
  return WELTEN.map(w=>nachPassung(w)[0]?.id).filter(Boolean);
 }
 if(!d.pieces.length)return [];
 const welt=products[d.pieces[0]]?.world,eigene=d.house?Object.values(products).filter(p=>p.house===d.house&&buehnenfaehig(p)):[];
 // Bühne eines Hauses: nur seine eigenen Stücke, sortiert nach Passung; Welt-Bühne: die ganze Welt.
 const liste=eigene.length?eigene.sort((a,b)=>passung(b,state)-passung(a,state)):nachPassung(welt),n=Math.min(Math.max(1,d.pieces.length),liste.length);
 if(!liste.length)return [];
 // Die beste Passung bleibt vorn; der Rest rotiert, damit jeder Besuch etwas Neues zeigt.
 if(liste.length<=n)return liste.map(p=>p.id);
 const rest=liste.slice(1),off=runde%rest.length;
 return [liste[0].id,...Array.from({length:n-1},(_,i)=>rest[(off+i)%rest.length].id)];
}
export function kurationsNotiz(id,state={}){
 const st=state.stil||{};
 // Ist ein Archetyp bestätigt, sortiert die Bühne auch danach — dann soll sie es auch
 // sagen. Eine Auswahl, deren Grund im Verborgenen bleibt, ist keine Kuration.
 const a=state.archetyp;
 if(a&&a.bestaetigt){
  const k=(state.archetypen||[]).find(x=>x&&x.key===a.archetyp_key);
  if(k&&k.name)return 'Kuratiert nach deiner Figur: '+k.name;
 }
 return st.richtung?'Kuratiert nach deiner Linie: '+st.richtung+(st.form?' & '+st.form:''):'Kuratiert von PAWN · schärfer mit deiner Linie';
}
