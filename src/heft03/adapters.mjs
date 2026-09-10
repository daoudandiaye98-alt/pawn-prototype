// Datenadapter: echte Supabase-Zeilen (src/integrations/supabase/types.ts von pawn.vision) → das Heft-Modell.
// Alles, was das Heft an Feldern erwartet, entsteht hier. Der Rest des Codes kennt nur das Heft-Modell.
// Spaltennamen sind wörtlich aus types.ts übernommen (Stand 09/2026); Abweichungen stehen als Kommentar.
import {asset} from './data.mjs';

export const WELT={Mode:'mode',Interior:'interior',Kunst:'kunst'};
const WELTEN=['mode','interior','kunst'];
// Angebotstypen ohne Direktkauf (product_dna.kind) → nur Anfrage beim Haus
const NUR_ANFRAGE=new Set(['auftragsarbeit','live_portrait','massanfertigung']);
// Standhöhe auf der Bühne (Szeneneinheiten), wenn das Haus keine Höhe pflegt
const STANDHOEHE={mode:3.0,interior:1.85,kunst:2.5};
// Archetyp-Farbe, wenn ein Haus (noch) kein Theme hat
export const ARCHETYP_FARBE={editorial:'#722d33',galerie:'#6c716b',atelier:'#8b623e',archiv:'#354943'};

const text=v=>v==null?'':String(v);
const zahl=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const bestand=varianten=>varianten.reduce((n,v)=>n+(Number(v.stock)||0),0);
const ident=u=>u;

/** Materialangabe: material_composition ([{material,percent}]) oder das Welt-Feld product_dna.material */
export function materialText(row){
 const mc=Array.isArray(row.material_composition)?row.material_composition:[];
 if(mc.length)return mc.map(m=>m.percent?`${m.material} ${m.percent} %`:m.material).join(' · ');
 return text(row.product_dna?.material||row.lining_hardware||'');
}

/** Lieferzeile aus inventory_mode/lead_time_days/stock — im Wortlaut des Hefts */
export function lieferText(row,gesamt){
 if(row.inventory_mode==='made_to_order')return row.lead_time_days?'Anfertigung · '+row.lead_time_days+' Tage':'Anfertigung · nach Absprache';
 if(gesamt===0)return 'Aktuell vergriffen';
 return 'Versand in 3–5 Tagen';
}

/**
 * products-Zeile (+ eingebettete designers-Zeile aus dem Join) → Heft-Produkt.
 * bild(url) übersetzt Storage-Pfade/URLs in ladbare Adressen (media.ts: signiereMedia/bildVariante); Standard: unverändert.
 */
export function productFromRow(row,designer=row.designers||null,{bild=ident}={}){
 const varianten=Array.isArray(row.size_variants)?row.size_variants.filter(v=>v&&v.size):[];
 const gesamt=varianten.length?bestand(varianten):(row.stock_quantity??0);
 const dna=row.product_dna&&typeof row.product_dna==='object'?row.product_dna:{};
 const kind=NUR_ANFRAGE.has(dna.kind)?dna.kind:'produkt';
 const world=WELT[row.world]||text(row.world).toLowerCase()||'mode';
 const heft=dna.heft&&typeof dna.heft==='object'?dna.heft:{};
 return {
  id:row.id,slug:row.slug||row.id,name:text(row.name),
  house:designer?.slug||row.designer_id,
  world,
  price:zahl(row.price),
  image:bild(row.image_url||''),
  cutout:heft.cutout_url?bild(heft.cutout_url):null,     // freigestellte Fassung fürs Aufstellen (Vorschlag, s. INTEGRATION.md)
  material:materialText(row),
  description:text(row.description),
  note:text(row.designer_note||heft.notiz),                // Kuratorenzeile unter dem Stück
  sizes:varianten.map(v=>String(v.size)),
  stockBySize:Object.fromEntries(varianten.map(v=>[String(v.size),Number(v.stock)||0])),
  inventory_mode:row.inventory_mode||'stock',
  stock_quantity:row.inventory_mode==='made_to_order'?null:gesamt,
  kind,
  lead:lieferText(row,gesamt),
  measurements:row.measurements&&row.measurements.rows?row.measurements:null,
  dna:{materials:dna.materials||[],silhouette:dna.silhouette||[],colors:dna.colors||[],mood:dna.mood||[],tags:row.tags||[],felder:dna},
  stage:{h:heft.hoehe||(row.height_cm?Math.min(3.4,Math.max(1.2,row.height_cm/60)):STANDHOEHE[world]),lift:world==='interior'?.22:.17},
  details:{made_in:text(row.made_in),care:text(row.care_instructions),edition:text(row.edition_info),sustainability:text(row.sustainability_note),vat_rate:row.vat_rate??null,dimensions:[row.width_cm,row.height_cm,row.length_cm].some(v=>v!=null)?{w:row.width_cm,h:row.height_cm,l:row.length_cm}:null},
  status:row.status||'published',
  verkaufsbereit:designer?(designer.kauf_freigeschaltet??designer.verkaufsbereit??false):true
 };
}

/** Welt eines Hauses: aus designers.tags (enthält „Mode"/„Interior"/„Kunst") — sonst aus seinen Werken. */
export function weltDesHauses(designer,produkte=[]){
 const tag=(designer.tags||[]).map(t=>WELT[t]).find(Boolean);
 if(tag)return tag;
 const zaehler={};for(const p of produkte)zaehler[p.world]=(zaehler[p.world]||0)+1;
 return Object.entries(zaehler).sort((a,b)=>b[1]-a[1])[0]?.[0]||'mode';
}

/** designers-Zeile + designer_page_blocks + house_themes + Werke → Heft-Haus */
export function houseFromRow(designer,blocks=[],theme=null,produkte=[],{bild=ident,lookbook=[]}={}){
 const eigene=produkte.filter(p=>p.house===designer.slug);
 const world=weltDesHauses(designer,eigene);
 const archetyp=designer.brand_dna?.archetyp||'editorial';
 const t=theme?themeFromRow(theme):null;
 return {
  slug:designer.slug,name:text(designer.brand_name),
  number:designer.house_number!=null?String(designer.house_number).padStart(2,'0'):'—',
  world,location:[designer.location,designer.country].filter(Boolean).join(', '),
  title:text(designer.collection_title),intro:text(designer.story),manifesto:text(designer.manifesto),
  quote:text(designer.quote),quoteRole:text(designer.quote_role),
  image:bild(designer.hero_image_url||designer.portrait_url||designer.banner_url||''),
  portrait:bild(designer.portrait_url||''),
  work:bild(designer.atelier_image_url||designer.banner_url||''),workCaption:text(designer.atelier_caption),
  lookbook,
  products:eigene.map(p=>p.id),
  blocks:designer.page_published_at?blocks.filter(b=>b.designer_id===designer.id).map(blockFromRow):[],
  archetyp,theme:t,color:t?.accent||ARCHETYP_FARBE[archetyp]||'#722d33',
  published:!!designer.page_published_at,
  verkaufsbereit:designer.kauf_freigeschaltet??designer.verkaufsbereit??false,
  plan:designer.plan||'haus',website:text(designer.website),instagram:text(designer.instagram)
 };
}

/** designer_page_blocks-Zeile → Heft-Block (Kinds: auftakt|editorial_text|zitat|produktreihe|lookbook_streifen|banner_seitlich|banner_vollbreite|ueberlappend) */
export function blockFromRow(row){
 const content=row.content&&typeof row.content==='object'?row.content:{};
 return {id:row.id,kind:row.kind,position:row.position??0,on:true,content:{...content,abstand:content.abstand||'ruhig'}};
}

/** house_themes-Zeile → Farbwelt des Hefts. farbwelt = {bg,fg,accent,muted} (theme.ts). */
export function themeFromRow(row){
 const f=row.farbwelt||{};
 return {
  accent:f.accent||'#722d33',paper:f.bg||'#f9f7f2',ink:f.fg||'#252421',muted:f.muted||'#847a6b',
  font:{editorial:'Playfair',zart:'Georgia',archiv:'Inter',warm:'Georgia'}[row.typografie]||'Playfair',
  architecture:row.kantenhaerte==='rund'?'arch':'frame',
  rhythm:row.flaechenrhythmus||'ruhig',edge:row.kantenhaerte||'hart',motion:row.bewegungscharakter||'ruhig',
  transition:row.uebergangsart||'fade',texture:row.hintergrundtextur||{typ:'keine'},
  version:row.version,current:row.is_current!==false
 };
}

/** media_assets-Zeilen → Medienkarte des Hefts (id → {url,kind,thumb}). Nur Bild/Video, nichts Abgelehntes. */
export function mediaFromRows(rows=[],{bild=ident}={}){
 const karte={};
 for(const r of rows){
  if(!r||!r.id||r.review_status==='abgelehnt')continue;
  karte[r.id]={url:bild(r.url),kind:r.kind==='video'?'video':'bild',thumb:r.thumb_url?bild(r.thumb_url):null,product:r.product_id||null,house:r.designer_id};
 }
 return karte;
}

/** curated_collections + collection_items → geordnete Slug-Liste (Kuration „Ausgewählt für dich" als Redaktionsvorgabe) */
export function collectionFromRows(collection,items=[]){
 if(!collection)return null;
 return {number:collection.number,title:text(collection.title),subtitle:text(collection.subtitle),
  slugs:[...items].filter(i=>i.collection_id===collection.id).sort((a,b)=>(a.sort??0)-(b.sort??0)).map(i=>i.product_slug)};
}

/**
 * Alles zusammen: die Zeilen der sechs Quellen → ein Heft {products,houses,media,kuration}.
 * Regel „zeigbar" wie publicData.ts: Name, Preis > 0 (oder reine Anfrage), Bild vorhanden, Haus bekannt.
 */
export function heftAusZeilen({products=[],designers=[],blocks=[],themes=[],media=[],collection=null,items=[]}={},{bild=ident}={}){
 const haeuserNachId=Object.fromEntries(designers.map(d=>[d.id,d]));
 const produkte={};
 for(const row of products){
  const d=row.designers||haeuserNachId[row.designer_id];
  if(!d||row.status&&row.status!=='published')continue;
  const p=productFromRow(row,d,{bild});
  const kaufbar=p.kind!=='produkt'||(p.price!=null&&p.price>0);
  if(!p.name||!p.image||!kaufbar)continue;
  produkte[p.id]=p;
 }
 const medien=mediaFromRows(media,{bild});
 const haeuser={};
 for(const d of designers){
  if((d.status&&d.status!=='active')||d.published===false)continue;
  const theme=themes.find(t=>t.designer_id===d.id&&t.is_current!==false)||null;
  const lookbook=Object.entries(medien).filter(([,m])=>m.house===d.id&&m.kind==='bild').slice(0,3).map(([id])=>id);
  const h=houseFromRow(d,blocks,theme,Object.values(produkte),{bild,lookbook});
  haeuser[h.slug]=h;
 }
 for(const p of Object.values(produkte))if(!haeuser[p.house])delete produkte[p.id];
 return {products:produkte,houses:haeuser,media:medien,kuration:collectionFromRows(collection,items)};
}

// customer_measurements: Zahlen oder null, kein Geschlecht, Raum als Notiz
export {massZeile as measurementsToRow} from './store.mjs';

/** Heft-Stilprofil → Zeile der vorgeschlagenen Tabelle kunden_stil (s. integration/sql/) */
export function stilToRow(stil={},foto={},fuerWen=''){
 return {welt:stil.welt||null,richtung:stil.richtung||null,form:stil.form||null,fuer_wen:fuerWen||null,foto_befund:foto&&Object.keys(foto).length?foto:null,quelle:'heft-quiz'};
}
export function stilFromRow(row){
 if(!row)return {stil:{},foto:{}};
 return {stil:{welt:row.welt||undefined,richtung:row.richtung||undefined,form:row.form||undefined},foto:row.foto_befund||{},fuerWen:row.fuer_wen||''};
}

/** Kasse: Heft-Warenkorb → Zeilen für create-checkout (Cent, ein Haus je Aufruf) */
export function checkoutLines(cart,products){
 return cart.map(z=>{const p=products[z.id];if(!p)return null;return {name:p.name+(z.size?' · '+z.size:''),unit_amount:Math.round((p.price||0)*100),qty:z.qty,slug:p.slug,size:z.size||undefined,product_id:p.id};}).filter(Boolean);
}
export function cartByHouse(cart,products){
 const gruppen={};
 for(const z of cart){const p=products[z.id];if(!p)continue;(gruppen[p.house]||(gruppen[p.house]=[])).push(z);}
 return gruppen;
}

export const demoBild=asset;

/** orders-Zeile → Bestellzeile des Hefts (Konto › Bestellungen). items: {name,unit_amount,qty,slug,size}[] in Cent. */
export function orderFromRow(row){
 const items=Array.isArray(row.items)?row.items:[];
 return {id:row.id,datum:new Date(row.created_at).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}),status:row.status,versand:row.fulfillment_status,
  stuecke:items.map(i=>String(i.name||'')+(i.qty>1?' × '+i.qty:'')),summe:(row.amount_total||0)/100,nummer:row.invoice_number||'',tracking:row.tracking_number||''};
}
