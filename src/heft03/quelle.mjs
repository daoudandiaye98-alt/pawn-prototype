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
//   konto.anfragen() → [{id,betreff,haus,werk,stand,datum}] · konto.rechnung(orderId) → signierte URL | null
//   zugang.anmelden({email,passwort}) · zugang.registrieren({email,passwort,wiederholung,name}) ·
//   zugang.google({ziel})            → {ok}|{fehler} — die Zugang-Doppelseite (Teil L5). Die Huelle
//                                      haelt supabase.auth; das Heft kennt nur diesen Port.
//   texte() → {schluessel: text} aus site_content · vertraege() → [{id,titel,url}] · vergessen() → {ok} (loescht serverseitig)
//   bild(url) → ladbare Adresse (Storage-Pfade signieren/transformieren)
// funktionen.signieren(urls) → {url: signierteUrl} — einmal je Heft-Ladung, weil die Adapter bild() synchron rufen.
import {demoHeft} from './data.mjs';
import {heftAusZeilen,checkoutLines,cartByHouse,stilToRow,stilFromRow,orderFromRow} from './adapters.mjs';
import {schreibEntwurf,fehltZumVeroeffentlichen,WERKE_MINDESTENS} from './buehne.mjs';

const nichts=async()=>null;
const kein=async()=>({ok:false});

/* Ein Katalog fuer die Vorschau — dieselbe Form wie in der Datenbank, nur klein. */
const DEMO_SAETZE=[
 {key:'heft.empfang.erster',flaeche:'heft',kontext:'hero',varianten:{de:['Ich bin PAWN. Stöber in Ruhe — oder tipp mich an.','Willkommen. Drei Welten liegen vor dir.']},aktiv:true},
 {key:'heft.merken.erstes',flaeche:'heft',kontext:'werk',varianten:{de:['Das erste Stück. Daraus lese ich schon etwas.']},aktiv:true},
 {key:'heft.stillstand.hero',flaeche:'heft',kontext:'hero',varianten:{de:['Tipp eine Welt an — ich zeige dir den Rest.']},aktiv:true}
];
const DEMO_REGELN=[
 {key:'heft.empfang.erster',flaeche:'heft',ereignis:'betreten',bedingung:{besuch:'erster'},satz_key:'heft.empfang.erster',aktion:{art:'sagen'},prioritaet:100,abklingzeit_s:0,einmal:'immer',aktiv:true},
 {key:'heft.merken.erstes',flaeche:'heft',ereignis:'merken',bedingung:{merkliste_eq:1},satz_key:'heft.merken.erstes',aktion:{art:'sagen'},prioritaet:85,abklingzeit_s:0,einmal:'sitzung',aktiv:true},
 {key:'heft.stillstand.hero',flaeche:'heft',ereignis:'stillstand',bedingung:{kontext:'hero',min_ms:12000},satz_key:'heft.stillstand.hero',aktion:{art:'sagen'},prioritaet:20,abklingzeit_s:120,einmal:null,aktiv:true}
];
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
  /* Der Begleiter in der Vorschau: ein kleiner, echter Katalog in der Form der
     Datenbank. Genug, damit die Blase erscheint und das Schweigen greift — nicht
     genug, um die 30 echten Saetze vorzutaeuschen. */
  async begleiter(){return {saetze:DEMO_SAETZE,regeln:DEMO_REGELN};},
  async begleiterMerken(){return null;},
  async begleiterBesuch(){return {besuche:1,rang:'bauer',letzter_besuch:null};},
  async ereignis(){return null;},
  // Der Katalog kommt auch in der Vorschau aus der Datenbank — er ist oeffentlich.
  // Hier ist er leer, und das ist ehrlich: ohne Katalog keine Karte, statt einer
  // erfundenen. Echte Archetypennamen waeren Beispieldaten, und die gibt es nicht.
  async archetypen(){return [];},
  async archetyp(){return null;},
  async archetypBestaetigen(){return null;},
  /* Die Anprobe schickt echte Bilder an echte Rechner und kostet echtes Geld. In der
     Vorschau ist sie deshalb ZU — aber ehrlich zu, mit einem Satz, den die Seite
     anzeigen kann. Ein stilles `null` haette wie „laedt noch" ausgesehen. */
  anprobe:{
   art:welt=>welt==='interior'?'raum':welt==='kunst'?'wand':'ganzkoerper',
   aktion:welt=>welt==='interior'?'raum':welt==='kunst'?'wand':'anprobe',
   async bild(){return {fehler:'Vorschau — hier wird nichts hochgeladen.'};},
   async bereinigen(){return {ok:false,satz:'Vorschau — die Anprobe ist hier zu.'};},
   async starten(){return {ok:false,satz:'Vorschau — die Anprobe ist hier zu.'};},
   async stand(){return {ok:false,satz:'Vorschau — die Anprobe ist hier zu.'};},
   async bewerten(){return {ok:false,satz:'Vorschau — die Anprobe ist hier zu.'};},
   async meine(){return {bilder:[],anproben:[]};}
  },
  async foto(){return {fehler:'Vorschau — hier wird nichts gelesen.'};},
  texte:async()=>({}),
  vertraege:async()=>[],
  vergessen:kein,
  konto:{aktuell:nichts,anmelden:nichts,abmelden:nichts,bestellungen:async()=>[],anfragen:async()=>[],rechnung:nichts},
  // In der Vorschau gibt es kein Konto anzulegen. Ein Formular, das heimlich nichts tut,
  // waere schlimmer als eines, das sagt, dass es nicht kann.
  zugang:{
   async anmelden(){return {fehler:'vorschau'};},
   async registrieren(){return {fehler:'vorschau'};},
   async google(){return {fehler:'vorschau'};}
  }
 };
}

// Spaltenmasken: Das öffentliche Heft liest NUR diese Spalten (designers exponiert per RLS auch Stripe-Felder).
/**
 * Was als Bild an pawn-chat gehen darf: eine einzige data-URL mit Bild-Typ, hoechstens
 * 2 MB. Gemessen wird die KODIERTE Laenge — das ist, was wirklich ueber die Leitung
 * geht; die Dateigroesse waere die falsche Zahl (base64 waechst um rund ein Drittel).
 *
 * Der Riegel sitzt hier an der Grenze und nicht nur am Knopf: wer chat() sonstwo
 * aufruft, kann die Zusage nicht versehentlich brechen.
 */
export const BILD_GRENZE=2*1024*1024;
export function bilderTauglich(bilder=[],grenze=BILD_GRENZE){
 return (Array.isArray(bilder)?bilder:[bilder])
  .filter(b=>typeof b==='string'&&/^data:image\/[a-z.+-]+;base64,/i.test(b)&&b.length<=grenze)
  .slice(0,1);
}

export const SPALTEN={
 products:'id,slug,name,world,price,image_url,description,designer_note,product_dna,size_variants,measurements,material_composition,inventory_mode,stock_quantity,lead_time_days,tags,status,height_cm,width_cm,length_cm,made_in,care_instructions,edition_info,sustainability_note,vat_rate,designer_id,designers(id,slug,brand_name,verkaufsbereit)',
 designers:'id,slug,brand_name,house_number,status,published,page_published_at,plan,brand_dna,story,manifesto,quote,quote_role,collection_title,location,country,website,instagram,tags,hero_image_url,avatar_url,banner_url,portrait_url,atelier_image_url,atelier_caption,is_featured,verkaufsbereit',
 blocks:'id,designer_id,kind,position,content',
 themes:'designer_id,version,is_current,farbwelt,typografie,flaechenrhythmus,kantenhaerte,bewegungscharakter,hintergrundtextur,uebergangsart',
 media:'id,designer_id,kind,url,thumb_url,product_id,review_status',
 collections:'id,number,title,subtitle,is_active',
 items:'collection_id,product_slug,world,sort',
 masse:'height_cm,shoulder_cm,chest_cm,waist_cm,hip_cm,inseam_cm,foot_cm,fit_preference,room_note',
 stil:'welt,richtung,form,fuer_wen,foto_befund',
 anfragen:'id,subject,category,status,last_message_at,product_id,designer_id,products:product_id(slug,name),designers:designer_id(slug,brand_name)',
 texte:'key,value',
 vertraege:'id,kind,version,title,url,effective_from',
 begleiterSaetze:'key,flaeche,kontext,welt,register,varianten,platzhalter,aktiv',
 begleiterRegeln:'key,flaeche,ereignis,bedingung,satz_key,aktion,prioritaet,abklingzeit_s,einmal,aktiv,notiz',
 // `beschreibung` und die _en-Felder bleiben draussen: die Karte zeigt sie nicht,
 // und was nicht gebraucht wird, wird nicht ueber die Leitung geschickt.
 archetypen:'key,welt,name,figur,kurz,richtung,form,woerter,farbregister,nahe,haus_archetypen,bild_url,sort'
};

/** Chat-Antwort von pawn-chat → Heft: Karten-Links (/werk/<slug>, alt /product/<slug>) werden zu Slugs. */
export function chatAntwort(data){
 if(!data||typeof data!=='object')return null;
 const treffer=(data.cards||[]).map(c=>(c.href||'').match(/\/(?:werk|product)\/([^/?#]+)/)?.[1]).filter(Boolean);
 return {reply:data.reply||'',treffer,action:data.action||null,session_id:data.session_id||null,rate_limited:!!data.rate_limited,image_terms:data.image_terms||[]};
}

/**
 * Aus der Signaturkarte einen Bildleser machen, den die Adapter SYNCHRON rufen können.
 *
 * Der Fehler, den das behebt: vorher stand hier `bild(karte[u]||u)`. Gab es keine
 * Signatur, kam der blanke Bucket-Pfad zurück — eine Adresse, die der Browser nie
 * laden kann. Ergebnis: ein grauer Kasten an der Stelle eines Werks.
 *
 * Die Unterscheidung kommt aus der KARTE, nicht aus der Form der Adresse. Ein erster
 * Versuch hier hat „trägt sich selbst" am Muster geraten (`^https?:|^/`) und dabei die
 * Bilder des Hefts übersehen, die als `./assets/…` kommen — er hätte JEDES Bild geleert.
 * `signiereMedia` weiß es besser und sagt es schon (`lib/media.ts:39` und `:52`):
 *
 *   Wert steht in der Karte und ist gesetzt → signiert, nimm die Signatur.
 *   Wert steht in der Karte und ist `null`  → war eine Storage-Adresse und ließ sich
 *                                             NICHT signieren → `null`. Kein totes Bild.
 *   Wert steht nicht in der Karte           → war nie zum Signieren angemeldet
 *                                             (`./assets/…` des Hefts) → unverändert.
 *
 * Scheiterte die ganze Runde, ist die Karte leer: dann wissen wir über keine Adresse
 * etwas, und alles bleibt stehen. Alles zu leeren wäre schlimmer als ein Versuch zu laden.
 *
 * Folge, und so ist sie gewollt: `heftAusZeilen()` lässt Stücke ohne Bild weg. Ein Werk,
 * das fehlt, ist ehrlicher als ein Werk, das kaputt dasteht.
 */
export function bildLoeser(karte,bild){
 return u=>{
  if(typeof u!=='string'||!u)return bild(u);
  if(!Object.prototype.hasOwnProperty.call(karte,u))return bild(u);
  return karte[u]?bild(karte[u]):null;
 };
}

/** 8 MB — dieselbe Grenze, die ChatDrawer fuer taste-uploads zieht. */
export const ANPROBE_GRENZE=8*1024*1024;

/*
 * Ein Ruf an die Function `anprobe`. Sie antwortet auf WEICHE Absagen mit 200
 * und einem `satz` (Kontingent, fehlende Einwilligung, falsche Welt) — die
 * kommen als `data` an und muessen die Kundin erreichen. HARTE Fehler (401,
 * 404, 500) macht supabase-js zu `error`; der Rumpf liegt dann in error.context.
 * Ohne dieses Auspacken verloere die Kundin genau die Saetze, die erklaeren,
 * was zu tun ist.
 */
async function anprobeRuf(client,fehlerText,body){
 const {data,error}=await client.functions.invoke('anprobe',{body});
 if(!error)return data||{ok:false,fehler:'keine Antwort'};
 let rumpf=null;
 try{rumpf=await error?.context?.json?.();}catch(e){rumpf=null;}
 if(rumpf&&typeof rumpf==='object')return {...rumpf,ok:false};
 return {ok:false,fehler:fehlerText(error)};
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
   const bildAufgeloest=bildLoeser(karte,bild);
   return heftAusZeilen({products:products||[],designers:designers||[],blocks:blocks||[],themes:themes||[],media:media||[],collection:collection||null,items:items||[]},{bild:bildAufgeloest});
  },
  async chat({messages=[],bilder=[],kontext={},session_id=sitzung()}={}){
   const gesendet=bilderTauglich(bilder);
   const {data,error}=await client.functions.invoke('pawn-chat',{body:{messages,session_id,image_urls:gesendet.length?gesendet:undefined,page_context:{route:kontext.route||'/frag-pawn',product_slug:kontext.product_slug,heft:kontext}}});
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
  /** Texte, die Daouda im Admin pflegt (site_content). Nur was gesetzt ist, ueberschreibt das Heft. */
  async texte(){
   const {data}=await client.from('site_content').select(SPALTEN.texte);
   return Object.fromEntries((data||[]).filter(r=>r&&r.key&&r.value).map(r=>[r.key,String(r.value)]));
  },
  /** Die geltenden Vertragsfassungen fuer Schritt 5 der Bewerbung. */
  async vertraege(){
   const {data}=await client.from('contract_versions').select(SPALTEN.vertraege).in('kind',['designer','designer_terms']).is('effective_to',null).order('kind');
   return (data||[]).map(r=>({id:r.id,titel:r.title||r.kind,url:r.url||'',art:r.kind}));
  },
  /**
   * „Alles loeschen" — und zwar wirklich, nicht nur auf diesem Geraet.
   * Das Geraetegedaechtnis raeumt das Heft selbst (store.mjs); hier faellt, was auf dem Server liegt.
   */
  async vergessen(){
   const u=await nutzer();if(!u)return {ok:true,nurGeraet:true};
   const wege=[
    client.from('kunden_stil').delete().eq('user_id',u.id),
    client.from('customer_measurements').delete().eq('user_id',u.id),
    client.from('style_references').delete().eq('user_id',u.id),
    client.from('user_memory').update({preferences:{},facts:[],updated_at:new Date().toISOString()}).eq('user_id',u.id)
   ];
   const ergebnis=await Promise.allSettled(wege);
   client.from('domain_events').insert({type:'ai.memory_deleted',user_id:u.id,payload:{quelle:'heft'}}).then(()=>{},()=>{});
   const fehler=ergebnis.filter(r=>r.status==='rejected'||r.value?.error);
   return fehler.length?{ok:false,fehler:'Nicht alles ließ sich löschen.'}:{ok:true};
  },
  async signal(art,daten={}){
   if(art==='ansehen'&&daten.product?.id)client.rpc('bump_product_view',{p_product_id:daten.product.id}).then(()=>{},()=>{});
   if(funktionen.signal)funktionen.signal(art,daten);
  },
  konto:{
   async aktuell(){const u=await nutzer();if(!u)return null;const {data}=await client.from('profiles').select('display_name,member_number').eq('id',u.id).maybeSingle();/* Die Rollen kommen aus der Huelle, nicht aus einer zweiten Abfrage: useAuth() hat sie
       ohnehin schon geladen. Die Zugang-Doppelseite zeigt damit die Tuer, die passt. */
    return {id:u.id,email:u.email||'',name:data?.display_name||u.email?.split('@')[0]||'',member_number:data?.member_number??null,rollen:(funktionen.rollen?.())||[]};},
   async anmelden(){if(funktionen.anmelden)return funktionen.anmelden();},
   async bestellungen(){const u=await nutzer();if(!u)return [];const {data}=await client.from('orders').select('id,created_at,status,fulfillment_status,amount_total,items,tracking_number,invoice_number').eq('user_id',u.id).order('created_at',{ascending:false}).limit(20);return (data||[]).map(orderFromRow);},
   /** Die eigenen Faeden zu den Haeusern — dieselbe Abfrage wie useMyRequestThreads. */
   async anfragen(){
    const u=await nutzer();if(!u)return [];
    const {data}=await client.from('message_threads').select(SPALTEN.anfragen).eq('created_by',u.id).order('last_message_at',{ascending:false}).limit(20);
    return (data||[]).map(r=>({
     id:r.id,betreff:r.subject||'Anfrage',stand:r.status||'offen',
     datum:r.last_message_at?new Date(r.last_message_at).toLocaleDateString('de-DE'):'',
     haus:r.designers?.brand_name||'',hausSlug:r.designers?.slug||'',
     werk:r.products?.name||'',werkSlug:r.products?.slug||''
    }));
   },
   /** Die Rechnung liegt im privaten Eimer; die Adresse gilt eine Stunde. */
   async rechnung(orderId){
    if(!orderId)return null;
    const {data,error}=await client.storage.from('invoices').createSignedUrl(orderId+'.pdf',3600);
    return error?null:(data&&data.signedUrl)||null;
   },
   async abmelden(){await client.auth.signOut();}
  },
  /*
   * DER BEGLEITER (Auftrag O, A5). Vier Methoden, mehr braucht der Verstand nicht.
   *
   * Der Katalog wird EINMAL je Sitzung geholt — 30 Saetze und 30 Regeln sind klein,
   * und ein Begleiter, der bei jedem Ereignis die Datenbank fragt, waere langsam und
   * gespraechig zugleich.
   */
  async begleiter(){
   const [{data:saetze,error:e1},{data:regeln,error:e2}]=await Promise.all([
    client.from('begleiter_saetze').select(SPALTEN.begleiterSaetze).eq('aktiv',true),
    client.from('begleiter_regeln').select(SPALTEN.begleiterRegeln).eq('aktiv',true)
   ]);
   if(e1||e2)return {saetze:[],regeln:[]};
   return {saetze:saetze||[],regeln:regeln||[]};
  },
  /** Was gesagt, abgelehnt oder angenommen wurde — nur mit Konto, die RPC prueft das selbst. */
  async begleiterMerken(satzKey,antwort,notizen){
   const u=await nutzer();if(!u)return null;
   const {data,error}=await client.rpc('begleiter_merken',{satz_key:satzKey,antwort,notizen:notizen??null});
   return error?null:data;
  },
  /** Besuche, Rang, letzter Besuch. Ohne Konto gibt es nichts zu zaehlen. */
  async begleiterBesuch(){
   const u=await nutzer();if(!u)return null;
   const {data,error}=await client.rpc('begleiter_besuch');
   if(error)return null;
   return Array.isArray(data)?(data[0]??null):(data??null);
  },
  /**
   * Der Archetypen-Katalog. Anon darf ihn lesen (Policy „stil_archetypen lesen",
   * gemessen am 12.09.2026) — ohne das haette ein Gast nichts, wogegen zu rechnen waere.
   */
  async archetypen(){
   const {data,error}=await client.from('stil_archetypen')
    .select(SPALTEN.archetypen).eq('aktiv',true).order('welt').order('sort');
   return error?[]:(data||[]);
  },
  /**
   * Der eigene Archetyp aus der Datenbank — nur mit Konto. Die RPC beginnt selbst mit
   * `if uid is null then return`, aber wir fragen gar nicht erst: ein Aufruf, von dem
   * man weiss, dass er nichts liefern kann, ist eine Anfrage zu viel.
   *
   * Fuer Gaeste rechnet archetyp.mjs im Browser. Gleiche Form, andere Quelle.
   */
  async archetyp(merklisteSlugs=[]){
   const u=await nutzer();if(!u)return null;
   const {data,error}=await client.rpc('archetyp_berechnen',{_merkliste_slugs:merklisteSlugs});
   if(error)return null;
   return Array.isArray(data)?(data[0]??null):(data??null);
  },
  /** „Das bin ich" oder „Eher nicht". Ohne Konto gibt es nichts zu bestaetigen. */
  async archetypBestaetigen(key,ja){
   const u=await nutzer();if(!u)return null;
   const {data,error}=await client.rpc('archetyp_bestaetigen',{_key:key,_ja:!!ja});
   return error?null:(data??true);
  },
  /*
   * Ein Ereignis wegschreiben — NUR mit Konto UND mit Zustimmung zur Auswertung.
   * Beides zusammen, nicht eines davon: ohne Konto gibt es keine Zeile, die jemandem
   * gehoert, und ohne consent_analytics hat niemand erlaubt, sein Verhalten zu zaehlen.
   */
  async ereignis(flaeche,art,daten){
   const u=await nutzer();if(!u)return null;
   if(!funktionen.darfZaehlen?.())return null;
   const {error}=await client.from('begleiter_ereignisse')
    .insert({user_id:u.id,session_id:sitzung()??null,flaeche,ereignis:art,daten:daten??{}});
   return error?null:true;
  },
  /*
   * ————————————————————————————————————————————————————————————————
   * DIE ANPROBE (Block D). Bild hoch, Aufsteller, Urteil.
   *
   * Das Backend steht seit Block D und ist AUSGELIEFERT — gemessen ueber
   * 401-statt-404: `anprobe`, `freistellen` und `generate-tryon` antworten.
   * Gerufen hat es bis heute NIEMAND: app.js beantwortete alle vier Chips mit
   * dem Platzhalter „Das kommt gleich". Hier steht der fehlende Anschluss.
   *
   * Was die Function NICHT tut: hochladen. Sie erwartet eine fertige Zeile in
   * `kunden_bilder` mit `quelle_path` im Eimer `kunden-bilder` und sucht sie
   * ueber user_id + art + aktiv (anprobe/index.ts:212). Das Hochladen ist
   * deshalb Sache des Hefts.
   *
   * WAS HIER NICHT GEMESSEN WERDEN KONNTE: die Schreibrechte am Eimer.
   * Die Migration 20261001130000_kunden_bilder_anproben.sql liegt NICHT im
   * Repo (supabase/migrations/LIESMICH.md) — Policy und Eimer sind von hier
   * aus unsichtbar. Darum reicht `bild()` den ECHTEN Fehlertext durch und
   * erfindet keinen Erfolg: schlaegt das Hochladen fehl, steht der Grund auf
   * dem Bildschirm, statt dass die Seite still haengen bleibt.
   * ————————————————————————————————————————————————————————————————
   */
  anprobe:{
   /** Welche Bildart und welche Aktion eine Welt braucht. Die Function prueft dasselbe noch einmal. */
   art:welt=>welt==='interior'?'raum':welt==='kunst'?'wand':'ganzkoerper',
   aktion:welt=>welt==='interior'?'raum':welt==='kunst'?'wand':'anprobe',
   /** Ein Bild der Kundin in den Eimer legen und die Zeile dazu anlegen. */
   async bild(datei,art){
    const u=await nutzer();if(!u)return {fehler:'Dafür brauchst du ein Konto.'};
    if(!datei||!String(datei.type||'').startsWith('image/'))return {fehler:'Bitte ein Bild wählen.'};
    if(datei.size>ANPROBE_GRENZE)return {fehler:'Das Bild ist zu groß — höchstens 8 MB.'};
    const sauber=String(datei.name||'bild.jpg').replace(/[^a-zA-Z0-9.-]/g,'_');
    const pfad=u.id+'/'+Date.now()+'-'+sauber;
    const {error:hoch}=await client.storage.from('kunden-bilder')
     .upload(pfad,datei,{contentType:datei.type||'image/jpeg',upsert:false});
    if(hoch)return {fehler:fehlerText(hoch)};
    // Das aeltere Bild derselben Art stilllegen — die Function nimmt immer das
    // neueste aktive, und zwei aktive Zeilen waeren eine Verwechslung im Wartestand.
    await client.from('kunden_bilder').update({aktiv:false})
     .eq('user_id',u.id).eq('art',art).eq('aktiv',true);
    const {data,error}=await client.from('kunden_bilder')
     .insert({user_id:u.id,art,quelle_path:pfad,name:datei.name||null,aktiv:true,status:'neu'})
     .select('id,art,status').maybeSingle();
    if(error)return {fehler:fehlerText(error)};
    return {ok:true,bild_id:data?.id||null,art,name:datei.name||null};
   },
   /** Nur fuer Mode: die Person freistellen, damit das Stueck sauber sitzt. Darf fehlschlagen. */
   async bereinigen(bild_id){return anprobeRuf(client,fehlerText,{aktion:'bereinigen',bild_id});},
   /** Die Anprobe anstossen. Antwortet sofort mit {anprobe_id}; gerechnet wird im Hintergrund. */
   async starten({welt='mode',product_id,bild_id,platz}={}){
    const aktion=welt==='interior'?'raum':welt==='kunst'?'wand':'anprobe';
    return anprobeRuf(client,fehlerText,{aktion,product_id,bild_id:bild_id||undefined,platz:platz||undefined});
   },
   /** Nachfragen, wie weit sie ist. status: laeuft · fertig · fehler */
   async stand(anprobe_id){return anprobeRuf(client,fehlerText,{aktion:'stand',anprobe_id});},
   /** „Passt" oder „Passt nicht" — das Urteil der Kundin, nicht das der Maschine. */
   async bewerten(anprobe_id,bewertung){return anprobeRuf(client,fehlerText,{aktion:'bewerten',anprobe_id,bewertung});},
   /*
    * Was schon vorliegt. `state.anproben` war deklariert und wurde NIE gefuellt
    * (app.js:573 prueft darum immer falsch), obwohl die Gegenseite es erwartet
    * (pawn-chat/index.ts) und archetyp.mjs daraus Zuversicht rechnet.
    */
   async meine(){
    const u=await nutzer();if(!u)return {bilder:[],anproben:[]};
    const [{data:bilder},{data:anproben}]=await Promise.all([
     client.from('kunden_bilder').select('id,art,status,name,aktiv')
      .eq('user_id',u.id).eq('aktiv',true).order('created_at',{ascending:false}).limit(6),
     client.from('anproben').select('id,art,status,product_id,bewertung,created_at')
      .eq('user_id',u.id).order('created_at',{ascending:false}).limit(20)
    ]);
    return {bilder:bilder||[],anproben:anproben||[]};
   }
  },
  /*
   * Das Stilfoto lesen lassen. Bis heute passierte mit dem Upload NICHTS ausser
   * dem Dateinamen (app.js: `state.foto = datei.name`) — der Modus 'stilfoto' in
   * pawn-chat wurde im ganzen Heft von niemandem gerufen. Folge: `farbUrteil()`
   * in beratung.mjs gab in der Anwendung immer null zurueck, weil kein Aufrufer
   * das dritte Argument (den Farb-Befund) je hatte.
   */
  async foto(datei,welt='mode'){
   const u=await nutzer();if(!u)return {fehler:'Dafür brauchst du ein Konto.'};
   const bilder=bilderTauglich([datei]);
   if(!bilder.length)return {fehler:'Bitte ein Bild wählen — höchstens 2 MB.'};
   const {data,error}=await client.functions.invoke('pawn-chat',{
    body:{mode:'stilfoto',image_urls:bilder,session_id:sitzung(),page_context:{route:'/dna',welt}}
   });
   if(error)return {fehler:fehlerText(error)};
   const befund=data?.foto_befund||data?.befund||null;
   return befund&&typeof befund==='object'?{ok:true,befund}:{ok:true,befund:null};
  },
  /* Anmelden, Registrieren und Google liegen in der React-Huelle, nicht hier: dort lebt
     supabase.auth samt Sitzung, dort steht der Vergleich der beiden Passwoerter
     (features/auth/registrieren.ts), und dort weiss man, welche Tuer die Rolle oeffnet.
     Das Heft kennt nur diese drei Fragen und die Antwort {ok} oder {fehler}. */
  zugang:{
   async anmelden(d){return (await funktionen.zugang?.anmelden?.(d))??{fehler:'Anmelden ist hier nicht eingerichtet.'};},
   async registrieren(d){return (await funktionen.zugang?.registrieren?.(d))??{fehler:'Registrieren ist hier nicht eingerichtet.'};},
   async google(d){return (await funktionen.zugang?.google?.(d))??{fehler:'Google ist hier nicht eingerichtet.'};}
  }
 };
}

/** Die Spalten der Buehne und ihres Katalogs. Wie SPALTEN: was nicht gebraucht wird, reist nicht mit. */
export const SPALTEN_BUEHNE = {
 buehnen:'id,designer_id,welt,blatt,layout,kicker,titel,text,boden,ruecken,licht,stuecke,deko,eigenhaendig,veroeffentlicht,version',
 deko:'key,art,welt,ebene,hoehe_m,seitenverhaeltnis,cutout_url,name,tags'
};

/**
 * studioQuelle — dieselbe Buehne, aber von innen (B4).
 *
 * WARUM SIE UEBERHAUPT GEBRAUCHT WIRD. `StudioHeft.tsx` erwartet diesen Export seit
 * seinem ersten Tag und fand ihn nie. Darum — und nur darum — zeigte der Menuepunkt
 * „Auftritt" eine leere weisse Flaeche: die Seite brach mit `fehlt = "studioQuelle"` ab,
 * bevor das Heft startete. Das war Daoudas erster Mangel, und das hier ist seine Ursache.
 *
 * DER UNTERSCHIED ZU supabaseQuelle, in drei Saetzen:
 *  1. Sie liest EIN Haus, nicht alle — `status` und `published` sind ihr gleich, denn ein
 *     Haus muss seine Seite auch bearbeiten koennen, BEVOR sie veroeffentlicht ist.
 *  2. Sie liest die Buehne dazu (`heft_buehnen`) und den Aufsteller-Katalog (`heft_deko`),
 *     und haengt beides an `heft.buehnen`. Erst damit laeuft der Zweig in world.mjs › display().
 *  3. Kaufen, Chatten, Bewerben gibt es hier nicht. Ein Editor ist kein Laden. Jede dieser
 *     Methoden antwortet `{fehler:'studio'}` — sie fehlt nicht, sie ist ausdruecklich zu.
 *
 * Der Versionsriegel steht NICHT hier, sondern in `buehne.mjs › schreibEntwurf()` — dort ist
 * er ohne Browser pruefbar. Diese Datei fuehrt nur aus, was er vorgibt.
 */
export function studioQuelle({client,haus,bild=u=>u,funktionen={}}={}){
 if(!client)throw Error('studioQuelle braucht den supabase-js-Client.');
 if(!haus)throw Error('studioQuelle braucht den Slug des eigenen Hauses.');
 const fehlerText=e=>e?.message||String(e);
 const nutzer=async()=>{const {data}=await client.auth.getUser();return data?.user||null;};
 const zu=async()=>({fehler:'studio',text:'Das geht nur in der Ausgabe, nicht im Editor.'});
 let hausId=null;

 /** Der Katalog der Aufsteller, nach `key` — genau die Form, die dekoNachEbenen() erwartet. */
 const dekoKatalog=async()=>{
  const {data}=await client.from('heft_deko').select(SPALTEN_BUEHNE.deko).eq('aktiv',true);
  return Object.fromEntries((data||[]).filter(r=>r&&r.key).map(r=>[r.key,r]));
 };

 return {
  art:'studio',bild,bearbeitbar:true,haus,

  async heft(){
   const {data:designer,error:eD}=await client.from('designers').select(SPALTEN.designers).eq('slug',haus).maybeSingle();
   if(eD)throw Error('designers: '+fehlerText(eD));
   if(!designer)throw Error('Das Haus «'+haus+'» gibt es nicht.');
   hausId=designer.id;
   // Im Studio gilt JEDER Entwurf, nicht nur `published` — sonst koennte niemand
   // eine Seite vorbereiten, die noch nicht oeffentlich ist.
   const [{data:products,error:eP},{data:blocks},{data:themes},{data:media},{data:buehnen},katalog]=await Promise.all([
    client.from('products').select(SPALTEN.products).eq('designer_id',designer.id).order('created_at',{ascending:false}).limit(400),
    client.from('designer_page_blocks').select(SPALTEN.blocks).eq('designer_id',designer.id).order('position'),
    client.from('house_themes').select(SPALTEN.themes).eq('designer_id',designer.id).eq('is_current',true),
    client.from('media_assets').select(SPALTEN.media).eq('designer_id',designer.id).eq('kind','bild').neq('review_status','abgelehnt').limit(200),
    client.from('heft_buehnen').select(SPALTEN_BUEHNE.buehnen).eq('designer_id',designer.id).order('blatt'),
    dekoKatalog()
   ]);
   if(eP)throw Error('products: '+fehlerText(eP));
   // Bildadressen in einer Runde auflösen — gleiche Begründung wie in supabaseQuelle.heft().
   const roh=new Set(),merke=v=>{if(typeof v==='string'&&v)roh.add(v);};
   for(const pr of products||[]){merke(pr.image_url);merke(pr.product_dna?.heft?.cutout_url);}
   merke(designer.hero_image_url);merke(designer.avatar_url);merke(designer.banner_url);
   merke(designer.portrait_url);merke(designer.atelier_image_url);
   for(const m of media||[]){merke(m.url);merke(m.thumb_url);}
   for(const k of Object.values(katalog))merke(k.cutout_url);
   let karte={};
   if(funktionen.signieren&&roh.size){try{karte=await funktionen.signieren([...roh])||{};}catch(e){karte={};}}
   const bildAufgeloest=bildLoeser(karte,bild);
   const modell=heftAusZeilen({
    products:(products||[]).map(r=>({...r,status:'published'})),
    designers:[{...designer,status:'active',published:true}],
    blocks:blocks||[],themes:themes||[],media:media||[],collection:null,items:[]
   },{bild:bildAufgeloest});
   // Der Katalog reist MIT der Buehne, nicht daneben: world.mjs liest buehne.dekoKatalog,
   // und eine Buehne ohne ihren Katalog stellte Aufsteller ohne Freistellung hin — also keine.
   const nachKatalog=Object.fromEntries(Object.entries(katalog)
    .map(([k,v])=>[k,{...v,cutout_url:v.cutout_url?bildAufgeloest(v.cutout_url):null}]));
   const erste=(buehnen||[])[0]||null;
   return {...modell,
    buehnen:erste?{[haus]:{...erste,dekoKatalog:nachKatalog}}:{},
    dekoKatalog:nachKatalog};
  },

  /** Eine Buehne lesen. `null` heisst: es gibt noch keine — der Aufrufer legt die erste an. */
  async buehneLesen(welt=null,blatt=null){
   if(!hausId){const {data}=await client.from('designers').select('id').eq('slug',haus).maybeSingle();hausId=data?.id||null;}
   if(!hausId)return null;
   let q=client.from('heft_buehnen').select(SPALTEN_BUEHNE.buehnen).eq('designer_id',hausId);
   if(welt)q=q.eq('welt',welt);
   if(blatt!=null)q=q.eq('blatt',blatt);
   const {data}=await q.order('blatt').limit(1).maybeSingle();
   return data||null;
  },

  /**
   * Eine Buehne schreiben — mit dem Versionsriegel aus schreibEntwurf().
   *
   * Trifft die Bedingung keine Zeile, hat jemand anderes dazwischen geschrieben. Dann wird
   * NICHTS ueberschrieben und der Aufrufer erfaehrt es (`{ueberholt:true}`), statt dass eine
   * Aenderung lautlos verschwindet. Das ist der Fall „zwei Fenster offen".
   */
  async buehneSchreiben(entwurf={}){
   if(!hausId){const {data}=await client.from('designers').select('id').eq('slug',haus).maybeSingle();hausId=data?.id||null;}
   if(!hausId)return {fehler:'haus_unbekannt'};
   const {bedingung,zeile}=schreibEntwurf(entwurf);
   const mitHaus={...zeile,designer_id:hausId,welt:entwurf.welt??null,blatt:entwurf.blatt??0};
   if(!bedingung.id){
    const {data,error}=await client.from('heft_buehnen').insert(mitHaus).select(SPALTEN_BUEHNE.buehnen).maybeSingle();
    return error?{fehler:fehlerText(error)}:{ok:true,buehne:data};
   }
   const {data,error}=await client.from('heft_buehnen').update(mitHaus)
    .eq('id',bedingung.id).eq('version',bedingung.version)
    .select(SPALTEN_BUEHNE.buehnen).maybeSingle();
   if(error)return {fehler:fehlerText(error)};
   if(!data){
    const jetzt=await client.from('heft_buehnen').select('version').eq('id',bedingung.id).maybeSingle();
    return {ueberholt:true,version:jetzt.data?.version??null};
   }
   return {ok:true,buehne:data};
  },

  /**
   * Veroeffentlichen — und vorher sagen, was fehlt.
   *
   * Der Trigger `heft_buehne_pruefen` wirft `buehne_braucht_drei_werke` und
   * `werk_nicht_auf_ebene_zwei`. Beides ist fuer den Menschen davor unsichtbar. Darum
   * wird hier ZUERST gerechnet (fehltZumVeroeffentlichen) und nur dann geschrieben.
   */
  async buehneVeroeffentlichen(buehne={}){
   const gruende=fehltZumVeroeffentlichen(buehne);
   if(gruende.length)return {fehler:'unfertig',gruende,mindestens:WERKE_MINDESTENS};
   if(!buehne.id)return {fehler:'unfertig',gruende:['die Bühne ist noch nicht gespeichert'],mindestens:WERKE_MINDESTENS};
   const {data,error}=await client.from('heft_buehnen')
    .update({veroeffentlicht:true,version:(buehne.version??0)+1})
    .eq('id',buehne.id).eq('version',buehne.version??0)
    .select(SPALTEN_BUEHNE.buehnen).maybeSingle();
   if(error){
    const t=fehlerText(error);
    if(/buehne_braucht_drei_werke/.test(t))return {fehler:'unfertig',gruende:['noch nicht genug Werke'],mindestens:WERKE_MINDESTENS};
    if(/werk_nicht_auf_ebene_zwei/.test(t))return {fehler:'unfertig',gruende:['ein Werk liegt nicht auf der mittleren Ebene'],mindestens:WERKE_MINDESTENS};
    return {fehler:t};
   }
   if(!data)return {ueberholt:true};
   return {ok:true,buehne:data};
  },

  dekoKatalog,

  /* Ein Editor ist kein Laden. Diese Tueren sind zu, und zwar ausdruecklich —
     nicht vergessen, sondern geschlossen. app.js ruft sie ohne `?.`, darum stehen sie da. */
  chat:async()=>null,
  kasse:zu,anfrage:zu,bewerbung:zu,vergessen:zu,
  /* Auch die Anprobe ist im Editor zu: sie gehoert der Kundin, nicht dem Haus.
     Sie steht hier trotzdem VOLLSTAENDIG, weil app.js ihre Methoden ohne `?.`
     ruft — eine fehlende waere im Studio ein harter Absturz, kein Nein. */
  anprobe:{
   art:welt=>welt==='interior'?'raum':welt==='kunst'?'wand':'ganzkoerper',
   aktion:welt=>welt==='interior'?'raum':welt==='kunst'?'wand':'anprobe',
   bild:zu,bereinigen:zu,starten:zu,stand:zu,bewerten:zu,
   async meine(){return {bilder:[],anproben:[]};}
  },
  foto:zu,
  async vertraege(){return [];},
  async texte(){return {};},
  signal(){},
  stil:{async laden(){return null;},speichern:zu},
  masse:{async laden(){return null;},speichern:zu},
  merkliste:{async laden(){return [];},setzen:zu},
  konto:{
   async aktuell(){const u=await nutzer();return u?{id:u.id,email:u.email,name:u.email}:null;},
   anmelden:zu,async abmelden(){return {ok:true};},
   async bestellungen(){return [];},async anfragen(){return [];},async rechnung(){return null;}
  },
  zugang:{anmelden:zu,registrieren:zu,google:zu}
 };
}
