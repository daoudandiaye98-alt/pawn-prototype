// Die Stilberatung als Bilderquiz. Keine Fragebögen, keine offenen Felder:
// jede Stufe zeigt vier Bilder, eines wird angetippt, die Seite blättert weiter.
// Was hier steht, ist die einzige Quelle für Reihenfolge, Bilder und Wortlaut.
import {asset} from './data.mjs';

export const welten=[
 {wert:'mode',name:'Mode',bild:'welt-mode.webp',frage:'Kleidung mit Haltung.'},
 {wert:'interior',name:'Interior',bild:'welt-interior.webp',frage:'Objekte, mit denen du lebst.'},
 {wert:'kunst',name:'Kunst',bild:'welt-kunst.webp',frage:'Arbeiten mit Haltung.'}
];

// Stufe 2: die Richtung. Vier Bilder pro Welt, jedes zeigt eine klare Haltung.
export const richtungen={
 mode:[
  {wert:'Klar',bild:'stil-mode-klar.webp',text:'Schnitt vor Schmuck. Schwarz, Elfenbein, Kante.'},
  {wert:'Weich',bild:'stil-mode-weich.webp',text:'Fließende Stoffe. Sand, Creme, Bewegung.'},
  {wert:'Roh',bild:'stil-mode-roh.webp',text:'Workwear, Denim, Leder. Gemacht, um zu halten.'},
  {wert:'Laut',bild:'stil-mode-laut.webp',text:'Farbe als Aussage. Große Formen, kein Zögern.'}
 ],
 interior:[
  {wert:'Still',bild:'stil-interior-still.webp',text:'Helles Holz, Leinen, Luft. Fast nichts — und genau das.'},
  {wert:'Warm',bild:'stil-interior-warm.webp',text:'Terrakotta, Samt, Keramik. Ein Raum, der dich hält.'},
  {wert:'Roh',bild:'stil-interior-roh.webp',text:'Beton, Stahl, Eiche. Ehrliche Materialien.'},
  {wert:'Skulptural',bild:'stil-interior-skulptural.webp',text:'Farbe und Form als Spiel. Möbel, die etwas sagen.'}
 ],
 kunst:[
  {wert:'Figurativ',bild:'stil-kunst-figurativ.webp',text:'Menschen, Körper, Blicke.'},
  {wert:'Abstrakt',bild:'stil-kunst-abstrakt.webp',text:'Farbe, Fläche, Ordnung.'},
  {wert:'Geste',bild:'stil-kunst-geste.webp',text:'Energie auf Papier. Die Bewegung bleibt sichtbar.'},
  {wert:'Plastisch',bild:'stil-kunst-objekt.webp',text:'Skulptur, Material, Schatten im Raum.'}
 ]
};

// Stufe 3: die Form. In der Mode ist das die Silhouette — deshalb echte Menschen, keine Strichfiguren.
export const formen={
 mode:{titel:'Deine Silhouette',frage:'Welche Linie trägst du gern?',werte:[
  {wert:'Gerade',bild:'silhouette-gerade.webp',text:'Schmal, senkrecht, ruhig.'},
  {wert:'Weit',bild:'silhouette-weit.webp',text:'Volumen, fallende Schultern, Raum.'},
  {wert:'Tailliert',bild:'silhouette-tailliert.webp',text:'Nah am Körper, klare Taille.'},
  {wert:'Lagen',bild:'silhouette-lagen.webp',text:'Übereinander, ungleiche Längen.'}
 ]},
 interior:{titel:'Dein Material',frage:'Was willst du anfassen?',werte:[
  {wert:'Holz',bild:'material-holz.webp',text:'Warm, gewachsen, langlebig.'},
  {wert:'Ton',bild:'material-ton.webp',text:'Handgemacht, jedes Stück anders.'},
  {wert:'Stahl',bild:'material-stahl.webp',text:'Kühl, präzise, dauerhaft.'},
  {wert:'Textil',bild:'material-textil.webp',text:'Weich, gewebt, nah.'}
 ]},
 kunst:{titel:'Dein Format',frage:'Wie viel Wand gibst du her?',werte:[
  {wert:'Klein',bild:'format-klein.webp',text:'Ein Blatt. Nah betrachten.'},
  {wert:'Wandfüllend',bild:'format-wand.webp',text:'Ein Werk, das den Raum bestimmt.'},
  {wert:'Serie',bild:'format-serie.webp',text:'Mehrere Teile, ein Gedanke.'},
  {wert:'Objekt',bild:'format-objekt.webp',text:'Steht im Raum, nicht an der Wand.'}
 ]}
};

// Stufe 4: das Foto. Je Welt ein anderes Motiv und ein anderer Grund.
export const fotoStufe={
 mode:{bild:'foto-gesicht.webp',alt:'Ein Gesicht im Streiflicht',titel:'Dein Gesicht.',
  text:'PAWN liest Hautton, Unterton und Augenfarbe — und sortiert Farben aus, die dir nicht stehen.',
  knopf:'Foto von dir hinzufügen',liest:['Hautton','Unterton','Augenfarbe','Haarfarbe']},
 interior:{bild:'foto-raum.webp',alt:'Ein leerer Raum im Sonnenlicht',titel:'Dein Raum.',
  text:'PAWN liest Licht, Boden und vorhandene Farben — und schlägt nur vor, was in den Raum passt.',
  knopf:'Foto vom Raum hinzufügen',liest:['Lichtrichtung','Bodenfarbe','Wandton','Vorhandenes']},
 kunst:{bild:'foto-wand.webp',alt:'Eine leere Wand über einem Sofa',titel:'Deine Wand.',
  text:'PAWN misst die freie Fläche und liest das Licht — und zeigt nur Formate, die hier hängen können.',
  knopf:'Foto von der Wand hinzufügen',liest:['Freie Fläche','Licht','Umgebung','Farben']}
};

export const fuerWen=['Damen','Herren','Beides'];

// Deine Linie: aus zwei Antworten ein Wortpaar und ein Satz, den man sich merken kann.
// Sätze stehen fertig da — nichts wird konjugiert.
const SAETZE={
 mode:{Klar:'Klar geschnitten. Schwarz, Elfenbein, Kante — Schmuck ist der Schnitt.',Weich:'Weich und fließend. Stoffe, die sich bewegen, bevor du es tust.',Roh:'Roh und ehrlich. Denim, Canvas, Leder — gemacht, um zu halten.',Laut:'Laut und sicher. Farbe als Aussage, große Formen ohne Zögern.'},
 interior:{Still:'Still und hell. Holz, Leinen, Luft — fast nichts, und genau das.',Warm:'Warm und dicht. Terrakotta, Samt, Keramik — ein Raum, der dich hält.',Roh:'Roh und klar. Beton, Stahl, Eiche — Material, das nichts vorgibt.',Skulptural:'Skulptural und farbig. Möbel, die etwas sagen.'},
 kunst:{Figurativ:'Figurativ. Menschen, Körper, Blicke — Arbeiten, die zurückschauen.',Abstrakt:'Abstrakt. Farbe, Fläche, Ordnung — Arbeiten, die den Raum beruhigen.',Geste:'Geste. Energie auf Papier — die Bewegung bleibt sichtbar.',Plastisch:'Plastisch. Skulptur, Material, Schatten — Arbeiten, die im Raum stehen.'}
};
const FORM_SATZ={
 mode:{Gerade:'Getragen in gerader Linie.',Weit:'Getragen mit Volumen.',Tailliert:'Getragen nah am Körper.',Lagen:'Getragen in Lagen.'},
 interior:{Holz:'Aus Holz, das Wärme hält.',Ton:'Aus Ton, von Hand aufgebaut.',Stahl:'Aus Stahl, präzise und kühl.',Textil:'Aus Textil, gewebt und nah.'},
 kunst:{Klein:'Im kleinen Format, zum Nahbetrachten.',Wandfüllend:'Wandfüllend — ein Werk bestimmt den Raum.',Serie:'Als Serie — mehrere Teile, ein Gedanke.',Objekt:'Als Objekt im Raum, nicht an der Wand.'}
};
export function befund(stil={}){
 const welt=stil.welt||'mode',r=stil.richtung,f=stil.form;
 const linie=r&&f?r+' & '+f:r||'Noch offen';
 const offen={mode:'Tipp eine Richtung an — dann lese ich deine Linie.',interior:'Tipp eine Richtung an — dann lese ich deinen Raum.',kunst:'Tipp eine Richtung an — dann lese ich deinen Blick.'}[welt];
 const satz=r?(SAETZE[welt][r]||'')+(f?' '+(FORM_SATZ[welt][f]||''):'')+' PAWN sucht Stücke, die genau das können.':offen;
 return {welt,linie,satz,fertig:!!(r&&f)};
}

// „Steht mir das?“ / „Passt das in meinen Raum?“ / „Passt das an meine Wand?“ — die Prüfung eines Stücks
// gegen die Linie. Regelbasiert über die Stil-DNA des Stücks (product_dna.mood/silhouette/materials/colors + tags);
// im verbundenen System kann die DNA-KI (generate-dna-voice, mode "passt") das Urteil in Prosa ergänzen.
export const VOKABULAR={
 mode:{Klar:['klar','schwarz','elfenbein','minimal','reduziert','schnitt','kante'],Weich:['weich','fließend','fliessend','seide','creme','sand','plissé','plisse','drapiert'],Roh:['roh','denim','leder','canvas','workwear','robust'],Laut:['laut','farbe','bunt','rot','blau','print','muster'],
  Gerade:['gerade','schmal','säule','saeule','säulen'],Weit:['weit','oversize','volumen','weite'],Tailliert:['tailliert','taille','figurbetont','gegürtet'],Lagen:['lagen','layering','schichten','übereinander']},
 interior:{Still:['still','hell','leinen','licht','ruhig','luft','minimal'],Warm:['warm','terrakotta','samt','keramik','ton','ocker','bouclé','boucle','creme'],Roh:['roh','beton','stahl','eiche','ehrlich'],Skulptural:['skulptural','farbe','form','objekt','spiel'],
  Holz:['holz','eiche','esche','nussbaum','ahorn','kiefer'],Ton:['ton','keramik','steinzeug','porzellan','terrakotta'],Stahl:['stahl','metall','eisen','aluminium','messing'],Textil:['textil','stoff','leinen','wolle','bouclé','boucle','samt']},
 kunst:{Figurativ:['figurativ','figur','porträt','portrait','körper','koerper','mensch'],Abstrakt:['abstrakt','fläche','flaeche','farbfeld','ordnung','geometrisch'],Geste:['geste','tusche','papier','zeichnung','energie','bewegung'],Plastisch:['plastisch','skulptur','bronze','objekt','keramik','plastik'],
  Klein:['klein','blatt','papier','nah'],Wandfüllend:['wandfüllend','wandfuellend','groß','gross','leinwand','raum'],Serie:['serie','edition','mehrteilig','teile'],Objekt:['objekt','skulptur','plastik','raum']}
};
export function stilBegriffe(p){
 const d=p.dna||{};
 return [...(d.mood||[]),...(d.silhouette||[]),...(d.materials||[]),...(d.colors||[]),...(d.tags||[]),p.material||''].join(' ').toLocaleLowerCase('de');
}
function trifft(p,wert){
 if(!wert)return false;const hay=stilBegriffe(p),welt=p.world||'mode';
 const woerter=[wert,...(VOKABULAR[welt]?.[wert]||[])].map(w=>w.toLocaleLowerCase('de'));
 return woerter.some(w=>hay.includes(w));
}
// Der Befund über die gemerkten Stücke — der Chip „befund" aus dem Begleiter-Katalog
// („Zwei Stücke. Soll ich lesen, was die beiden gemeinsam haben?").
//
// Er erfindet nichts: eine Richtung oder Form zählt nur, wenn JEDES gemerkte Stück sie
// trägt. Teilen die Stücke keine Richtung, kommt `null` zurück und der Bauer schweigt —
// lieber kein Befund als ein geratener. Den Satz spricht `befund()`, damit die Linie im
// Heft überall gleich klingt.
export function befundAusWerken(werke=[]){
 const liste=werke.filter(Boolean);
 if(liste.length<2)return null;
 // Die Welt ist die der Mehrheit; Stücke aus anderen Welten reden beim Befund nicht mit.
 const zaehlung={};
 for(const p of liste){const w=p.world||'mode';zaehlung[w]=(zaehlung[w]||0)+1;}
 const welt=Object.keys(zaehlung).sort((a,b)=>zaehlung[b]-zaehlung[a])[0];
 const eigene=liste.filter(p=>(p.world||'mode')===welt);
 if(eigene.length<2)return null;
 const alle=werte=>werte.find(v=>eigene.every(p=>trifft(p,v)))||null;
 const richtung=alle((richtungen[welt]||[]).map(r=>r.wert));
 const form=alle((formen[welt]?.werte||[]).map(f=>f.wert));
 if(!richtung)return null;
 return {...befund({welt,richtung,form:form||undefined}),anzahl:eigene.length};
}

/**
 * C4, zweiter Teil — das Farbregister aus dem Foto-Befund.
 *
 * Der Befund (`kunden_stil.foto_befund`) traegt `farben_passen` und `farben_meiden`.
 * Traegt ein Stueck eine Farbe daraus, bekommt das Urteil einen Satz dazu. Sonst nicht:
 * ohne Foto gibt es keinen Befund, ohne Befund keine Farbaussage.
 *
 * WICHTIG AN DER FORMULIERUNG: „liegt ausserhalb deines Registers" ist kein Verbot.
 * Der Satz endet mit „probier es trotzdem an" — PAWN sortiert Farben aus, die nicht
 * stehen, aber er nimmt niemandem die Entscheidung ab. Ein Beratungssystem, das
 * „nein" sagt, ist ein Filter; eines, das „ich wuerde nicht, aber sieh selbst" sagt,
 * ist ein Berater.
 */
export function farbUrteil(produkt,befund){
 if(!produkt||!befund)return null;
 const farben=((produkt.dna||{}).colors||[]).map(f=>String(f).toLocaleLowerCase('de'));
 if(!farben.length)return null;
 const passt=(befund.farben_passen||[]).map(f=>String(f).toLocaleLowerCase('de'));
 const meiden=(befund.farben_meiden||[]).map(f=>String(f).toLocaleLowerCase('de'));
 const treffer=(liste)=>farben.find(f=>liste.some(x=>x&&(f.includes(x)||x.includes(f))));
 const gut=treffer(passt);
 if(gut)return {gut:true,farbe:gut,text:'Das '+gut.charAt(0).toLocaleUpperCase('de')+gut.slice(1)+' liegt in deinem Register.'};
 const schlecht=treffer(meiden);
 if(schlecht)return {gut:false,farbe:schlecht,text:'Das '+schlecht.charAt(0).toLocaleUpperCase('de')+schlecht.slice(1)+' liegt außerhalb deines Registers — probier es trotzdem an.'};
 return null;
}

export function urteil(stil={},produkt,befund){
 if(!produkt)return null;
 const treffer=[stil.richtung,stil.form].filter(x=>x&&trifft(produkt,x));
 const welt=produkt.world||stil.welt||'mode';
 if(!stil.richtung)return {ja:null,text:'Tipp erst deine Richtung an. Dann sage ich dir, ob es passt.'};
 // Die dritte Pruefung. Sie haengt hinten an, sie ersetzt nichts: die Linie entscheidet,
 // die Farbe kommentiert.
 const f=farbUrteil(produkt,befund),farbsatz=f?' '+f.text:'';
 const ja={mode:'Ja. '+produkt.name+' trägt genau deine Linie: '+treffer.join(' und ')+'.',interior:'Ja. '+produkt.name+' bringt genau das in deinen Raum: '+treffer.join(' und ')+'.',kunst:'Ja. '+produkt.name+' ist '+treffer.join(' und ')+' — das passt an deine Wand.'}[welt];
 if(treffer.length===2)return {ja:true,text:ja+farbsatz,farbe:f||undefined};
 if(treffer.length===1)return {ja:true,text:'Ja, mit einem Aber. '+treffer[0]+' passt — der Rest ist ein bewusster Bruch.'+farbsatz,farbe:f||undefined};
 return {ja:false,text:'Eher nicht. '+produkt.name+' zieht in eine andere Richtung als deine Linie. Es sei denn, du willst genau das.'+farbsatz,farbe:f||undefined};
}

export const bildVon=name=>asset(name);

// ————————————————————————————————————————————————————————————————
// Passform aus der echten Maßtabelle.
//
// Portiert aus src/features/fit/measurements.ts (Teil der alten Werkseite). Die
// Faustregel davor las nur den Brustumfang und riet eine Größe aus vier festen
// Stufen — sie kannte die Maßtabelle des Hauses gar nicht. Ein Haus, das in
// Zentimetern misst, wurde damit ignoriert, und die Zahl im Seitenfenster war
// eine Vermutung mit sicherem Auftreten.
//
// Hier wird gerechnet: Umfangszeilen (Brust, Taille, Hüfte) als Umfang des
// Stücks, Längenzeilen (Schulter, Innenbein) als direkter Vergleich. Wie viel
// Luft angenehm ist, sagt der gewählte Fall.
// ————————————————————————————————————————————————————————————————

/** Wie viel Luft (Zentimeter) zwischen Körper und Stück angenehm ist. */
export const SPIELRAUM={eng:{min:0,max:8},gerade:{min:3,max:14},weit:{min:8,max:30}};

/** Welche Zeile der Maßtabelle welchem Körpermaß entspricht. */
const ZEILE_ZU_MASS=[
 {muster:/brust/i,schluessel:'chest_cm',art:'umfang'},
 {muster:/taille/i,schluessel:'waist_cm',art:'umfang'},
 {muster:/(h(ü|ue)ft|bund)/i,schluessel:'hip_cm',art:'umfang'},
 {muster:/schulter/i,schluessel:'shoulder_cm',art:'laenge'},
 {muster:/(innenbein|schritt)/i,schluessel:'inseam_cm',art:'laenge'},
];

const zahl=v=>{if(v==null)return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>0?n:null;};

/**
 * Körpermaße gegen die Maßtabelle des Stücks. Gibt {moeglich, groessen[], beste} zurück.
 * `moeglich:false` heißt: es fehlt etwas — dann behauptet das Heft nichts.
 */
export function passform(masse={},produkt){
 const tabelle=produkt&&produkt.measurements,groessen=(produkt&&produkt.sizes)||[];
 if(!tabelle||!Array.isArray(tabelle.rows)||!tabelle.rows.length||!groessen.length)return {moeglich:false,groessen:[],beste:null};

 const passende=ZEILE_ZU_MASS.map(z=>{
  const zeile=tabelle.rows.find(r=>z.muster.test(r));
  const koerper=zahl(masse[z.schluessel]);
  return zeile&&koerper?{zeile,koerper,art:z.art}:null;
 }).filter(Boolean);
 if(!passende.length)return {moeglich:false,groessen:[],beste:null};

 const band=SPIELRAUM[masse.fit_preference]||SPIELRAUM.gerade;
 const ergebnis=groessen.map(groesse=>{
  let schlimmste=null,irgendeinWert=false;
  for(const r of passende){
   const stueck=zahl(tabelle.values&&tabelle.values[r.zeile]&&tabelle.values[r.zeile][groesse]);
   if(stueck===null)continue;
   irgendeinWert=true;
   const luft=Math.round((stueck-r.koerper)*10)/10;
   const grenze=r.art==='laenge'?{min:-2,max:4}:band;
   let stufe='passt',abstand=0;
   if(luft<grenze.min){stufe='knapp';abstand=grenze.min-luft;}
   else if(luft>grenze.max){stufe='weit';abstand=luft-grenze.max;}
   const wo=r.zeile.toLowerCase();
   const grund=stufe==='passt'?r.zeile+' '+(luft>=0?'+':'')+luft+' cm Spielraum'
    :stufe==='knapp'?'zu knapp an der '+wo+' ('+luft+' cm)'
    :'sehr weit an der '+wo+' (+'+luft+' cm)';
   if(!schlimmste||abstand>schlimmste.abstand)schlimmste={stufe,grund,abstand};
  }
  if(!irgendeinWert||!schlimmste)return {groesse,stufe:'unbekannt',grund:'Für diese Größe fehlen Maße.'};
  return {groesse,stufe:schlimmste.stufe,grund:schlimmste.grund};
 });
 return {moeglich:true,groessen:ergebnis,beste:ergebnis.find(r=>r.stufe==='passt')||null};
}
