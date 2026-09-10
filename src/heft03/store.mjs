// Gedächtnis des Hefts. Heute localStorage, später Supabase — die Schnittstelle bleibt.
// Gespeichert wird nur mit Zustimmung (state.consent === true). Ohne Zustimmung wird gelöscht, nicht geparkt.
const SCHLUESSEL='pawn.heft.v1';
const FELDER=['saved','cart','stil','frag','foto','measurements','profile','consent','style','goal','presentations'];
export function laden(){
 try{const roh=localStorage.getItem(SCHLUESSEL);if(!roh)return null;const d=JSON.parse(roh);return d&&typeof d==='object'?d:null;}catch(e){return null;}
}
export function speichern(state){
 try{
  if(state.consent!==true){localStorage.removeItem(SCHLUESSEL);return false;}
  const paket={};for(const f of FELDER)if(state[f]!==undefined)paket[f]=state[f];
  localStorage.setItem(SCHLUESSEL,JSON.stringify(paket));return true;
 }catch(e){return false;}
}
export function vergessen(){try{localStorage.removeItem(SCHLUESSEL);}catch(e){}}
// Was das Backend als Zeile erwartet (customer_measurements): Zahlen oder null, kein Geschlecht, Raum als Notiz UND als JSON (Spalte raum, sql/03).
export function massZeile(m={},stil={}){
 const zahl=v=>v===''||v==null||isNaN(Number(v))?null:Number(v);
 return {height_cm:zahl(m.height_cm),shoulder_cm:zahl(m.shoulder_cm),chest_cm:zahl(m.chest_cm),waist_cm:zahl(m.waist_cm),hip_cm:zahl(m.hip_cm),inseam_cm:zahl(m.inseam_cm),foot_cm:zahl(m.foot_cm),
  fit_preference:m.fit_preference||'gerade',room_note:[m.wand,m.hoehe,m.flaeche,m.licht,m.abstand].filter(Boolean).join(' · ')||null,
  raum:[m.wand,m.hoehe,m.flaeche,m.licht,m.abstand].some(Boolean)?{wand:m.wand||null,hoehe:m.hoehe||null,flaeche:m.flaeche||null,licht:m.licht||null,abstand:m.abstand||null}:null};
}
