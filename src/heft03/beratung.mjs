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
export function urteil(stil={},produkt){
 if(!produkt)return null;
 const treffer=[stil.richtung,stil.form].filter(x=>x&&trifft(produkt,x));
 const welt=produkt.world||stil.welt||'mode';
 if(!stil.richtung)return {ja:null,text:'Tipp erst deine Richtung an. Dann sage ich dir, ob es passt.'};
 const ja={mode:'Ja. '+produkt.name+' trägt genau deine Linie: '+treffer.join(' und ')+'.',interior:'Ja. '+produkt.name+' bringt genau das in deinen Raum: '+treffer.join(' und ')+'.',kunst:'Ja. '+produkt.name+' ist '+treffer.join(' und ')+' — das passt an deine Wand.'}[welt];
 if(treffer.length===2)return {ja:true,text:ja};
 if(treffer.length===1)return {ja:true,text:'Ja, mit einem Aber. '+treffer[0]+' passt — der Rest ist ein bewusster Bruch.'};
 return {ja:false,text:'Eher nicht. '+produkt.name+' zieht in eine andere Richtung als deine Linie. Es sei denn, du willst genau das.'};
}

export const bildVon=name=>asset(name);
