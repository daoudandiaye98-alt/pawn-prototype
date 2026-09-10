// Gestochene Tafeln. Sie erklären, wofür sonst ein Absatz nötig wäre.
let lauf=0;
const tafel=(inhalt,cls='',vb='0 0 200 260')=>'<figure class="tafel '+cls+'"><svg viewBox="'+vb+'" aria-hidden="true">'+inhalt+'</svg></figure>';

export function belegeFigur(anzahl=0){
 const striche=[];
 for(let i=0;i<26;i++){
  const x=22+i*7,h=8+(i%5)*7+i*1.4;
  striche.push('<line x1="'+x+'" y1="150" x2="'+x+'" y2="'+(150-h)+'"/>');
 }
 const punkte=[0,1,2].slice(0,Math.max(1,Math.min(3,anzahl||1))).map((n,i)=>'<circle class="beleg-punkt" cx="'+(48+i*66)+'" cy="'+(126-i*22)+'" r="4.4" style="animation-delay:'+(.4+i*.45)+'s"/>').join('');
 return tafel('<g class="gestochen">'+striche.join('')
 +'<line class="achse" x1="14" y1="150" x2="212" y2="150"/>'
 +'<path class="linie" d="M22 142 C74 132 118 108 152 78 C176 56 194 40 206 30"/>'+punkte+'</g>','tafel-belege','0 0 226 168');
}

// Fünf Silhouetten von der Linie, die du heute trägst, zu der, die du willst.
export function richtungsFigur(stufe=0){
 const formen=[
  'M40 30 L30 52 L34 168 L66 168 L70 52 L60 30 L50 40 Z',
  'M38 28 L26 54 L32 172 L68 172 L74 54 L62 28 L50 40 Z',
  'M36 26 L20 58 L28 176 L72 176 L80 58 L64 26 L50 40 Z',
  'M34 24 L14 62 L24 180 L76 180 L86 62 L66 24 L50 40 Z',
  'M32 22 L8 66 L20 184 L80 184 L92 66 L68 22 L50 40 Z'];
 const inhalt=formen.map((d,i)=>{
  const aktiv=i<=stufe;
  return '<g class="silhouette'+(aktiv?' an':'')+'" style="transform:translateX('+(i*98)+'px);animation-delay:'+(i*.13)+'s">'
   +'<path d="'+d+'"/><line class="boden" x1="10" y1="192" x2="90" y2="192"/>'
   +(i===stufe?'<circle class="marke" cx="50" cy="206" r="4.6"/>':'')+'</g>';
 }).join('');
 return tafel('<g class="gestochen">'+inhalt+'</g>','tafel-richtung','0 0 490 218');
}

export function passformFigur(){
 return tafel('<g class="gestochen">'
 +'<path class="mantel" d="M62 78 L54 104 L60 238 L140 238 L146 104 L138 78 L118 60 L100 84 L82 60 Z"/>'
 +'<path class="koerper" d="M78 86 L74 106 L78 224 L122 224 L126 106 L122 86 L112 70 L100 80 L88 70 Z"/>'
 +'<line class="mass" x1="54" y1="252" x2="146" y2="252"/><line x1="54" y1="246" x2="54" y2="258"/><line x1="146" y1="246" x2="146" y2="258"/>'
 +'</g>','tafel-passform','0 0 200 266');
}

export function schichtenFigur(){
 const bahnen=[0,1,2,3,4,5,6].map(i=>'<path class="schicht" style="animation-delay:'+(i*.14)+'s" d="M28 '+(46+i*28)+' C74 '+(30+i*28)+' 126 '+(62+i*28)+' 172 '+(44+i*28)+'"/>').join('');
 return tafel('<g class="gestochen">'+bahnen+'<line class="achse" x1="28" y1="30" x2="28" y2="250"/></g>','tafel-schichten','0 0 200 260');
}
