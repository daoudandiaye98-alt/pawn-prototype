// Beispielzeilen in der Form der echten Tabellen (types.ts, Stand 09/2026). Keine echten Häuser, keine echten Marken.
// Dient Tests und der Probe-Seite probe-echt.html — so sieht das Heft aus, wenn es aus der Datenbank kommt.
export const designers=[
 {id:'d-1',slug:'haus-lind',brand_name:'LIND',house_number:31,status:'active',published:true,page_published_at:'2026-09-01T10:00:00Z',plan:'atelier',
  brand_dna:{worlds:{Mode:.9,Interior:.1,Kunst:0},signals:['klar','wolle'],archetyp:'editorial'},story:'Wir schneiden für Menschen, die sich bewegen. Ein Stoff, eine Linie, viel Luft.',manifesto:null,
  quote:'Weniger Naht. Mehr Weg.',quote_role:'Gründerin',collection_title:'Ein Mantel<br>für den Weg.',location:'Leipzig',country:'DE',website:null,instagram:null,tags:['Mode','Wolle'],
  hero_image_url:'./assets/mode-stange-894.webp',avatar_url:null,banner_url:null,portrait_url:'./assets/haeuser-werkbank-894.webp',atelier_image_url:'./assets/archetyp-atelier.webp',atelier_caption:'Das Atelier in Leipzig',is_featured:true,verkaufsbereit:true},
 {id:'d-2',slug:'haus-ocker',brand_name:'OCKER',house_number:32,status:'active',published:true,page_published_at:null,plan:'haus',
  brand_dna:{archetyp:'atelier'},story:'Gefäße aus dem Ofen um die Ecke. Jedes anders, jedes ehrlich.',quote:null,quote_role:null,collection_title:null,location:'Wien',country:'AT',tags:['Interior'],
  hero_image_url:'./assets/interior-ecke-894.webp',portrait_url:null,banner_url:'./assets/interior-ocker.webp',atelier_image_url:null,atelier_caption:null,is_featured:false,verkaufsbereit:false},
 {id:'d-3',slug:'haus-spur',brand_name:'SPUR',house_number:33,status:'active',published:true,page_published_at:'2026-08-20T10:00:00Z',plan:'maison',
  brand_dna:{archetyp:'galerie'},story:'Arbeiten auf Papier und Leinwand, zwischen Geste und Ordnung.',quote:'Die Fläche hält, was die Hand losließ.',quote_role:'Künstlerin',collection_title:'Serie IV',location:'Paris',country:'FR',tags:[],
  hero_image_url:'./assets/kunst-staffelei-894.webp',portrait_url:null,banner_url:null,atelier_image_url:'./assets/kunst-haende.webp',atelier_caption:null,is_featured:false,verkaufsbereit:true},
 {id:'d-9',slug:'haus-still',brand_name:'STILL',house_number:34,status:'active',published:false,page_published_at:null,plan:'haus',brand_dna:{},story:'',tags:['Mode'],hero_image_url:null,verkaufsbereit:false}
];
export const products=[
 {id:'p-1',slug:'lind-mantel-01',name:'Mantel 01',world:'Mode',price:520,image_url:'./assets/mode-stange-894.webp',description:'Ein gerader Mantel aus kochfester Wolle. Zwei Taschen, eine Linie.',designer_note:'Fällt gerade, trägt sich weit.',
  product_dna:{heft:{cutout_url:'./assets/cutout-noir.webp',hoehe:2.9,notiz:'Gerade geschnitten, weit getragen.'},materials:['Wolle'],silhouette:['Gerade'],colors:['Schwarz'],mood:['Klar'],kind:'verkauf',groesse:'XS–L',passform:'gerade',material:'100 % Wolle',farbe:'Schwarz',pflege:'Lüften statt waschen'},
  size_variants:[{size:'S',stock:2,surcharge:0,sku:null},{size:'M',stock:0,surcharge:0,sku:null},{size:'L',stock:1,surcharge:0,sku:null}],
  measurements:{rows:['Brustumfang','Schulterbreite'],values:{Brustumfang:{S:'104',M:'110',L:'116'},Schulterbreite:{S:'44',M:'46',L:'48'}}},
  material_composition:[{material:'Wolle',percent:100}],inventory_mode:'stock',stock_quantity:3,lead_time_days:null,tags:['mantel','wolle'],status:'published',height_cm:null,designer_id:'d-1',designers:{id:'d-1',slug:'haus-lind',brand_name:'LIND',verkaufsbereit:true}},
 {id:'p-2',slug:'lind-hemd-03',name:'Hemd 03',world:'Mode',price:190,image_url:'./assets/edit-atelier.webp',description:'Ein weites Hemd aus Leinen.',designer_note:null,
  product_dna:{materials:['Leinen'],silhouette:['Weit'],colors:['Creme'],mood:['Weich'],kind:'auf_bestellung'},size_variants:[{size:'S',stock:0},{size:'M',stock:0}],measurements:null,material_composition:[],inventory_mode:'made_to_order',stock_quantity:0,lead_time_days:21,tags:[],status:'published',designer_id:'d-1',designers:{id:'d-1',slug:'haus-lind',brand_name:'LIND',verkaufsbereit:true}},
 {id:'p-3',slug:'ocker-gefaess-07',name:'Gefäß 07',world:'Interior',price:140,image_url:'./assets/boutique-objekte-894.webp',description:'Steinzeug, von Hand aufgebaut.',designer_note:null,
  product_dna:{heft:{cutout_url:'./assets/cutout-vessel.webp',hoehe:1.48},materials:['Ton'],silhouette:[],colors:['Ocker'],mood:['Warm'],kind:'verkauf',masse:'28 × 18 cm',material:'Steinzeug'},size_variants:[],measurements:null,material_composition:[{material:'Steinzeug',percent:100}],inventory_mode:'stock',stock_quantity:4,lead_time_days:null,tags:['keramik'],status:'published',height_cm:28,designer_id:'d-2',designers:{id:'d-2',slug:'haus-ocker',brand_name:'OCKER',verkaufsbereit:false}},
 {id:'p-4',slug:'spur-serie-iv-2',name:'Serie IV / 2',world:'Kunst',price:2400,image_url:'./assets/kunst-malerei.webp',description:'Pigment und Bindemittel auf Leinwand, 120 × 90 cm.',designer_note:'Zweites Blatt der Serie.',
  product_dna:{heft:{cutout_url:'./assets/cutout-art.webp'},materials:['Pigment'],silhouette:[],colors:['Schwarz','Weiß'],mood:['Geste'],kind:'original',technik:'Pigment auf Leinwand',masse:'120 × 90 cm',jahr:'2026'},size_variants:[],measurements:null,material_composition:[],inventory_mode:'stock',stock_quantity:1,lead_time_days:null,tags:['malerei','serie'],status:'published',height_cm:120,width_cm:90,designer_id:'d-3',designers:{id:'d-3',slug:'haus-spur',brand_name:'SPUR',verkaufsbereit:true}},
 {id:'p-5',slug:'spur-auftrag',name:'Auftragsarbeit',world:'Kunst',price:0,image_url:'./assets/pigmente.webp',description:'Eine Arbeit nach Gespräch.',designer_note:null,
  product_dna:{kind:'auftragsarbeit',mood:['Geste']},size_variants:[],measurements:null,material_composition:[],inventory_mode:'made_to_order',stock_quantity:0,lead_time_days:null,tags:[],status:'published',designer_id:'d-3',designers:{id:'d-3',slug:'haus-spur',brand_name:'SPUR',verkaufsbereit:true}},
 {id:'p-6',slug:'entwurf',name:'Entwurf',world:'Mode',price:100,image_url:'./assets/edit-atelier.webp',description:'',product_dna:{},size_variants:[],inventory_mode:'stock',stock_quantity:1,status:'draft',designer_id:'d-1',designers:{id:'d-1',slug:'haus-lind',brand_name:'LIND'}},
 {id:'p-7',slug:'ohne-bild',name:'Ohne Bild',world:'Mode',price:100,image_url:null,description:'',product_dna:{},size_variants:[],inventory_mode:'stock',stock_quantity:1,status:'published',designer_id:'d-1',designers:{id:'d-1',slug:'haus-lind',brand_name:'LIND'}},
 {id:'p-8',slug:'still-01',name:'Still 01',world:'Mode',price:100,image_url:'./assets/edit-atelier.webp',description:'',product_dna:{},size_variants:[],inventory_mode:'stock',stock_quantity:1,status:'published',designer_id:'d-9',designers:{id:'d-9',slug:'haus-still',brand_name:'STILL'}}
];
export const blocks=[
 {id:'b-1',designer_id:'d-1',kind:'auftakt',position:0,content:{media_asset_id:'m-1',media_kind:'bild',ton:'ruhig'}},
 {id:'b-2',designer_id:'d-1',kind:'editorial_text',position:1,content:{heading:'Unterwegs.',text:'Kleidung, die mitgeht.'}},
 {id:'b-3',designer_id:'d-1',kind:'zitat',position:2,content:{quote:'Weniger Naht. Mehr Weg.',author:'LIND'}},
 {id:'b-4',designer_id:'d-1',kind:'produktreihe',position:3,content:{product_ids:['p-1','p-2']}},
 {id:'b-5',designer_id:'d-3',kind:'auftakt',position:0,content:{media_asset_id:'m-3',media_kind:'bild'}},
 {id:'b-6',designer_id:'d-3',kind:'lookbook_streifen',position:1,content:{media_asset_ids:['m-3','m-4'],product_id:'p-4'}},
 {id:'b-7',designer_id:'d-2',kind:'editorial_text',position:0,content:{heading:'Unveröffentlicht',text:'darf nicht erscheinen'}}
];
export const themes=[
 {designer_id:'d-1',version:3,is_current:true,farbwelt:{bg:'#f4efe6',fg:'#2a2521',accent:'#7a2e35',muted:'#8a7f72'},typografie:'editorial',flaechenrhythmus:'ruhig',kantenhaerte:'hart',bewegungscharakter:'gestaffelt',hintergrundtextur:{typ:'papier'},uebergangsart:'fade'},
 {designer_id:'d-1',version:2,is_current:false,farbwelt:{bg:'#fff',fg:'#000',accent:'#000'},typografie:'archiv'},
 {designer_id:'d-3',version:1,is_current:true,farbwelt:{bg:'#efefeb',fg:'#222',accent:'#3a4a44',muted:'#777'},typografie:'archiv',flaechenrhythmus:'luftig',kantenhaerte:'rund',bewegungscharakter:'ruhig',hintergrundtextur:{typ:'keine'},uebergangsart:'iris'}
];
export const media=[
 {id:'m-1',designer_id:'d-1',kind:'bild',url:'./assets/haeuser-werkbank-894.webp',thumb_url:null,product_id:null,review_status:'angenommen'},
 {id:'m-2',designer_id:'d-1',kind:'bild',url:'./assets/edit-atelier.webp',thumb_url:null,product_id:'p-1',review_status:'privat'},
 {id:'m-3',designer_id:'d-3',kind:'bild',url:'./assets/kunst-malerei.webp',thumb_url:null,product_id:null,review_status:'angenommen'},
 {id:'m-4',designer_id:'d-3',kind:'bild',url:'./assets/pigmente.webp',thumb_url:null,product_id:'p-4',review_status:'angenommen'},
 {id:'m-5',designer_id:'d-3',kind:'bild',url:'./assets/kunst-haende.webp',thumb_url:null,product_id:null,review_status:'abgelehnt'}
];
export const collection={id:'c-1',number:3,title:'Ausgewählt / 03',subtitle:'Drei Stücke für den Herbst',is_active:true};
export const items=[{collection_id:'c-1',product_slug:'spur-serie-iv-2',world:'Kunst',sort:2},{collection_id:'c-1',product_slug:'lind-mantel-01',world:'Mode',sort:1},{collection_id:'c-1',product_slug:'gibt-es-nicht',world:null,sort:3}];
export const zeilen={products,designers,blocks,themes,media,collection,items};
