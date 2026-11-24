/**
 * DIE DREHBUEHNE — die Anprobe in drei Ansichten, wie ein Drehteller.
 *
 * Vorbild ist Mira (trymira.style, „Mira: Virtual Try-on", Chrome-Erweiterung 0.2.14):
 * Dort traegt ein Avatar das Stueck vorne, von der Seite und von hinten, und die
 * Ansichten drehen sich wie auf einem Karussell. Uebernommen ist das MUSTER, nicht der
 * Code — die Anweisungen an das Bildmodell stehen in
 * supabase/functions/_shared/drehbuehne.ts.
 *
 * Diese Datei ist rein: kein DOM, kein Netz. Darum laeuft sie unter node:test
 * (drehbuehne.test.mjs). app.js haelt den Zustand, extra-views.mjs zeichnet mit
 * `drehbuehneHtml`.
 *
 * Der Zustand, den sie liest (state.anprobe):
 *   url            die Vorderansicht (so wie bisher)
 *   ansichten      {vorne, seite, hinten} — signierte Adressen, soweit vorhanden
 *   ansichtenStatus  '' | 'offen' | 'laeuft' | 'fertig' | 'fehler'
 *   dreh           ein ZAEHLER, keine Position: er waechst und faellt unbegrenzt,
 *                  damit die Buehne immer den kurzen Weg dreht (von Ruecken nach vorne
 *                  ein Schritt weiter, nicht zwei zurueck)
 */

export const MAX_STUECKE=3;
export const ANSICHTEN=[{k:'vorne',name:'Vorne'},{k:'seite',name:'Seite'},{k:'hinten',name:'Rücken'}];

/** Ein Stueck an- oder abwaehlen. Beim vierten bleibt die Auswahl, wie sie ist — mit zuViele. */
export function stueckWaehlen(auswahl,id,max=MAX_STUECKE){
 const jetzt=Array.isArray(auswahl)?auswahl.filter(x=>typeof x==='string'&&x):[];
 if(!id)return {auswahl:jetzt,zuViele:false};
 if(jetzt.includes(id))return {auswahl:jetzt.filter(x=>x!==id),zuViele:false};
 if(jetzt.length>=max)return {auswahl:jetzt,zuViele:true};
 return {auswahl:[...jetzt,id],zuViele:false};
}

/**
 * Welche Flaechen die Buehne gerade hat. Eine fehlende Ansicht erscheint nur, solange
 * sie noch entsteht — danach faellt sie weg, statt als leere Flaeche zu luegen.
 */
export function drehFlaechen(a){
 const an=(a&&a.ansichten)||{},status=(a&&a.ansichtenStatus)||'';
 const entsteht=status==='laeuft'||status==='offen';
 return ANSICHTEN.map(({k,name})=>{
  const url=an[k]||(k==='vorne'?((a&&a.url)||''):'');
  return {k,name,url,wartet:!url&&entsteht&&k!=='vorne'};
 }).filter(f=>f.url||f.wartet);
}

/** Aus dem Zaehler die Flaeche, die vorne steht. */
export function drehIndex(dreh,delta,n){
 if(!n)return 0;
 const z=(Number(dreh)||0)+(Number(delta)||0);
 return ((z%n)+n)%n;
}

/** Der kurze Weg zu einer bestimmten Flaeche — als Schritt fuer den Zaehler. */
export function drehZu(dreh,ziel,n){
 if(!n)return 0;
 let d=(((Number(ziel)||0)-drehIndex(dreh,0,n))%n+n)%n;
 if(d>n/2)d-=n;
 return d;
}

/** Tiefe des Rings: ein regelmaessiges n-Eck, dessen Kante die Buehnenbreite ist (in cqw). */
export function ringTiefe(n){return n>=3?+(50/Math.tan(Math.PI/n)).toFixed(2):0;}

const ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>ESC[c]);

/**
 * Die Buehne als HTML: links der Ring, rechts die Spalte — was getragen wird, die
 * Ansichten zum Antippen, der KI-Hinweis und, als `anhang`, das Urteil der Kundin.
 * `titel` = die Namen der Stuecke, `ergebnis` = der Satz der Welt („Du trägst es.").
 * Ohne Vorderansicht gibt es keine Buehne — dann ein leerer Text.
 */
export function drehbuehneHtml(a,{titel='',ergebnis='',anhang='',vorher='',enthuellen=false}={}){
 const f=drehFlaechen(a);
 if(!f.length)return '';
 const n=f.length,dreh=Number(a&&a.dreh)||0,i=drehIndex(dreh,0,n),winkel=n>1?360/n:0;
 const vorherAn=!!(vorher&&a&&a.vorherAn);
 /* `enthuellen` = wie viele Millisekunden die Enthuellung schon laeuft (oder false). Zeichnet
    das Heft mittendrin neu, setzt der Vorhang dort fort, wo er war (negative Verzoegerung),
    statt von vorn zu fallen — die Bewegung haengt an der Uhr, nicht am Neuzeichnen. */
 const vorhangSeit=typeof enthuellen==='number'&&enthuellen>=0?Math.round(enthuellen):(enthuellen===true?0:-1);
 const enthuellt=vorhangSeit>=0&&vorhangSeit<1300;
 const flaechen=f.map((x,j)=>'<div class="drehflaeche'+(x.wartet?' wartet':'')+'" style="--j:'+j+'" aria-hidden="'+(j===i?'false':'true')+'">'
  +(x.url
   ?'<img src="'+esc(x.url)+'" alt="'+esc(x.name+': '+(titel?titel+' — ':'')+ergebnis)+'" draggable="false">'
   :'<span class="anprobe-puls" aria-hidden="true"></span><p class="tafel-legende">'+(x.k==='hinten'?'Der Rücken entsteht.':'Die Seite entsteht.')+'</p>')
  +'</div>').join('');
 const liste=n>1
  ?'<p class="drehbuehne-label">Ansicht</p><ul class="drehbuehne-ansichten">'
   +f.map((x,j)=>'<li><button class="drehbuehne-ansicht" data-anprobe-ansicht="'+j+'" aria-pressed="'+(j===i?'true':'false')+'">'
    +x.name+(x.wartet?' <small>entsteht</small>':'')+'</button></li>').join('')
   +'</ul>'
  :'';
 const name=(titel||'Deine Anprobe')+' — '+n+(n===1?' Ansicht':' Ansichten')+(n>1?'. Mit den Pfeiltasten drehen.':'');
 return '<figure class="drehbuehne'+(enthuellt?' enthuellt':'')+(vorherAn?' zeigt-vorher':'')+'"'+(enthuellt?' style="--vorhang-seit:-'+vorhangSeit+'ms"':'')+' data-drehbuehne tabindex="0" aria-roledescription="Drehbühne" aria-label="'+esc(name)+'">'
  +'<div class="drehbuehne-raum"><div class="drehring" style="--dreh:'+dreh+';--winkel:'+winkel+'deg;--tiefe:'+ringTiefe(n)+'cqw">'+flaechen+'</div>'
  // Vorher: das eigene Bild liegt FLACH ueber dem Ring und wird nur eingeblendet (opacity) —
  // so bleibt der Vergleich ruhig, egal welche Ansicht gerade vorne steht.
  +(vorher
   ?'<img class="drehbuehne-vorher" src="'+esc(vorher)+'" alt="Vorher: dein Bild" aria-hidden="'+(vorherAn?'false':'true')+'" draggable="false">'
    +'<button class="drehbuehne-knopf vorher-knopf" data-anprobe-vorher aria-pressed="'+(vorherAn?'true':'false')+'">Vorher</button>'
   :'')
  +(n>1?'<button class="drehbuehne-knopf weiter-knopf" data-anprobe-drehen="1" aria-label="Weiter drehen"><span aria-hidden="true">↻</span></button>':'')
  +'</div>'
  +'<figcaption class="drehbuehne-seite">'
  +(titel?'<p class="drehbuehne-titel">'+esc(titel)+'</p>':'')
  +(ergebnis?'<p class="drehbuehne-satz">'+esc(ergebnis)+'</p>':'')
  +liste
  // Ist Seite oder Ruecken gescheitert, darf die Kundin es noch einmal anstossen — die
  // Function erlaubt hoechstens drei Laeufe je Anprobe und sagt es, wenn es genug ist.
  +((a&&a.ansichtenStatus)==='fehler'&&n<ANSICHTEN.length
   ?'<button class="drehbuehne-nochmal" data-anprobe-ansichten-neu>Seite und Rücken noch einmal</button>':'')
  +'<small class="drehbuehne-ki">Mit KI erzeugt</small>'
  +anhang
  +'</figcaption></figure>';
}

/**
 * Der Spiegel — derselbe Rahmen wie die Drehbuehne, BEVOR es ein Ergebnis gibt: links das
 * eigene Bild, rechts was gewaehlt ist. Laeuft die Anprobe, legt sich ein Schleier ueber das
 * Bild und eine Linie faehrt darueber (nur transform). Kommt das Ergebnis, steht an derselben
 * Stelle die Buehne — der Rahmen springt nie, nur sein Inhalt wechselt.
 */
export function spiegelHtml({bild='',titel='',laeuft=false,anzahl=0}={}){
 if(!bild)return '';
 const satz=laeuft?'Meist dauert es unter einer Minute.'
  :anzahl?'Bereit. „Outfit anprobieren“ zieht es dir an.':'Wähl rechts bis zu drei Stücke.';
 return '<figure class="drehbuehne spiegel'+(laeuft?' laeuft':'')+'"'+(laeuft?' aria-busy="true"':'')+'>'
  +'<div class="drehbuehne-raum"><img class="spiegel-bild" src="'+esc(bild)+'" alt="Dein Bild" draggable="false">'
  +(laeuft?'<span class="spiegel-schleier" aria-hidden="true"></span><span class="spiegel-scan" aria-hidden="true"></span>':'')
  +'</div>'
  +'<figcaption class="drehbuehne-seite">'
  +'<p class="drehbuehne-label">'+(laeuft?'PAWN legt an':'Dein Spiegel')+'</p>'
  +'<p class="drehbuehne-titel">'+esc(titel||'Noch nichts gewählt')+'</p>'
  +'<p class="drehbuehne-satz" aria-live="polite">'+esc(satz)+'</p>'
  +(laeuft?'<span class="anprobe-puls" aria-hidden="true"></span>':'')
  +'</figcaption></figure>';
}
