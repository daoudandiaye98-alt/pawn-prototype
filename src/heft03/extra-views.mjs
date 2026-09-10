import {products,houses,labels,asset} from './data.mjs';
import {kuratiere} from './kuration.mjs';
import {esc,money,productCard,zug,ausschnitt,spreadVoll} from './views.mjs';
import {searchProducts,housePresentation} from './presentation.mjs';
import {sections} from './data.mjs';
import {belegeFigur} from './figuren.mjs';
import {welten,richtungen,formen,fotoStufe,fuerWen,befund,urteil,bildVon} from './beratung.mjs';
const tag=t=>'<p class="eyebrow">'+t+'</p>';
const button=(t,a,c='text-link')=>'<button class="'+c+'" '+a+'>'+t+' <span aria-hidden="true">↗</span></button>';
const page=(l,r,c='',welt='')=>'<div class="spread-grid '+c+'"'+(welt?' data-welt="'+welt+'"':'')+'><section class="paper-page left-paper">'+l+'</section><section class="paper-page right-paper">'+r+'</section></div>';
const wahl=(feld,werte,gewaehlt)=>'<div class="wahlreihe">'+werte.map(w=>'<button class="wahl'+(gewaehlt===w?' an':'')+'" data-wahl="'+feld+':'+w+'" aria-pressed="'+(gewaehlt===w?'true':'false')+'">'+w+'</button>').join('')+'</div>';
const link=(n,title,text,attrs)=>'<button class="feature-link" '+attrs+'><span class="feature-no">'+n+'</span><span><strong>'+title+'</strong><small>'+text+'</small></span><span>↗</span></button>';
const PAWN_PFAD='M50 4c11 0 20 9 20 20 0 7.5-4.1 14-10.2 17.4 1.5 1.5 2.4 3.5 2.4 5.8 0 2.6-1.2 4.9-3.1 6.4C63.4 60 68 70.8 69.6 82H30.4C32 70.8 36.6 60 40.9 53.6c-1.9-1.5-3.1-3.8-3.1-6.4 0-2.3.9-4.3 2.4-5.8C34.1 38 30 31.5 30 24c0-11 9-20 20-20zM22 88h56l6 10H16z';
export const pawnNotizen=[
 'Ich lese nur, was du mir zeigst. Kein Profil, kein Score.',
 'Je mehr du dir ansiehst, desto genauer wird die Skizze.',
 'Fehlt mir etwas, sage ich es — statt zu raten.'
];
let pawnLauf=0;
// Der Bauer erklärt in einem Satz, was hier zu tun ist.
export function pawnSagt(text){
 return '<div class="pawn-sagt">'+pawnGlyph('klein')+'<p>'+text+'</p></div>';
}
export function pawnGlyph(cls=''){const id='pg'+(++pawnLauf);
 return '<span class="pawn-symbol '+cls+'"><svg viewBox="0 0 100 100" aria-hidden="true">'
 +'<defs><clipPath id="'+id+'c"><path d="'+PAWN_PFAD+'"/></clipPath>'
 +'<pattern id="'+id+'h" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">'
 +'<line x1="0" y1="0" x2="0" y2="3.4" stroke="var(--house-paper,#f6f1e7)" stroke-width="1" opacity=".26"/></pattern></defs>'
 +'<path d="'+PAWN_PFAD+'"/><rect clip-path="url(#'+id+'c)" width="100" height="100" fill="url(#'+id+'h)"/>'
 +'<g class="pawn-augen"><ellipse cx="42.4" cy="23.5" rx="4.3" ry="5.6"/><ellipse cx="57.6" cy="23.5" rx="4.3" ry="5.6"/></g>'
 +'</svg></span>';}
// Der Bauer als Druckfigur: gestochen, nicht leuchtend. Er gehört auf das Papier.
function miniPawn(state){
 const id='pw'+(++pawnLauf),offen=state.pawnNote!=null;
 return '<figure class="pawn-figure'+(offen?' spricht':'')+'">'
 +'<button class="pawn-mark" data-pawn aria-label="Den Bauern fragen">'
 +'<svg viewBox="0 0 100 106" aria-hidden="true">'
 +'<defs><clipPath id="'+id+'c"><path d="'+PAWN_PFAD+'"/></clipPath>'
 +'<pattern id="'+id+'h" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">'
 +'<line x1="0" y1="0" x2="0" y2="3.4" stroke="var(--house-paper,#f6f1e7)" stroke-width="1" opacity=".26"/></pattern></defs>'
 +'<ellipse class="pawn-schatten" cx="50" cy="100" rx="34" ry="3.4"/>'
 +'<g class="pawn-koerper"><path d="'+PAWN_PFAD+'"/>'
 +'<rect clip-path="url(#'+id+'c)" width="100" height="100" fill="url(#'+id+'h)"/>'
 +'<g class="pawn-augen"><ellipse cx="42.4" cy="23.5" rx="4.3" ry="5.6"/><ellipse cx="57.6" cy="23.5" rx="4.3" ry="5.6"/></g></g>'
 +'</svg></button>'
 +'<figcaption><small>DEINE FIGUR</small>Bauer<em>Tipp mich an. Ich sage dir, was ich lese.</em></figcaption>'
 +'<p class="pawn-notiz"'+(offen?'':' hidden')+'>'+esc(pawnNotizen[state.pawnNote??0])+'<span>— PAWN</span></p>'
 +'</figure>';
}

// Das geführte Gespräch — ein Kern für drei Orte: Frag-PAWN-Seite, DNA-Einstieg, schwebendes Fenster.
const ANLAESSE={'Ein Kleidungsstück':['Für jeden Tag','Für den Abend','Für die Arbeit','Als Geschenk'],'Etwas für meinen Raum':['Wohnzimmer','Schlafzimmer','Küche & Tisch','Als Geschenk'],'Ein Kunstwerk':['Für eine Wand','Für eine Sammlung','Als Geschenk','Als Auftragsarbeit']};
const WELT_VON={'Ein Kleidungsstück':'mode','Etwas für meinen Raum':'interior','Ein Kunstwerk':'kunst'};
const RAHMEN={'Bis 200 €':200,'Bis 500 €':500,'Bis 1.500 €':1500,'Offen':null};
export function gespraechErgebnis(state){
 const fr=state.frag||{};if(!(fr.was&&fr.anlass&&fr.rahmen))return null;
 const welt=WELT_VON[fr.was],max=RAHMEN[fr.rahmen];
 const treffer=searchProducts({world:welt,max:max||undefined}),weiter=max?searchProducts({world:welt}).filter(p=>!treffer.includes(p)):[];
 const satz='Du suchst '+({'Ein Kleidungsstück':'ein Kleidungsstück','Etwas für meinen Raum':'etwas für deinen Raum','Ein Kunstwerk':'ein Kunstwerk'}[fr.was])+' — '+fr.anlass.charAt(0).toLowerCase()+fr.anlass.slice(1)+(max?', bis '+max.toLocaleString('de-DE')+' €':', Rahmen offen')+'.';
 return {welt,max,treffer,weiter,satz};
}
// Bestellungen aus der Quelle (orders): eine Zeile je Bestellung, Stücke aus items.
const STATUS={pending:'Offen',paid:'Bezahlt',failed:'Fehlgeschlagen',refunded:'Erstattet',expired:'Abgelaufen',new:'Neu',in_progress:'In Arbeit',packed:'Verpackt',shipped:'Unterwegs',delivered:'Angekommen'};
export function bestellZeilen(orders){
 if(!orders||!orders.length)return '';
 return '<ul class="bestellungen">'+orders.slice(0,6).map(o=>'<li><small>'+esc(o.datum)+' · '+esc(STATUS[o.versand]||STATUS[o.status]||o.status)+(o.nummer?' · '+esc(o.nummer):'')+'</small><strong>'+o.stuecke.map(esc).join(', ')+'</strong><span>'+money(o.summe)+(o.tracking?' · Sendung '+esc(o.tracking):'')+'</span></li>').join('')+'</ul>';
}
// Die Antwort auf einen freien Satz: aus der Quelle (pawn-chat), sonst der Regelsatz des Hefts.
export function antwortHtml(state){
 if(!state.message)return '';
 const du='<p class="chat-you"><small>DU</small>'+esc(state.message)+'</p>';
 if(state.denkt)return du+'<p class="chat-pawn tippt"><small>PAWN</small><span class="punkte"><i></i><i></i><i></i></span></p>';
 const a=state.antwort&&state.antwort.zu===state.message?state.antwort:null;
 if(!a)return du+'<p class="chat-pawn"><small>PAWN</small>Verstanden. Ich sortiere die Stücke danach.</p>';
 const stuecke=(a.treffer||[]).map(slug=>Object.values(products).find(p=>p.slug===slug||p.id===slug)).filter(Boolean).slice(0,3);
 return du+'<p class="chat-pawn"><small>PAWN</small>'+esc(a.reply||'')+'</p>'
  +(stuecke.length?'<div class="treffer">'+stuecke.map(p=>'<button class="treffer-stueck" data-product="'+p.id+'"><img src="'+p.image+'" alt="'+esc(p.name)+'"><span><strong>'+esc(p.name)+'</strong><small>'+esc(houses[p.house].name)+' · '+money(p.price)+'</small></span></button>').join('')+'</div>':'');
}
export function gespraechKern(state,{frei=false}={}){
 const fr=state.frag||{};
 const chips=(feld,werte)=>'<div class="chips">'+werte.map(w=>'<button class="chip'+(fr[feld]===w?' an':'')+'" data-frag="'+feld+':'+esc(w)+'" aria-pressed="'+(fr[feld]===w?'true':'false')+'">'+esc(w)+'</button>').join('')+'</div>';
 const bisher=[['was',fr.was],['anlass',fr.anlass],['rahmen',fr.rahmen]].filter(([,v])=>v);
 const bisherZeile=bisher.length?'<div class="bisher"><small>Bisher</small>'+bisher.map(([f,v])=>'<button class="chip an" data-frag="'+f+':'+esc(v)+'" title="Ändern">'+esc(v)+' <i aria-hidden="true">×</i></button>').join('')+'</div>':'';
 const erg=gespraechErgebnis(state);
 let lauf='',schritt=1;
 if(frei&&!fr.was){lauf='<p class="chat-pawn"><small>PAWN</small>Erzähl mir, was dir gefällt — oder zeig mir ein Bild. Oder tipp an, was du suchst:</p>'+chips('was',Object.keys(ANLAESSE))+antwortHtml(state);}
 else if(!fr.was)lauf='<p class="chat-pawn"><small>PAWN</small>Was suchst du?</p>'+chips('was',Object.keys(ANLAESSE));
 else if(!fr.anlass){schritt=2;lauf='<p class="chat-pawn"><small>PAWN</small>Wofür?</p>'+chips('anlass',ANLAESSE[fr.was]);}
 else if(!fr.rahmen){schritt=3;lauf='<p class="chat-pawn"><small>PAWN</small>Dein Rahmen?</p>'+chips('rahmen',Object.keys(RAHMEN));}
 else {
  schritt=4;
  const n=erg.treffer.length;
  lauf='<p class="chat-pawn ergebnis"><small>PAWN</small><strong>'+esc(erg.satz)+'</strong> '
   +(n?(n===1?'Ein Stück passt':n+' Stücke passen')+' in deinen Rahmen'+(state.message?' — und zu deinem Satz':'')+'.':'In diesem Rahmen habe ich gerade nichts.'+(erg.weiter.length?' Bis '+Math.max(...erg.weiter.map(p=>p.price||0)).toLocaleString('de-DE')+' € hätte ich '+(erg.weiter.length===1?'ein Stück':erg.weiter.length+' Stücke')+'.':''))+'</p>'
   +(n?'<div class="treffer">'+erg.treffer.slice(0,3).map(p=>'<button class="treffer-stueck" data-product="'+p.id+'"><img src="'+p.image+'" alt="'+esc(p.name)+'"><span><strong>'+esc(p.name)+'</strong><small>'+esc(houses[p.house].name)+' · '+money(p.price)+'</small></span></button>').join('')+'</div>'
      :(erg.weiter.length?'<div class="chips"><button class="chip" data-frag="rahmen:Offen">Rahmen öffnen</button></div>':''))
   +antwortHtml(state);
 }
 const formular=(fr.rahmen||frei)&&!state.message?'<form data-conversation-form><label class="sr-only">Nachricht an PAWN</label>'
  +'<textarea name="message" aria-label="Nachricht an PAWN" rows="2" maxlength="600" placeholder="'+(frei?'Zum Beispiel: Ich mag klare Schnitte, warme Farben, nichts Glänzendes.':'Noch genauer? Ein Wort reicht: dunkelblau, schwer, bis zum Knie.')+'">'+esc(state.message||'')+'</textarea>'
  +'<div class="chat-form-footer"><label class="reference-upload'+(state.reference?' hat-datei':'')+'"><i aria-hidden="true">'+(state.reference?'✓':'+')+'</i>'+(state.reference?esc(state.reference.slice(0,26)):'Bild hinzufügen')+'<input type="file" name="reference" accept="image/*" data-reference></label>'
  +'<button class="solid">'+(frei?'An PAWN schicken':'Genauer suchen')+'</button></div></form>':'';
 const grenze=!fr.rahmen&&!frei&&!state.message?'<p class="chat-grenze">Tipp eine Antwort an. PAWN führt dich Schritt für Schritt — ohne Fragebogen.</p>':'';
 return {html:bisherZeile+'<div class="conversation gefuehrt" aria-live="polite">'+lauf+'</div>'+formular+grenze,schritt,welt:WELT_VON[fr.was]||'dna',bereit:!!erg,ergebnis:erg};
}
// Kleine Sätze, mit denen der Bauer begleitet. Sie wechseln und verschwinden wieder.
export const begleiterSaetze={
 hero:['Neu hier? Tipp eine Welt an — ich zeige dir den Rest.','Ich bin PAWN. Frag mich, wenn du etwas suchst.','Drei Welten, ein Heft. Wo willst du anfangen?'],
 lesen:['Du kannst blättern — oder mich fragen.','Merk dir ein Stück. Daraus lese ich deine Linie.','Sag mir, ob ich mir das merken darf — dann ist es beim nächsten Öffnen noch da.'],
 dna:['Oder erzähl es mir — tipp mich an.','Zeig mir ein Bild. Ich lese, was du magst.','Ohne dein Ja vergesse ich alles nach dem Schließen.'],
 stage:['Tipp ein Plus an — jedes Stück hat eine Geschichte.','Ich stelle dir jedes Mal etwas Neues auf. Je mehr ich von dir lese, desto genauer.','Frag mich, wenn du etwas Bestimmtes suchst.']
};
export function pawnChat(state){
 const g=gespraechKern(state,{frei:true});
 return '<div class="chat-kopf">'+pawnGlyph('klein')+'<div><strong>Frag PAWN</strong><small>DEIN BERATER</small></div><button data-chat-schliessen aria-label="Gespräch schließen">×</button></div>'
  +'<div class="chat-koerper">'+g.html
  +'</div><div class="chat-fuss">'+(state.consent===true?'':'<p class="konto-hinweis"><span>'+(state.consent===false?'PAWN vergisst das nach dem Schließen.':'Noch nichts gespeichert.')+'</span><button class="text-link" data-consent-ja>Merken erlauben <span aria-hidden="true">↗</span></button></p>')+'<button class="text-link" data-route="dna">Zur Stilberatung <span aria-hidden="true">↗</span></button><button class="text-link" data-route="frag-pawn">Ganze Seite <span aria-hidden="true">↗</span></button></div>';
}
export function extendedView(route,state){
 const i=route.index;
 if(route.section==='suche'){
  const results=searchProducts(route),pair=results.slice(i*2,i*2+2);
  const resultPage=(p,n)=>p?tag('PAWN SELECT / '+String(n+1).padStart(2,'0'))+'<button class="search-piece" data-product="'+p.id+'"><img src="'+p.image+'" alt="'+p.name+'"><span class="piece-caption"><small>HAUS '+houses[p.house].number+' / '+houses[p.house].name+'</small><strong>'+p.name+'</strong><span>'+money(p.price)+' <span aria-hidden="true">↗</span></span></span></button>'+(p.note||p.material?'<p class="curation-note">'+esc(p.note||p.material)+'</p>':'')+button('Das Haus entdecken','data-house="'+p.house+'"'):
   tag('EINE AUSWAHL MIT PERSPEKTIVE')+'<div class="search-empty">'+pawnGlyph()+'<h2>'+(results.length?'Raum für<br><em>den nächsten Fund.</em>':'Noch kein<br><em>passendes Stück.</em>')+'</h2><p class="body-copy">'+(results.length?'Das war die Auswahl. Ändere Material oder Haus oben — oder frag PAWN.':'Ändere den Begriff oder das Material oben. Oder sag PAWN, was du suchst.')+'</p>'+button('Auswahl neu öffnen','data-reset-search','outline')+button('Frag PAWN','data-chat')+'</div>';
  return page(resultPage(pair[0],i*2),resultPage(pair[1],i*2+1),'search-spread');
 }
 if(route.section==='konto'){
  const n=state.saved.length,stueckZahl=n===1?'1 gemerktes Stück':n+' gemerkte Stücke',linie=(state.stil||{}).richtung;
  const dnaSeite=name=>sections.dna.indexOf(name);
  if(i===3)return spreadVoll(asset('anfrage-brief.webp'),'Eine Gestalterin schreibt am Werktisch im Nachmittagslicht',
   tag('MEIN PAWN / ANFRAGEN')+'<h1>Schreib<br><em>dem Haus.</em></h1>'
   +'<p class="body-copy lead">Auftragsarbeiten beginnen mit einer Nachricht an den Menschen, der sie macht.</p>'
   +pawnSagt('Noch keine Anfrage. Öffne ein Stück und tipp „Beim Haus anfragen“.')
   +zug('DEIN ZUG','Auftragsarbeiten ansehen','Kunst, die im Gespräch entsteht.','data-route="kunst"'),{welt:'dna',rechts:false});
  if(i===4)return page(
   tag('MEIN PAWN / EINSTELLUNGEN')+'<h1>Zugang,<br><em>Angaben, Gedächtnis.</em></h1><p class="body-copy">Dein Name, deine E-Mail — und was PAWN sich merken darf.</p>'
   +link('01','Was PAWN sich merkt','Sehen, ändern, löschen','data-dna-privacy')+link('02','Bestellungen','Deine Stücke und Anfertigungen','data-page="2"')
   +'<p class="small-note">Adresse und Zahlung gibst du beim Bezahlen an — sie hängen an der Bestellung.</p>',
   tag('DEINE ANGABEN')+pawnSagt('Zwei Felder. Mehr brauche ich nicht.')+'<form data-profile-form><label>Dein Name<input name="name" maxlength="50" required value="'+esc(state.profile?.name||'')+'"></label><label>E-Mail<input name="email" type="email" required value="'+esc(state.profile?.email||'')+'"></label><button class="solid">Speichern</button></form>'
   +'<div class="aktionsreihe">'+button('Zurück zu Mein PAWN','data-page="0"')+button('Abmelden','data-logout','outline')+'</div>');
  if(i===1)return page(
   tag('MEIN PAWN / MERKZETTEL')+'<h1>Deine<br><em>Auswahl.</em></h1><p class="body-copy">'+(n?'Stücke, bei denen du stehen geblieben bist. Tipp eines an, um es wieder zu öffnen.':'Noch nichts gemerkt. Tipp ein Stück an — ich merke es dir.')+'</p>'+pawnSagt('Jedes gemerkte Stück ist ein Beleg. Daraus lese ich deine Linie.')+'<img class="blatt-bild" src="'+asset('edit-tonleiter.webp')+'" alt="Sechs Papierproben in einer aufsteigenden Reihe">',
   tag('DEIN MERKZETTEL / '+stueckZahl.toUpperCase())+(n?'<div class="profile-saved">'+state.saved.map(productCard).join('')+'</div>':'<p class="tafel-legende">Drei Stücke, mit denen andere anfangen:</p><div class="fit-pieces drei merk-leer">'+kuratiere('edit',state).map(id=>'<button data-product="'+id+'"><img src="'+products[id].image+'" alt="'+esc(products[id].name)+'"><span>'+esc(products[id].name)+'</span></button>').join('')+'</div>')
   +(n?zug('DEIN ZUG',linie?'Steht mir das?':'Deine Linie lesen',linie?'Prüf deine Stücke gegen deine Linie.':'Vier Bilder, zwei Minuten.','data-goto="dna:'+(linie?'linie':'welt')+'"'):zug('DEIN ZUG','Mode entdecken','Merk dir dein erstes Stück.','data-route="mode"')));
  if(i===2)return spreadVoll(asset('archetyp-editorial.webp'),'Ein Stapel Papier auf dunklem Holz',
   tag('MEIN PAWN / BESTELLUNGEN')+'<h1>Deine<br><em>Bestellungen.</em></h1>'
   +'<p class="body-copy lead">Jedes Stück, das du kaufst, bekommt hier seine Zeile.</p>'
   +bestellZeilen(state.orders)
   +((state.orders||[]).length?'':pawnSagt((state.cart||[]).length?'In deiner Tasche liegt schon etwas. Bring es zur Kasse.':'Noch leer. Öffne die Tasche — dort liegt, was du vorgemerkt hast.'))
   +zug('DEIN ZUG','Tasche öffnen','Was du vorgemerkt hast.','data-cart'),{welt:'dna'});
  return page(
   tag('MEIN PAWN / DEIN PLATZ IM MAGAZIN')+'<div class="profile-cover"><img class="blatt-bild" src="'+asset('edit-atelier.webp')+'" alt="Ein Atelier im Morgenlicht">'+pawnGlyph()+'<h1>Your<br><em>move.</em></h1><p>Ein eigener Blick.<br>Ein eigener Weg.</p></div>',
   tag(state.profile?'WILLKOMMEN ZURÜCK':'ZUTRITT')
   +(state.profile
    ?'<h2>Willkommen zurück,<br><em>'+esc(state.profile.name||'du')+'.</em></h2>'
     +link('01','Merkzettel',stueckZahl,'data-page="1"')+link('02','Deine DNA',linie?'Deine Linie: '+esc(linie)+((state.stil||{}).form?' & '+esc(state.stil.form):''):'Noch keine Linie','data-route="dna"')+link('03','Bestellungen','Deine Stücke und Anfertigungen','data-page="2"')+link('04','Anfragen','Im Dialog mit den Häusern','data-page="3"')+link('05','Einstellungen','Zugang, Angaben, Gedächtnis','data-page="4"')
     +zug('DEIN ZUG',linie?'Ausgewählt für dich':'Deine Linie lesen',linie?'Drei Stücke nach deiner Linie.':'Vier Bilder, zwei Minuten.',linie?'data-goto="entdecken:1"':'data-goto="dna:welt"')
    :'<h2>Trag dich<br><em>ein.</em></h2><p class="body-copy">Merkzettel, Bestellungen, deine Linie — an einem Platz, auch beim nächsten Öffnen.</p><form data-profile-form><label>Dein Name<input name="name" autocomplete="given-name" maxlength="50" placeholder="Wie heißt du?" required></label><label>E-Mail<input name="email" type="email" autocomplete="email" placeholder="du@beispiel.de" required></label><button class="solid">Konto anlegen</button></form><p class="small-note">Vorschau — es wird nichts gesendet. Gespeichert wird nur auf diesem Gerät, wenn du es erlaubst.</p>'),
   'account-spread');
 }
 if(route.section==='frag-pawn'){
  const g=gespraechKern(state),welt=g.welt,erg=g.ergebnis;
  const beispiele={mode:[['Ein Wollmantel für den Winter','Ein Kleidungsstück','Für jeden Tag','Bis 500 €'],['Etwas Dunkles für den Abend','Ein Kleidungsstück','Für den Abend','Bis 1.500 €'],['Ein Kleid, das fällt','Ein Kleidungsstück','Für den Abend','Bis 500 €']],
   interior:[['Ein Sessel für die Leseecke','Etwas für meinen Raum','Wohnzimmer','Bis 1.500 €'],['Etwas Handgemachtes für den Tisch','Etwas für meinen Raum','Küche & Tisch','Bis 200 €'],['Ein Geschenk mit Gewicht','Etwas für meinen Raum','Als Geschenk','Bis 500 €']],
   kunst:[['Ein Bild für über dem Sofa','Ein Kunstwerk','Für eine Wand','Offen'],['Der Anfang einer Sammlung','Ein Kunstwerk','Für eine Sammlung','Offen'],['Ein Porträt nach Wunsch','Ein Kunstwerk','Als Auftragsarbeit','Offen']]};
  const liste=beispiele[welt==='dna'?'mode':welt].concat(welt==='dna'?[beispiele.interior[0],beispiele.kunst[0]]:[]).slice(0,3);
  return page(
   tag('FRAG PAWN / DEIN BERATER')+'<div class="concierge-cover">'+pawnGlyph('lauscht')
   +'<h1>Sag mir,<br><em>was du suchst.</em></h1>'
   +'<p class="body-copy lead">Dreimal antippen. Dann liegen die Stücke vor dir.</p>'
   +'<p class="prompt-titel">Oder tipp ein Beispiel an</p><div class="prompt-list">'
   +liste.map(([t,w,an,r])=>button(t,'data-prompt="'+esc(w+'|'+an+'|'+r+'|'+t)+'"','outline')).join('')
   +'</div></div>',
   tag(erg?'DEIN ERGEBNIS':'DAS GESPRÄCH / SCHRITT '+g.schritt+' VON 3')+g.html
   +(erg?zug('DEIN ZUG',erg.treffer.length?'Diese Stücke ansehen':'Die ganze Welt ansehen',erg.treffer.length?'Auf der Bühne, in deinem Rahmen.':'Ohne Rahmen — alles, was die Welt zeigt.','data-route="'+welt+'"')
        :'<button class="text-link leise" data-route="haeuser">Lieber selbst blättern <span aria-hidden="true">↗</span></button>'),
   'gespraech',welt);
 }
 if(route.section==='dna'){
  // Seiten heißen, nicht zählen: intro · welt · richtung · form · linie · foto · massband · privacy
  const NAMEN=sections.dna,name=NAMEN[i]||'intro',nr=n=>NAMEN.indexOf(n);
  const st=state.stil||{},welt=st.welt||'mode',weltName=welten.find(w=>w.wert===welt).name;
  const fragen={mode:'Steht mir das?',interior:'Passt das in meinen Raum?',kunst:'Passt das an meine Wand?'}[welt];
  const kachel=(feld,e,weiter)=>'<button class="bildwahl'+(st[feld]===e.wert?' an':'')+'" data-wahl="'+feld+':'+esc(e.wert)+'"'+(weiter!=null?' data-weiter="'+weiter+'"':'')+' aria-pressed="'+(st[feld]===e.wert?'true':'false')+'"><img src="'+bildVon(e.bild)+'" alt="" decoding="async"><span class="bildwahl-text"><strong>'+esc(e.name||e.wert)+'</strong><small>'+esc(e.text||e.frage||'')+'</small></span><i class="bildwahl-haken" aria-hidden="true">✓</i></button>';
  const schritt=n=>tag('DEINE STILBERATUNG / SCHRITT '+n+' VON 3');
  const weltBild=(hoehe=300)=>'<img class="blatt-bild welt" style="height:'+hoehe+'px" src="'+bildVon(welten.find(w=>w.wert===welt).bild)+'" alt="">';
  const richtung=richtungen[welt].find(e=>e.wert===st.richtung);
  const recap=()=>'<dl class="befund"><div><dt>Welt</dt><dd>'+esc(weltName)+'</dd></div><div><dt>Richtung</dt><dd>'+esc(st.richtung||'—')+'</dd></div><div><dt>'+esc(formen[welt].titel.replace('Deine ','').replace('Dein ',''))+'</dt><dd>'+esc(st.form||'—')+'</dd></div></dl>';
  if(name==='intro')return spreadVoll(asset('foto-spiegel.webp'),'Eine Frau vor einem dreiteiligen Spiegel, in jedem Spiegel ein anderer Stil',
   tag('DEINE DNA')+'<h1>PAWN liest<br><em>mit.</em></h1>'
   +'<p class="body-copy lead">Deine Linie entsteht von selbst — aus dem, was du ansiehst, dir merkst und kaufst.</p>'
   +'<ol class="schritte knapp hell"><li><span>01</span><strong>Ansehen</strong></li><li><span>02</span><strong>Merken</strong></li><li><span>03</span><strong>Kaufen</strong></li></ol>'
   +'<p class="bild-marke">'+(state.saved.length?state.saved.length+(state.saved.length===1?' gemerktes Stück liegt':' gemerkte Stücke liegen')+' schon vor.':'Du musst nichts ausfüllen. Willst du schneller sein: vier Bilder, zwei Minuten.')+'</p>'
   +zug('DEIN ZUG','Stilberatung starten','Vier Bilder. Zwei Minuten. Deine Linie.','data-page="'+nr('welt')+'"'),{welt:'dna',karte:true});
  if(name==='welt')return page(
   schritt(1)+'<h1>Tipp deine<br><em>Welt an.</em></h1>'+pawnSagt('Tipp eine Welt an. Die Seite blättert von selbst weiter.')
   +'<div class="bauer-buehne">'+pawnGlyph('gross')+'</div><p class="tafel-legende">Du kannst später jederzeit wechseln.</p>',
   tag('DREI WELTEN / EINE HALTUNG')+'<div class="bildwahl-reihe drei">'+welten.map(w=>kachel('welt',w,nr('richtung'))).join('')+'</div>','','dna');
  if(name==='richtung')return page(
   schritt(2)+'<h1>Tipp deine<br><em>Richtung an.</em></h1>'+pawnSagt('Tipp das Bild an, das dich trifft. Nicht nachdenken.')
   +weltBild(280)+recap()+button('Welt wechseln','data-page="'+nr('welt')+'"'),
   tag('VIER RICHTUNGEN / EINE TRIFFT')+'<div class="bildwahl-reihe">'+richtungen[welt].map(e=>kachel('richtung',e,nr('form'))).join('')+'</div>','','dna');
  if(name==='form'){
   const f=formen[welt];
   return page(
    schritt(3)+'<h1>'+esc(f.titel).replace(' ','<br><em>')+'.</em></h1>'+pawnSagt(f.frage+' Tipp ein Bild an.')
    +(richtung?'<div class="recap-kachel"><img src="'+bildVon(richtung.bild)+'" alt=""><span><small>DEINE RICHTUNG</small><strong>'+esc(richtung.wert)+'</strong></span></div>':weltBild(240))
    +recap()+button('Richtung ändern','data-page="'+nr('richtung')+'"'),
    tag(esc(f.titel).toUpperCase()+' / VIER BILDER')+'<div class="bildwahl-reihe">'+f.werte.map(e=>kachel('form',e,nr('linie'))).join('')+'</div>','','dna');
  }
  if(name==='linie'){
   const b=befund(st),auswahl=Object.values(products).filter(p=>p.world===welt).slice(0,3),gewaehlt=state.fitProduct?products[state.fitProduct]:null,u=urteil(st,gewaehlt);
   return page(
    tag('DEINE LINIE')+'<h1>'+esc(b.linie).replace(' & ','<br><em>&amp; ')+(b.linie.includes(' & ')?'</em>':'')+'</h1>'
    +(richtung?'<div class="recap-kachel gross"><img src="'+bildVon(richtung.bild)+'" alt=""><span><small>DEINE RICHTUNG</small><strong>'+esc(richtung.wert)+'</strong></span></div>':weltBild(260))
    +'<p class="tafel-legende">'+esc(b.satz)+'</p>'
    +button('Antworten ändern','data-page="'+nr('richtung')+'"'),
    tag(fragen.toUpperCase()+' / TIPP EIN STÜCK AN')+pawnSagt('Tipp ein Stück an. Ich sage dir, ob es zu deiner Linie passt — und warum.')
    +'<div class="fit-pieces'+(auswahl.length>2?' drei':'')+'">'+auswahl.map(p=>'<button data-fit="'+p.id+'" aria-pressed="'+(state.fitProduct===p.id?'true':'false')+'" class="'+(state.fitProduct===p.id?'an':'')+'"><img src="'+p.image+'" alt="'+esc(p.name)+'"><span>'+esc(p.name)+'</span></button>').join('')+'</div>'
    +'<div class="insight'+(u?(u.ja===true?' ja':u.ja===false?' nein':''):'')+'" aria-live="polite"><small>'+esc(gewaehlt?gewaehlt.name.toUpperCase():'DEIN URTEIL')+'</small><p>'+esc(u?u.text:'Noch kein Stück gewählt.')+'</p></div>'
    +zug('DEIN ZUG','Ausgewählt für dich',b.fertig?'Drei Stücke, nach deiner Linie sortiert.':'Was PAWN dir jetzt schon zeigen kann.','data-goto="entdecken:1"'),'','dna');
  }
  if(name==='foto'){
   const fo=fotoStufe[welt];
   return spreadVoll(asset(fo.bild),fo.alt,
    tag('ZUGABE / SCHÄRFER MIT FOTO')+'<h1>'+esc(fo.titel).replace(' ','<br><em>')+'</em></h1>'
    +pawnSagt('Ein Foto reicht. Es bleibt auf deinem Gerät — ich lese nur, was dir steht: '+fo.liest.join(', ')+'.')
    +'<ul class="liest">'+fo.liest.map(l=>'<li>'+esc(l)+'</li>').join('')+'</ul>'
    +(state.foto?'<p class="foto-liegt">Foto liegt vor: '+esc(state.foto)+'</p>':'')
    +'<form data-foto-form class="aktionsreihe"><label class="reference-upload'+(state.foto?' hat-datei':'')+'"><i aria-hidden="true">'+(state.foto?'✓':'+')+'</i>'+(state.foto?'Anderes Foto':esc(fo.knopf))+'<input type="file" name="foto" accept="image/*" data-foto></label></form>'
    +zug('DEIN ZUG',state.foto?'Weiter zu deinen Maßen':'Ohne Foto weiter','Zugabe zwei: Maße'+(welt==='mode'?'':welt==='interior'?' deines Raums':' deiner Wand')+'.','data-page="'+nr('massband')+'"'),{welt:'dna',rechts:false});
  }
  if(name==='massband'){
   const m=state.measurements||{},zurueck=state.fitProduct?zug('DEIN ZUG','← Zurück zu '+esc(products[state.fitProduct].name),'Jetzt mit deiner Größe geprüft.','data-product="'+state.fitProduct+'"'):zug('DEIN ZUG','Was PAWN von dir weiß','Alles auf einer Seite — änderbar, löschbar.','data-page="'+nr('privacy')+'"');
   if(welt==='mode')return page(
    tag('ZUGABE / DEIN MASSBAND')+'<h1>Deine Maße<br><em>reisen mit.</em></h1><img class="blatt-bild" src="'+asset('edit-mass.webp')+'" alt="Maßband, Leinen und ein Umschlag auf Papier"><p class="tafel-legende">Einmal eintragen. Jedes Stück wird gegen deine Maße geprüft — bei jedem Haus anders, weil M bei jedem Haus etwas anderes heißt.</p>',
    tag('DEINE MASSE / IN ZENTIMETERN')+pawnSagt('Brustumfang reicht für die Größe. Der Rest macht sie genauer.')
    +'<form data-measure-form><p class="frage"><span>Für wen suche ich?</span></p>'+wahl('fuerWen',fuerWen,st.fuerWen)
    +'<div class="measure-grid">'
    +[['chest_cm','Brustumfang','an der breitesten Stelle, locker anliegend'],['waist_cm','Taille','an der schmalsten Stelle'],['hip_cm','Hüfte','an der breitesten Stelle'],['shoulder_cm','Schulter','von Naht zu Naht'],['height_cm','Körpergröße','ohne Schuhe'],['inseam_cm','Innenbein','vom Schritt bis zum Knöchel']].map(([n,l,h])=>'<label>'+l+'<small>'+h+'</small><input type="number" name="'+n+'" step=".5" min="1" max="300" value="'+esc(m[n]||'')+'"></label>').join('')
    +'</div><p class="frage"><span>Wie trägst du am liebsten?</span></p><div class="fall-wahl">'+[['eng','Eng','Nah am Körper'],['gerade','Gerade','Klassisch, mit etwas Luft'],['weit','Weit','Volumen, bewusst überschnitten']].map(([v,l,d])=>'<label><input type="radio" name="fit_preference" value="'+v+'" '+((m.fit_preference||'gerade')===v?'checked':'')+'><span><strong>'+l+'</strong><small>'+d+'</small></span></label>').join('')+'</div>'
    +'<button class="solid">Maße speichern</button></form>'+zurueck,'','dna');
   const felder=welt==='interior'?[['wand','Wandbreite','z. B. 3,20 m, Fenster links'],['hoehe','Raumhöhe','z. B. 2,60 m'],['flaeche','Freie Stellfläche','z. B. 1 × 1 m neben dem Sofa']]:[['wand','Freie Wandfläche','z. B. 1,80 × 1,20 m'],['licht','Licht','z. B. Nordfenster, abends Lampe'],['abstand','Abstand zum Betrachter','z. B. 3 m vom Sofa']];
   return page(
    tag('ZUGABE / '+(welt==='interior'?'DEIN RAUM IN ZAHLEN':'DEINE WAND IN ZAHLEN'))+'<h1>'+(welt==='interior'?'Dein Raum<br><em>in Zahlen.</em>':'Deine Wand<br><em>in Zahlen.</em>')+'</h1>'+weltBild(300)+'<p class="tafel-legende">Drei Angaben. Dann passt jede Empfehlung auch räumlich.</p>',
    tag('DREI ANGABEN / FREI FORMULIERT')+pawnSagt('Schreib es so, wie du es einem Freund sagen würdest. Ich lese die Zahlen heraus.')
    +'<form data-measure-form data-raum><div class="measure-grid eins">'+felder.map(([n,l,h])=>'<label>'+l+'<small>'+h+'</small><input name="'+n+'" maxlength="80" value="'+esc(m[n]||'')+'"></label>').join('')+'</div><button class="solid">Angaben speichern</button></form>'+zurueck,'','dna');
  }
  return page(
   tag('DEINE DNA / WAS PAWN VON DIR WEISS')+'<h1>Alles<br><em>auf einer Seite.</em></h1><img class="blatt-bild" src="'+asset('dna-figuren-894.webp')+'" alt="Schachfiguren aus Papier"><p class="tafel-legende">Sehen, ändern, löschen — jede Zeile gehört dir.</p>',
   tag('DEINE ANGABEN')
   +'<dl class="befund tippbar">'
   +'<div><dt>Welt</dt><dd>'+esc(weltName)+'</dd><button class="text-link" data-page="'+nr('welt')+'">ändern</button></div>'
   +'<div><dt>Richtung</dt><dd>'+esc(st.richtung||'—')+'</dd><button class="text-link" data-page="'+nr('richtung')+'">ändern</button></div>'
   +'<div><dt>Form</dt><dd>'+esc(st.form||'—')+'</dd><button class="text-link" data-page="'+nr('form')+'">ändern</button></div>'
   +'<div><dt>Foto</dt><dd>'+(state.foto?esc(state.foto):'—')+'</dd><button class="text-link" data-page="'+nr('foto')+'">ändern</button></div>'
   +'<div><dt>Maße</dt><dd>'+(state.measurements?.chest_cm||state.measurements?.wand?'Hinterlegt':'—')+'</dd><button class="text-link" data-page="'+nr('massband')+'">ändern</button></div>'
   +'<div><dt>Merkzettel</dt><dd>'+state.saved.length+(state.saved.length===1?' Stück':' Stücke')+'</dd><button class="text-link" data-route="konto">ansehen</button></div>'
   +'</dl>'
   +'<label class="choice"><input type="checkbox" data-consent '+(state.consent?'checked':'')+'> <span>PAWN darf sich das merken</span></label>'
   +'<p class="small-note">'+(state.consent?'Gespeichert auf diesem Gerät. Mit Konto auch auf anderen.':'Ohne Häkchen ist nach dem Schließen alles weg.')+'</p>'
   +'<div class="aktionsreihe">'+button('Alles löschen','data-clear-memory','outline')+button('Als Datei sichern','data-export','outline')+'</div>'
   +zug('DEIN ZUG','Ausgewählt für dich','Was PAWN dir aus all dem zeigt.','data-goto="entdecken:1"'),'','dna');
 }
 return null;
}
export function searchToolbar(route){
 const select=(name,values,caption)=>'<label><span>'+caption+'</span><select name="'+name+'">'+values.map(([v,t])=>'<option value="'+v+'" '+((route[name]||'')===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label>';
 return '<form data-search-form><label class="search-query"><span class="sr-only">Arbeit, Haus oder Material suchen</span><input type="search" name="q" aria-label="Arbeit, Haus oder Material suchen" placeholder="Ein Stück. Ein Material. Eine Perspektive." value="'+esc(route.q||'')+'" maxlength="180"></label><button class="solid" type="submit">Finden ↗</button><details class="search-filters"><summary>Filter & Auswahl</summary><div>'+select('world',[['','Alle Welten'],['mode','Mode'],['interior','Interior'],['kunst','Kunst']],'Welt')+select('house',[['','Alle Häuser'],...Object.values(houses).map(h=>[h.slug,h.name])],'Haus')+'<label>Preis bis €<input name="max" type="number" min="0" max="1000000" placeholder="Offen" value="'+esc(route.max||'')+'"></label>'+select('sort',[['','PAWN Auswahl'],['price-up','Preis aufsteigend'],['price-down','Preis absteigend']],'Reihenfolge')+'<label class="choice"><input type="checkbox" name="available" value="1" '+(route.available?'checked':'')+'> Nur verfügbare Arbeiten</label><button class="solid">Auswahl übernehmen</button></div></details></form><p>'+searchProducts(route).length+(searchProducts(route).length===1?' Arbeit':' Arbeiten')+' · Redaktionelle Beispielauswahl</p>';
}
