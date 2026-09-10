import {products,houses,media,asset,labels} from './data.mjs';
import {housePresentation,houseBlocks,houseProducts} from './presentation.mjs';
import {orderedBlocks,purchaseMode} from './model.mjs';
import {pawnSagt} from './extra-views.mjs';
import {urteil} from './beratung.mjs';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=n=>n==null?'Preis auf Anfrage':new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const btn=(text,attrs='',cls='text-link')=>'<button class="'+cls+'" '+attrs+'>'+text+' <span aria-hidden="true">↗</span></button>';
const tag=text=>'<p class="eyebrow">'+text+'</p>';
const img=(url,alt,cls='')=>'<img src="'+url+'" alt="'+esc(alt)+'" class="'+cls+'">';
const page=(left,right,cls='',welt='')=>'<div class="spread-grid '+cls+'"'+(welt?' data-welt="'+welt+'"':'')+'><section class="paper-page left-paper">'+left+'</section><section class="paper-page right-paper">'+right+'</section></div>';
// Ein Bild über die ganze Doppelseite, der Text liegt darauf.
export const spreadVoll=(bild,alt,inhalt,{rechts=false,welt='',karte=false,video=''}={})=>{
 // Zwei echte Halbseiten, damit Falten und Blättern unverändert funktionieren.
 // Das Bild liegt als Hintergrund über beide Hälften; die Naht bleibt stehen,
 // weil sich nur die Höhe der Bildlage bewegt, nie die Breite.
 // Mit `video` liegt zusätzlich in jeder Hälfte dasselbe Bewegtbild, doppelt breit
 // und gegeneinander versetzt — app.js hält beide Hälften im Takt.
 const gruppe=video?'v'+Math.random().toString(36).slice(2,7):'';
 const film=seite=>video?'<video class="voll-film '+seite+'" data-quelle="'+video+'" data-gruppe="'+gruppe+'" muted loop playsinline aria-hidden="true"></video>':'';
 const halb=(seite,inneres)=>'<section class="paper-page voll-halb '+seite+(video?' bewegt':'')+' koernung" style="--voll:url('+bild+')" role="img" aria-label="'+esc(seite==='links'?alt:'')+'">'+film(seite)+inneres+'</section>';
 const text='<div class="voll-text'+(rechts?' rechts':'')+(karte?' karte':'')+'">'+(karte?'<div class="voll-karte">'+inhalt+'</div>':inhalt)+'</div>';
 return '<div class="spread-grid voll"'+(welt?' data-welt="'+welt+'"':'')+'>'
  +halb('links',rechts?'':text)+halb('rechts',rechts?text:'')+'</div>';
};
// Eine Seite, die sich bewegt. Stumm, endlos, ohne Bedienelemente.
export const seiteVideo=(video,poster,alt,inhalt,{welt='',rechts=true}={})=>{
 const bild='<section class="paper-page video-seite koernung" style="background-image:url('+poster+')"><video data-quelle="'+video+'" poster="'+poster+'" muted loop playsinline aria-label="'+esc(alt)+'"></video></section>';
 const text='<section class="paper-page '+(rechts?'left-paper':'right-paper')+'">'+inhalt+'</section>';
 return '<div class="spread-grid"'+(welt?' data-welt="'+welt+'"':'')+'>'+(rechts?text+bild:bild+text)+'</div>';
};
// Der eine hervorgehobene Zug je Sektion.
export const zug=(label,text,note,attrs)=>'<button class="naechster-zug" '+attrs+'><small>'+label+'</small><strong>'+text+'<i aria-hidden="true">→</i></strong>'+(note?'<em>'+note+'</em>':'')+'</button>';
// Freigestellte Figur vor einem Farbfeld.
export const ausschnitt=(bild,alt,bogen=true)=>'<div class="ausschnitt"><span class="grund'+(bogen?' bogen':'')+'"></span><img src="'+bild+'" alt="'+esc(alt)+'"></div>';
export function windowDisplay(h,state={}){
 const t=housePresentation(h.slug,state);
 return '<div class="house-window architecture-'+t.architecture+'" style="--house-color:'+t.accent+'"><div class="curtain"></div><div class="window-arch"></div>'+houseProducts(h.slug,state).map((id,i)=>'<button class="window-piece piece-'+i+'" data-product="'+id+'" aria-label="'+products[id].name+' ansehen">'+img(products[id].image,products[id].name)+'</button>').join('')+'<span class="window-sign">HAUS<br><b>'+h.number+'</b></span><div class="window-base"></div><span class="window-tag">'+h.name+' — KOLLEKTION 01</span></div>';
}
export function productCard(id){
 const p=products[id];
 return '<button class="product-card" data-product="'+id+'">'+img(p.image,p.name)+(purchaseMode(p)==='inquiry'?'<span class="card-tag">Auftragsarbeit</span>':'')+'<span>'+p.name+'<small>'+money(p.price)+'</small></span></button>';
}
// Ein Medium des Hauses: Bild oder Bewegtbild, wie das Backend es liefert (media_assets.kind).
const medium=(id,alt='')=>{const m=media[id];if(!m)return '';return m.kind==='video'?'<video data-quelle="'+m.url+'" poster="'+(m.poster||'')+'" muted loop playsinline aria-label="'+esc(alt)+'"></video>':img(m.url,alt);};
const kauf=id=>products[id]?'<button class="block-kauf" data-product="'+id+'">'+esc(products[id].name)+' · '+money(products[id].price)+' <span aria-hidden="true">↗</span></button>':'';
// Die Block-Renderer lesen genau die Felder, die HausseiteBlocks/StudioHausseite schreiben:
// auftakt{media_asset_id,ton}, editorial_text{heading,text}, zitat{quote,author}, produktreihe{product_ids},
// lookbook_streifen{media_asset_ids}, banner_*{media_asset_id,product_id,ton}, ueberlappend{media_asset_id_a,media_asset_id_b}; alle: abstand.
export const renderers={
 auftakt:c=>'<div class="block-auftakt ton-'+esc(c.ton||'ruhig')+'">'+medium(c.media_asset_id,'Auftakt')+'</div>',
 editorial_text:c=>'<div class="block-text">'+(c.heading?'<h3>'+esc(c.heading)+'</h3>':'')+'<p>'+esc(c.text||'')+'</p></div>',
 zitat:c=>'<blockquote>„'+esc(c.quote||'')+'“'+(c.author?'<cite>'+esc(c.author)+'</cite>':'')+'</blockquote>',
 produktreihe:c=>'<div class="product-row">'+(c.product_ids||[]).filter(id=>products[id]).map(productCard).join('')+'</div>',
 lookbook_streifen:c=>'<div class="lookbook-strip">'+(c.media_asset_ids||[]).filter(id=>media[id]).map(id=>medium(id,'Einblick ins Lookbook')).join('')+'</div>',
 banner_seitlich:c=>'<div class="block-banner side ton-'+esc(c.ton||'ruhig')+'">'+medium(c.media_asset_id,'Banner')+'<div>'+kauf(c.product_id)+'</div></div>',
 banner_vollbreite:c=>'<div class="block-banner full ton-'+esc(c.ton||'ruhig')+'">'+medium(c.media_asset_id,'Banner')+kauf(c.product_id)+'</div>',
 ueberlappend:c=>'<div class="block-overlap">'+[c.media_asset_id_a,c.media_asset_id_b].filter(id=>media[id]).map(id=>medium(id,'Ateliereinblick')).join('')+'</div>'
};
export function blocksHTML(blocks){return orderedBlocks(blocks).map(b=>'<div class="block abstand-'+esc(b.content?.abstand||'ruhig')+'">'+(renderers[b.kind]?.(b.content||{})||'')+'</div>').join('');}
export function readView(route,state){
 const i=route.index;
 if(route.section==='haus'){
  const h=houses[route.slug],title=state.presentations?.[h.slug]?.title?esc(state.presentations[h.slug].title):h.title;
  const stuecke=houseProducts(h.slug,state),erstes=products[stuecke[0]];
  if(i===0)return page(tag('HAUS '+h.number+' / '+h.location.toUpperCase())+windowDisplay(h,state),tag('EINE EIGENE HANDSCHRIFT')+'<h1>'+h.name+'</h1><h2 class="house-line">'+title+'</h2><p class="body-copy">'+h.intro+'</p><p class="haus-ort">'+h.location+' · '+labels[h.world]+'</p>'+zug('DEIN ZUG','Das Haus kennenlernen','Atelier, Haltung, ein Zitat.','data-page="1"'),'house-opening',h.world);
  if(i===1){
   const texte=h.blocks?houseBlocks(h.slug,state).filter(b=>b.on&&['editorial_text','zitat'].includes(b.kind)):[];
   const text=texte.find(b=>b.kind==='editorial_text'),zitat=texte.find(b=>b.kind==='zitat');
   // Hochformat-Atelierbild als ganze linke Seite, rechts das Wort des Hauses.
   return '<div class="spread-grid haus-atelier" data-welt="'+h.world+'"><section class="paper-page left-paper bild-seite"><img src="'+h.work+'" alt="Einblick in das Atelier von '+esc(h.name)+'"><span class="bild-marke-ecke">HAUS '+h.number+' / DAS ATELIER</span></section>'
    +'<section class="paper-page right-paper">'+tag(h.name+' / '+h.location.toUpperCase())+'<h1>'+(text?esc(text.content.heading||''):h.name)+'</h1>'
    +'<p class="body-copy lead">'+(text?esc(text.content.text||''):h.intro)+'</p>'
    +'<blockquote class="haus-zitat dunkel">„'+(zitat?esc(zitat.content.quote):h.quote)+'“'+(zitat?.content.author?'<cite>'+esc(zitat.content.author)+'</cite>':'<cite>'+h.name+', '+h.location+'</cite>')+'</blockquote>'
    +zug('DEIN ZUG','Die Arbeiten ansehen','Alles, was dieses Haus gerade zeigt.','data-page="2"')+'</section></div>';
  }
  const lookbook=h.blocks?houseBlocks(h.slug,state).filter(b=>b.on&&['lookbook_streifen','banner_vollbreite','ueberlappend'].includes(b.kind)):[{kind:'lookbook_streifen',position:0,content:{media_asset_ids:h.lookbook||['atelier','mode']}}];
  const reihe=h.blocks?houseBlocks(h.slug,state).filter(b=>b.on&&b.kind==='produktreihe'):[];
  return page(tag('HAUS '+h.number+' / LOOKBOOK')+'<h2>Eine Kollektion.<br><em>Viele Perspektiven.</em></h2>'+blocksHTML(lookbook)+'<p class="caption">Die Doppelseite erzählt die Geschichte. Die Stücke führen weiter.</p>'+'<button class="text-link leise" data-return">← Zur Bühne</button>',
   tag(h.name+' / AUSGEWÄHLTE ARBEITEN')+'<h2>Die Arbeiten.</h2>'+(reihe.length?blocksHTML(reihe):'<div class="product-row">'+stuecke.map(productCard).join('')+'</div>')
   +(erstes?zug('DEIN ZUG',esc(erstes.name)+' ansehen','Das Stück, mit dem dieses Haus beginnt.','data-product="'+erstes.id+'"'):''),'',h.world);
 }
 if(route.section==='haeuser'){
  const welten=[['mode','Mode','Stoff, Schnitt, Haltung'],['interior','Interior','Objekte, die Räume leiser machen'],['kunst','Kunst','Freie Arbeiten und Auftragsarbeiten']];
  if(i===0)return spreadVoll(asset('drei-welten.webp'),'Eine Designerin, eine Keramikerin und ein Maler in einem Studio',
   tag('UNSERE HÄUSER / WÄHLE EINE WELT')+'<h1>Unsere<br><em>Häuser.</em></h1>'
   +'<p class="body-copy lead">Tipp eine Welt an. Dahinter stehen Menschen mit Nummer und Namen.</p>'
   +'<div class="welt-wahl">'+welten.map(([k,n,u],n2)=>'<button data-page="'+(n2+1)+'" data-welt-wahl="'+k+'"><span class="welt-no">0'+(n2+1)+'</span><span><strong>'+n+'</strong><small>'+u+'</small></span><span aria-hidden="true">↗</span></button>').join('')+'</div>');
  const welt=['mode','interior','kunst'][i-1];
  const haeuserDerWelt=Object.values(houses).filter(h=>h.world===welt);
  const filme={mode:['bewegt-mode.mp4','mensch-cape.webp','Eine Frau in einem wehenden Cape mitten in der Drehung'],
   interior:['bewegt-interior.mp4','mensch-keramik.webp','Eine Keramikerin an der Drehscheibe'],
   kunst:['bewegt-kunst.mp4','mensch-maler.webp','Ein Maler vor einer großen Leinwand']};
  const [film,standbild,filmAlt]=filme[welt];
  const zeilen=haeuserDerWelt.map(h=>'<button class="feature-link" data-house="'+h.slug+'"><span class="feature-no">'+h.number+'</span><span><strong>'+h.name+'</strong><small>'+h.location+'</small></span><span aria-hidden="true">↗</span></button>').join('');
  return seiteVideo(asset(film),asset(standbild),filmAlt,
   tag('UNSERE HÄUSER / '+labels[welt].toUpperCase())
   +'<h1>'+{mode:'Stoff.<br><em>Und Haltung.</em>',interior:'Objekte,<br><em>die Räume verändern.</em>',kunst:'Eine Geste.<br><em>Ein Gespräch.</em>'}[welt]+'</h1>'
   +'<p class="body-copy lead">'+{mode:'Kleidung mit einer eigenen Handschrift.',interior:'Objekte, die Räume verändern.',kunst:'Arbeiten, die im Gespräch entstehen.'}[welt]+'</p>'
   +'<p class="feld-titel">'+(haeuserDerWelt.length===1?'Ein Haus. Tipp es an.':'Tipp ein Haus an')+'</p><div class="haus-zeilen">'+zeilen+'</div>'
   +'<button class="text-link leise" data-route="'+welt+'">Oder die Stücke auf der Bühne sehen <span aria-hidden="true">↗</span></button>'
   +zug('DEIN ZUG',esc(haeuserDerWelt[0].name)+' betreten','Haus '+haeuserDerWelt[0].number+', '+esc(haeuserDerWelt[0].location)+'.','data-house="'+haeuserDerWelt[0].slug+'"'),
   {welt,rechts:false});
 }
 if(route.section==='vision'){
  if(i===0)return spreadVoll(asset('vision-archiv.webp'),'Ein dunkles Archiv voller Arbeiten, eine einzige davon im Licht',
   tag('PAWN / UNSERE VISION')+'<h1>Culture<br>moves<br><em>fast.</em></h1>'
   +'<p class="body-copy lead">Jeden Tag entsteht mehr. Jeden Tag verschwindet mehr.</p>'
   +'<p class="bild-marke">Von tausend Arbeiten steht eine im Licht. PAWN sucht die anderen.</p>'
   +zug('DEIN ZUG','Was wir sehen','Und was du hier findest.','data-page="1"'),{welt:'vision'});
  if(i===1)return page(
   tag('WAS WIR SEHEN')+'<img class="blatt-bild lesebild" src="'+asset('mensch-trio.webp')+'" alt="Drei junge Kreative in Kobalt, Orange und Oxblood">'
   +'<div class="lesetext">'
   +'<p class="epigraph">PAWN gives what matters a place to grow.</p>'
   +'<p>Mode, Kunst und Design entstehen heute überall: im Schlafzimmer, im kleinen Atelier, in einer Community. Die alten Wege waren klar —</p><p class="kette">Designer → Showroom → Buyer → Store → Kunde</p>'
   +'<p>Heute ist das Spielfeld größer. Das ist enorme Freiheit — und eine neue Frage: <strong>Wie findest du das, was wirklich zählt?</strong></p>'
   +'</div>',
   tag('WAS DU HIER FINDEST')+'<div class="lesetext">'
   +'<p class="epigraph">PAWN is where independent creativity meets opportunity.</p>'
   +'<p>PAWN ist eine kuratierte Plattform für unabhängige Kreative aus Mode, Interior und Kunst. Wir entdecken. Wir kuratieren. Wir erzählen. Wir verbinden.</p>'
   +'<p>Eine Arbeit erscheint hier nicht zwischen tausend anderen. Sie bekommt eine Nummer, eine Doppelseite, eine Geschichte — und dich als Leser.</p>'
   +'<p><strong>Vier Häuser hängen bereits: 07, 12, 18, 24.</strong> Jede Nummer gehört einem Menschen, der entschieden hat, seine Idee sichtbar zu machen.</p>'
   +'<p>Wer hier kauft, kauft nicht nur ein Stück — sondern hängt mit: Teil einer Bewegung, die früher hinsieht.</p>'
   +'<blockquote>Die Welt hat kein Problem mit zu wenig Kreativität. Sie hat ein Problem mit zu viel ungefilterter Kreativität.</blockquote>'
   +'<p class="schlusszeile">Weniger Rauschen. Mehr Bedeutung.</p>'
   +'</div>'
   +zug('DEIN ZUG','Die Häuser entdecken','Vier Nummern, vier Handschriften.','data-route="haeuser"'),
   'vision-lesen','vision');
  return spreadVoll(asset('bewegt-vision-poster.webp'),'Eine Gruppe junger Kreativer geht gemeinsam eine sonnige Straße entlang',
   tag('PAWN / SCHLUSS')+'<h1>Make<br><em>your move.</em></h1>'
   +'<p class="body-copy lead">Jeder beginnt als Bauer. Keiner bleibt einer.</p>'
   +'<p class="bild-marke">Vier Häuser hängen bereits: 07, 12, 18, 24. Vielleicht hängt deine Nummer als Nächstes.</p>'
   +'<button class="text-link leise hell" data-chat>Lieber erst fragen? Frag PAWN <span aria-hidden="true">↗</span></button>'
   +zug('DEIN ZUG','Dein Haus eröffnen','Sechs Schritte. Antwort in 48 Stunden.','data-route="fuer-designer"'),{welt:'vision',karte:true,video:asset('bewegt-vision.mp4')});
 }
 if(route.section==='fuer-designer'){
  if(i===0)return spreadVoll(asset('bewegt-spiel-poster.webp'),'Drei Kreative vor Orange, Kobalt und Rot in voller Bewegung',
   tag('FÜR DESIGNER')+'<h1>Play<br><em>your own<br>game.</em></h1>'
   +'<ol class="drei-zuege">'
   +'<li><span>01</span><strong>Dein Haus</strong><small>Eine Nummer, eine Doppelseite, deine Regeln.</small></li>'
   +'<li><span>02</span><strong>Dein Anteil</strong><small>93 % jedes Verkaufs bleiben bei dir. Kein Abo.</small></li>'
   +'<li><span>03</span><strong>Unsere Antwort</strong><small>In 48 Stunden, persönlich — auch bei einem Nein.</small></li>'
   +'</ol>'
   +zug('DEIN ZUG','Bewerbung starten','Sechs Schritte, etwa fünf Minuten.','data-apply'),{welt:'vision',karte:true,video:asset('bewegt-spiel.mp4')});
  return page(tag('DAS STUDIO / HINTER DEINEM HAUS')+'<h2>Du gestaltest<br><em>deine Doppelseite.</em></h2><div class="studio-blocks"><span>01 / Auftakt & Geschichte</span><span>02 / Bilder & Lookbook</span><span>03 / Ausgewählte Arbeiten</span></div><p class="body-copy">Reihenfolge, Sichtbarkeit und Auswahl bestimmst du. Das Heft setzt es.</p><button class="text-link" data-studio="drape">So richtet ein Haus seine Doppelseite ein — probier es an DRAPÉ <span aria-hidden="true">↗</span></button>',
   tag('DEINE BEWERBUNG')+'<h2>Sechs Schritte.<br><em>Ein Gespräch.</em></h2><ol class="schritte">'+applicationSteps.map((s,n)=>'<li><span>0'+(n+1)+'</span><strong>'+s+'</strong></li>').join('')+'</ol>'+pawnSagt('Drei Bilder und ein paar Sätze zu deiner Arbeit. Handyfotos sind in Ordnung — Hauptsache ehrlich.')+zug('DEIN ZUG','Bewerbung starten','Etwa fünf Minuten.','data-apply'));
 }
 return '';
}
// Der Passform-Assistent: aus hinterlegten Maßen wird eine Größe, aus der Linie ein Urteil.
export function groesseAus(m={},p){
 if(!p.sizes?.length||!m.chest_cm)return null;
 const brust=Number(m.chest_cm),fall=m.fit_preference||'gerade';
 let idx=brust<88?0:brust<96?1:brust<104?2:3;
 if(fall==='weit')idx=Math.min(3,idx+1);if(fall==='eng')idx=Math.max(0,idx-1);
 const reihe=['XS','S','M','L'],ziel=reihe[idx];
 if(p.sizes.includes(ziel))return ziel;
 // Nächstliegende vorhandene Größe statt der ersten.
 const vorhanden=reihe.filter(r=>p.sizes.includes(r));if(!vorhanden.length)return p.sizes[0];
 return vorhanden.reduce((best,r)=>Math.abs(reihe.indexOf(r)-idx)<Math.abs(reihe.indexOf(best)-idx)?r:best,vorhanden[0]);
}
export function passformAssistent(p,state){
 const m=state.measurements||{},st=state.stil||{},u=urteil(st,p),groesse=groesseAus(m,p);
 let inhalt='';
 if(p.sizes?.length){
  inhalt+=groesse
   ?'<p class="passform-satz"><strong>Deine Größe: '+groesse+'</strong> — aus Brust '+esc(m.chest_cm)+' cm'+(m.fit_preference?', Fall „'+esc(m.fit_preference)+'“':'')+'.</p><button class="solid" type="button" data-groesse="'+groesse+'">Größe '+groesse+' übernehmen</button>'
   :'<p class="passform-satz">Hinterleg deine Maße einmal — dann steht hier deine Größe.</p><button class="solid" type="button" data-goto="dna:6">Maße hinterlegen</button>';
 }else if(p.world==='interior'){
  inhalt+='<p class="passform-satz">'+(state.foto?'Dein Raumfoto liegt vor. Im verbundenen System prüft PAWN hier Maß und Licht.':'Lade ein Foto von deinem Raum hoch — PAWN prüft, ob das Stück hineinpasst.')+'</p>'+(state.foto?'':'<button class="solid" type="button" data-goto="dna:4">Raumfoto hinzufügen</button>');
 }else{
  inhalt+='<p class="passform-satz">'+(st.form?'Dein Format: '+esc(st.form)+'.':'Wähle dein Format in der DNA — dann sagt PAWN, ob die Arbeit an deine Wand passt.')+'</p>'+(st.form?'':'<button class="solid" type="button" data-goto="dna:3">Format wählen</button>');
 }
 const urteilHtml=u?'<p class="passform-urteil '+(u.ja===true?'ja':u.ja===false?'nein':'')+'"><small>STEHT MIR DAS?</small>'+esc(u.text)+'</p>':'';
 return '<section class="passform"><p class="eyebrow">PASSFORM-ASSISTENT</p>'+inhalt+urteilHtml+(u&&u.ja!=null?'':'<button class="text-link" type="button" data-style-check="'+p.id+'">Meine Linie prüfen <span aria-hidden="true">↗</span></button>')+'</section>';
}
export function productView(p,state){
 const h=houses[p.house],mode=purchaseMode(p);
 return '<div class="drawer-photo">'+img(p.image,p.name)+'</div>'+tag('HAUS '+h.number+' / '+labels[p.world])+'<h2 id="dialog-title">'+p.name+'</h2><button class="designer-link" data-house="'+h.slug+'">Von '+h.name+' · Das Haus besuchen ↗</button><p class="price">'+money(p.price)+'</p><p>'+p.description+'</p><form data-cart-form data-id="'+p.id+'">'+(p.sizes.length?'<fieldset><legend>Größe wählen</legend><div class="sizes">'+p.sizes.map(s=>'<label><input type="radio" name="size" value="'+s+'" '+(mode==='cart'?'required':'disabled')+'><span>'+s+'</span></label>').join('')+'</div></fieldset>':'')+'<p class="availability">'+p.lead+'</p>'+(mode==='cart'?'<button class="solid" type="submit">In die Tasche</button>':mode==='inquiry'?'<button class="solid" type="button" data-inquiry="'+p.id+'">Beim Haus anfragen</button>':'<button class="solid" type="button" disabled>Zurzeit vergriffen</button><button class="outline" type="button" data-inquiry="'+p.id+'">Beim Haus anfragen</button>')+'</form>'+passformAssistent(p,state)+'<button class="save-button" data-save="'+p.id+'">'+(state.saved.includes(p.id)?'♥ Gemerkt':'♡ Stück merken')+'</button><details><summary>Material & Pflege</summary><p>'+p.material+'.</p></details><details><summary>Versand & Rückgabe</summary><p>'+p.lead+'. Jedes Haus versendet selbst — die Konditionen stehen an der Bestellung.</p></details>'+(state.vorschau!==false?'<p class="small-note">Vorschau — es wird nichts bestellt, nichts gesendet.</p>':'');
}
export function cartView(state){
 const cart=(state.cart||[]).filter(r=>products[r.id]);
 const gruppen={};for(const r of cart)(gruppen[products[r.id].house]||(gruppen[products[r.id].house]=[])).push(r);
 const slugs=Object.keys(gruppen),mehrere=slugs.length>1;
 const zeile=row=>{const p=products[row.id];return '<div class="cart-row">'+img(p.image,p.name)+'<div><button data-product="'+p.id+'">'+p.name+'</button><small>'+houses[p.house].name+(row.size?' · '+row.size:'')+'</small><span>'+row.qty+' × '+money(p.price)+'</span><button class="subtle" data-remove="'+row.id+'|'+row.size+'">Entfernen</button></div></div>';};
 const summe=rows=>rows.reduce((n,r)=>n+r.qty*(products[r.id].price||0),0);
 const haeuser=slugs.map(slug=>'<section class="tasche-haus"><p class="eyebrow">HAUS '+houses[slug].number+' / '+houses[slug].name+'</p>'+gruppen[slug].map(zeile).join('')
  +'<div class="cart-total"><span>'+(mehrere?'Bei '+houses[slug].name:'Gesamt')+'</span><strong>'+money(summe(gruppen[slug]))+'</strong></div>'
  +'<button class="solid" data-checkout="'+slug+'">'+(mehrere?'Bei '+houses[slug].name+' bezahlen':'Zur Kasse')+'</button></section>').join('');
 return tag('DEINE TASCHE')+'<h2 id="dialog-title">Deine Tasche.</h2>'+(cart.length?haeuser+(mehrere?'<p class="small-note">Jedes Haus versendet und rechnet selbst ab — darum eine Zahlung je Haus.</p>':''):'<div class="empty-paper">Deine Tasche ist noch leer. Sieh dich auf der Bühne um.</div><button class="solid" data-route="mode">Mode entdecken</button>')+(state.vorschau!==false?'<p class="small-note">Vorschau — es wird nichts bestellt, nichts gesendet.</p>':'');
}
export const applicationSteps=['Dein Zugang','Welt','Dein Haus','Deine Arbeit','Verträge','Letzter Blick'];
export function applicationView(step,values){
 const v=n=>esc(values[n]||'');
 let content='';
 if(step===0)content='<label>Dein Name<input name="name" autocomplete="name" required value="'+v('name')+'"></label><label>E-Mail<input name="email" type="email" autocomplete="email" required value="'+v('email')+'"></label><p class="small-note">In der echten Bewerbung wird hier das Konto angelegt. Diese Vorschau verlangt kein Passwort.</p>';
 if(step===1)content='<fieldset><legend>In welcher Welt arbeitest du?</legend>'+['Mode','Interior','Kunst'].map(s=>'<label class="choice"><input name="world" type="radio" value="'+s+'" required '+(values.world===s?'checked':'')+'>'+s+'</label>').join('')+'</fieldset>';
 if(step===2)content='<label>Name deines Hauses<input name="brand" required value="'+v('brand')+'"></label><label>Stadt<input name="city" required value="'+v('city')+'"></label><label>Land<input name="country" required value="'+v('country')+'"></label>';
 if(step===3)content='<label>Was macht deine Arbeit aus?<textarea name="story" rows="5" minlength="30" required>'+v('story')+'</textarea></label><label>Portfolio-Link<input name="portfolio" type="url" placeholder="https://" value="'+v('portfolio')+'"></label><label>Bilder deiner Arbeit<input type="file" name="portfolioFiles" accept="image/*" multiple></label><p class="small-note">Mindestens 30 Zeichen. Dateien werden hier nur ausgewählt und nicht hochgeladen.</p>';
 if(step===4)content='<h3>Ein gemeinsamer Rahmen.</h3><p>Im bestehenden Ablauf werden an dieser Stelle die aktuellen Vereinbarungen geladen und bestätigt.</p><label class="choice"><input type="checkbox" name="review" required '+(values.review?'checked':'')+'> Ich habe diesen Vorschau-Schritt angesehen.</label><p class="small-note">Dies ist keine rechtliche Zustimmung und kein Vertragsabschluss.</p>';
 if(step===5)content='<dl class="review-list">'+[['Name','name'],['E-Mail','email'],['Welt','world'],['Haus','brand'],['Stadt','city'],['Land','country'],['Arbeit','story'],['Portfolio','portfolio']].map(([label,n])=>'<div><dt>'+label+'</dt><dd>'+v(n)+'</dd></div>').join('')+'</dl><p class="small-note">Alles bleibt in dieser geöffneten Vorschau. Es wird nichts an PAWN gesendet.</p>';
 return tag('FÜR DESIGNER / BEWERBUNG')+'<h2 id="dialog-title">'+applicationSteps[step]+'.</h2><div class="step-track">'+applicationSteps.map((s,i)=>'<span class="'+(i===step?'active':'')+'">'+(i+1)+'</span>').join('')+'</div><p class="small-note">Schritt '+(step+1)+' von 6</p><form data-application>'+content+'<div class="form-actions">'+(step?'<button type="button" class="outline" data-apply-back>Zurück</button>':'')+'<button class="solid" type="submit">'+(step===5?'Vorschau abschließen':'Weiter ↗')+'</button></div></form>';
}
