// Die Quelle: alles, was das Heft von außen braucht, hinter EINER Schnittstelle.
// demoQuelle() liefert die Beispieldaten und tut nichts nach außen (Vorschau).
// supabaseQuelle({client}) spricht mit pawn.vision — über den supabase-js-Client,
// den die React-Hülle hereinreicht (src/integrations/supabase/client.ts). Kein zweiter Client, keine Schlüssel hier.
//
// Vertrag (jede Methode gibt ein Promise zurück):
//   heft()                         → {products,houses,media,kuration}            (Heft-Modell, s. adapters.mjs)
//   chat({messages,bilder,kontext,session_id}) → {reply,treffer:[slug],action,session_id} | null (null = Heft antwortet selbst)
//   kasse({cart,products,email,locale})        → {url} | {fehler:'mixed_cart'|'designer_not_ready'|'not_configured'|'vorschau',fehlt?,text}
//   anfrage({product,text,kontakt})            → {ok,thread_id?,anmelden?}
//   bewerbung(werte)                           → {ok,application_id?,needs_email_confirmation?,fehler?}
//   stil.laden()/stil.speichern(stil,foto,fuerWen) · masse.laden()/masse.speichern(zeile)
//   merkliste.laden()/merkliste.setzen(productId,an)
//   signal(art,daten)                          → void   (ansehen|merken|kaufen|quiz — Geschmackssignale)
//   konto.aktuell() → {id,name,email}|null · konto.anmelden() · konto.abmelden() · konto.bestellungen() → [{datum,status,stuecke,summe}]
//   bild(url) → ladbare Adresse (Storage-Pfade signieren/transformieren)
// funktionen.signieren(urls) → {url: signierteUrl} — einmal je Heft-Ladung, weil die Adapter bild() synchron rufen.
import {demoHeft} from './data.mjs';
import {heftAusZeilen,checkoutLines,cartByHouse,stilToRow,stilFromRow,orderFromRow} from './adapters.mjs';

const nichts=async()=>null;
const kein=async()=>({ok:false});

export function demoQuelle(){
 return {
  art:'demo',
  bild:u=>u,
  async heft(){return demoHeft();},
  chat:nichts,
  async kasse(){return {fehler:'vorschau',text:'Vorschau — es wird nichts bestellt, nichts gesendet.'};},
  async anfrage(){return {ok:true,vorschau:true};},
  async bewerbung(){return {ok:true,vorschau:true};},
  stil:{laden:nichts,speichern:kein},
  masse:{laden:nichts,speichern:kein},
  merkliste:{laden:nichts,setzen:kein},
  signal:nichts,
  konto:{aktuell:nichts,anmelden:nichts,abmelden:nichts,bestellungen:async()=>[]}
 };
}

// Spaltenmasken: Das öffentliche Heft liest NUR diese Spalten (designers exponiert per RLS auch Stripe-Felder).
export const SPALTEN={
 products:'id,slug,name,world,price,image_url,description,designer_note,product_dna,size_variants,measurements,material_composition,inventory_mode,stock_quantity,lead_time_days,tags,status,height_cm,width_cm,length_cm,made_in,care_instructions,edition_info,sustainability_note,vat_rate,designer_id,designers(id,slug,brand_name,verkaufsbereit)',
 designers:'id,slug,brand_name,house_number,status,published,page_published_at,plan,brand_dna,story,manifesto,quote,quote_role,collection_title,location,country,website,instagram,tags,hero_image_url,avatar_url,banner_url,portrait_url,atelier_image_url,atelier_caption,is_featured,verkaufsbereit',
 blocks:'id,designer_id,kind,position,content',
 themes:'designer_id,version,is_current,farbwelt,typografie,flaechenrhythmus,kantenhaerte,bewegungscharakter,hintergrundtextur,uebergangsart',
 media:'id,designer_id,kind,url,thumb_url,product_id,review_status',
 collections:'id,number,title,subtitle,is_active',
 items:'collection_id,product_slug,world,sort',
 masse:'height_cm,shoulder_cm,chest_cm,waist_cm,hip_cm,inseam_cm,foot_cm,fit_preference,room_note',
 stil:'welt,richtung,form,fuer_wen,foto_befund'
};

/** Chat-Antwort von pawn-chat → Heft: Karten-Links (/werk/<slug>, alt /product/<slug>) werden zu Slugs. */
export function chatAntwort(data){
 if(!data||typeof data!=='object')return null;
 const treffer=(data.cards||[]).map(c=>(c.href||'').match(/\/(?:werk|product)\/([^/?#]+)/)?.[1]).filter(Boolean);
 return {reply:data.reply||'',treffer,action:data.action||null,session_id:data.session_id||null,rate_limited:!!data.rate_limited,image_terms:data.image_terms||[]};
}

export function supabaseQuelle({client,bild=u=>u,funktionen={},adressen={},sichten=false}={}){
 if(!client)throw Error('supabaseQuelle braucht den supabase-js-Client.');
 // sichten:true liest die Spaltenmasken-Sichten aus sql/01_heft_sichten.sql statt der Tabellen (gleiche Spalten).
 const T={products:sichten?'heft_produkte':'products',designers:sichten?'heft_haeuser':'designers'};
 const fehlerText=e=>e?.message||String(e);
 const nutzer=async()=>{const {data}=await client.auth.getUser();return data?.user||null;};
 const sitzung=()=>{try{return localStorage.getItem('palace.chat.session_id')||undefined;}catch(e){return undefined;}};
 return {
  art:'supabase',bild,
  async heft(){
   const [{data:products,error:e1},{data:designers,error:e2},{data:collection}]=await Promise.all([
    client.from(T.products).select(SPALTEN.products).eq('status','published').order('created_at',{ascending:false}).limit(400),
    client.from(T.designers).select(SPALTEN.designers).eq('status','active').eq('published',true).order('house_number',{ascending:true}),
    client.from('curated_collections').select(SPALTEN.collections).eq('is_active',true).order('number',{ascending:false}).limit(1).maybeSingle()
   ]);
   if(e1)throw Error('products: '+fehlerText(e1));if(e2)throw Error('designers: '+fehlerText(e2));
   const ids=(designers||[]).filter(d=>d.page_published_at).map(d=>d.id),alle=(designers||[]).map(d=>d.id);
   const [{data:blocks},{data:themes},{data:media},{data:items}]=await Promise.all([
    ids.length?client.from('designer_page_blocks').select(SPALTEN.blocks).in('designer_id',ids).order('position'):{data:[]},
    ids.length?client.from('house_themes').select(SPALTEN.themes).in('designer_id',ids).eq('is_current',true):{data:[]},
    alle.length?client.from('media_assets').select(SPALTEN.media).in('designer_id',alle).eq('kind','bild').neq('review_status','abgelehnt').limit(600):{data:[]},
    collection?client.from('collection_items').select(SPALTEN.items).eq('collection_id',collection.id).order('sort'):{data:[]}
   ]);
   // Bildadressen einmal auflösen, bevor die Adapter sie lesen: adapters.mjs ruft bild(url)
   // SYNCHRON, das Signieren einer Storage-Adresse ist asynchron. Ohne diesen Schritt bliebe
   // jeder blanke Bucket-Pfad ein totes Bild. Eine Runde für alle Adressen, nicht eine je Bild.
   const roh=new Set(),merke=v=>{if(typeof v==='string'&&v)roh.add(v);};
   for(const p of products||[]){merke(p.image_url);merke(p.product_dna&&p.product_dna.heft&&p.product_dna.heft.cutout_url);}
   for(const d of designers||[]){merke(d.hero_image_url);merke(d.avatar_url);merke(d.banner_url);merke(d.portrait_url);merke(d.atelier_image_url);}
   for(const m of media||[]){merke(m.url);merke(m.thumb_url);}
   let karte={};
   if(funktionen.signieren&&roh.size){try{karte=await funktionen.signieren([...roh])||{};}catch(e){karte={};}}
   const bildAufgeloest=u=>bild(karte[u]||u);
   return heftAusZeilen({products:products||[],designers:designers||[],blocks:blocks||[],themes:themes||[],media:media||[],collection:collection||null,items:items||[]},{bild:bildAufgeloest});
  },
  async chat({messages=[],bilder=[],kontext={},session_id=sitzung()}={}){
   const {data,error}=await client.functions.invoke('pawn-chat',{body:{messages,session_id,image_urls:bilder.length?bilder:undefined,page_context:{route:kontext.route||'/frag-pawn',product_slug:kontext.product_slug,heft:kontext}}});
   if(error)return {reply:'',treffer:[],fehler:fehlerText(error)};
   const a=chatAntwort(data);
   if(a?.session_id){try{localStorage.setItem('palace.chat.session_id',a.session_id);}catch(e){}}
   return a;
  },
  async kasse({cart=[],products={},email,locale='de'}={}){
   const gruppen=Object.keys(cartByHouse(cart,products));
   if(gruppen.length>1)return {fehler:'mixed_cart',text:'Jedes Haus versendet selbst — bitte ein Haus nach dem anderen bestellen.'};
   const items=checkoutLines(cart,products);
   if(!items.length)return {fehler:'leer',text:'Die Tasche ist leer.'};
   // Das bezahlte Haus reist mit: nach der Rückkehr wird genau dessen Tasche geleert,
   // nicht die ganze — was bei einem anderen Haus liegt, bleibt liegen.
   const erfolg=adressen.erfolg?adressen.erfolg+(adressen.erfolg.includes('?')?'&':'?')+'haus='+encodeURIComponent(gruppen[0]||''):undefined;
   const {data,error}=await client.functions.invoke('create-checkout',{body:{items,customer_email:email||undefined,locale,success_url:erfolg,cancel_url:adressen.abbruch}});
   if(error)return {fehler:'netz',text:fehlerText(error)};
   if(data?.error)return {fehler:data.error,fehlt:data.fehlt||[],text:data.message||''};
   return {url:data?.url,id:data?.id};
  },
  async anfrage({product,text}={}){
   if(funktionen.anfrage)return funktionen.anfrage({product,text});
   const u=await nutzer();if(!u)return {ok:false,anmelden:true};
   const haus=await client.from('designers').select('id').eq('slug',product.house).maybeSingle();
   if(!haus.data)return {ok:false,fehler:'haus_unbekannt'};
   const {data:thread,error}=await client.from('message_threads').insert({designer_id:haus.data.id,created_by:u.id,subject:'Anfrage: '+product.name,category:'produkt',product_id:product.id}).select('id').single();
   if(error)return {ok:false,fehler:fehlerText(error)};
   await client.from('messages').insert({thread_id:thread.id,sender_id:u.id,body:text});
   client.functions.invoke('notify-designer-inquiry',{body:{thread_id:thread.id}}).catch(()=>{});
   return {ok:true,thread_id:thread.id};
  },
  async bewerbung(werte){
   const {data,error}=await client.functions.invoke('submit-application',{body:werte});
   if(error)return {ok:false,fehler:fehlerText(error)};
   return {ok:!!data?.ok,...data};
  },
  stil:{
   async laden(){const u=await nutzer();if(!u)return null;const {data,error}=await client.from('kunden_stil').select(SPALTEN.stil).eq('user_id',u.id).maybeSingle();return error?null:stilFromRow(data);},
   async speichern(stil,foto,fuerWen){const u=await nutzer();if(!u)return {ok:false,anmelden:true};const {error}=await client.from('kunden_stil').upsert({user_id:u.id,...stilToRow(stil,foto,fuerWen)},{onConflict:'user_id'});return error?{ok:false,fehler:fehlerText(error)}:{ok:true};}
  },
  masse:{
   async laden(){const u=await nutzer();if(!u)return null;const {data}=await client.from('customer_measurements').select(SPALTEN.masse).eq('user_id',u.id).maybeSingle();return data||null;},
   async speichern(zeile){const u=await nutzer();if(!u)return {ok:false,anmelden:true};
    let {error}=await client.from('customer_measurements').upsert({user_id:u.id,...zeile},{onConflict:'user_id'});
    // Solange die Spalte raum (sql/03) fehlt, ohne sie noch einmal — room_note trägt den Satz.
    if(error&&/raum/.test(fehlerText(error))){const {raum,...ohne}=zeile;({error}=await client.from('customer_measurements').upsert({user_id:u.id,...ohne},{onConflict:'user_id'}));}
    return error?{ok:false,fehler:fehlerText(error)}:{ok:true};}
  },
  merkliste:{
   async laden(){const u=await nutzer();if(!u)return null;const {data}=await client.from('wishlists').select('product_id').eq('user_id',u.id);return (data||[]).map(r=>r.product_id);},
   async setzen(productId,an){const u=await nutzer();if(!u)return {ok:false,anmelden:true};const {error}=an?await client.from('wishlists').insert({user_id:u.id,product_id:productId}):await client.from('wishlists').delete().eq('user_id',u.id).eq('product_id',productId);return error?{ok:false,fehler:fehlerText(error)}:{ok:true};}
  },
  async signal(art,daten={}){
   if(art==='ansehen'&&daten.product?.id)client.rpc('bump_product_view',{p_product_id:daten.product.id}).then(()=>{},()=>{});
   if(funktionen.signal)funktionen.signal(art,daten);
  },
  konto:{
   async aktuell(){const u=await nutzer();if(!u)return null;const {data}=await client.from('profiles').select('display_name,member_number').eq('id',u.id).maybeSingle();return {id:u.id,email:u.email||'',name:data?.display_name||u.email?.split('@')[0]||'',member_number:data?.member_number??null};},
   async anmelden(){if(funktionen.anmelden)return funktionen.anmelden();},
   async bestellungen(){const u=await nutzer();if(!u)return [];const {data}=await client.from('orders').select('id,created_at,status,fulfillment_status,amount_total,items,tracking_number,invoice_number').eq('user_id',u.id).order('created_at',{ascending:false}).limit(20);return (data||[]).map(orderFromRow);},
   async abmelden(){await client.auth.signOut();}
  }
 };
}
