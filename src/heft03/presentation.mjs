import {products,houses} from './data.mjs';
import {orderedBlocks} from './model.mjs';
export const themes={
 editorial:{label:'Editorial',paper:'#f6f1e7',ink:'#292521',accent:'#722d33',architecture:'arch',font:'Playfair'},
 galerie:{label:'Galerie',paper:'#f0f0ec',ink:'#262727',accent:'#6c716b',architecture:'frame',font:'Inter'},
 atelier:{label:'Atelier',paper:'#ece1d0',ink:'#493627',accent:'#8b623e',architecture:'fan',font:'Playfair'},
 archiv:{label:'Archiv',paper:'#dedfdc',ink:'#1f2826',accent:'#354943',architecture:'frame',font:'Inter'}
};
export const defaults={drape:'editorial',noir:'archiv',forme:'atelier',traces:'galerie'};
// defaults kennt nur die vier Beispielhäuser. Ein echtes Haus bringt seinen Archetyp
// (brand_dna.archetyp) und meist ein eigenes house_theme mit — ohne diesen Rückfall stünde
// die Doppelseite eines echten Hauses ohne Papier, ohne Tinte und ohne Schrift da.
export function housePresentation(slug,state){
 const haus=houses[slug]||{};
 const custom=state.presentations?.[slug]||{};
 const grund=custom.theme||defaults[slug]||haus.archetyp||'editorial';
 const preset=themes[grund]||themes.editorial;
 return {schemaVersion:1,houseSlug:slug,theme:grund,...preset,...(haus.theme||{}),...custom};
}
// Die Blockfolge und die Auswahl der Arbeiten gehören dem Haus. Beides ist
// hier lokal editierbar und wird beim Export in den bestehenden Vertrag übersetzt.
export function houseBlocks(slug,state){
 const basis=orderedBlocks(houses[slug].blocks||[]),eigen=state?.presentations?.[slug]?.blocks;
 if(!eigen)return basis.map(b=>({...b,on:true}));
 return eigen.map(e=>{const b=basis.find(x=>x.kind===e.kind);return b?{...b,on:e.on!==false}:null;}).filter(Boolean);
}
export function houseProducts(slug,state){
 const eigen=state?.presentations?.[slug]?.products;
 return eigen&&eigen.length?eigen:houses[slug].products;
}
export function searchProducts(route){
 const q=(route.q||'').trim().toLocaleLowerCase('de');
 let result=Object.values(products).filter(p=>{
  const hay=[p.name,p.material,p.description,houses[p.house].name,p.world].join(' ').toLocaleLowerCase('de');
  return (!q||q.split(/\s+/).every(word=>hay.includes(word)))&&(!route.world||p.world===route.world)&&(!route.house||p.house===route.house)&&(!route.max||(p.price!=null&&p.price<=Number(route.max)))&&(!route.available||p.stock_quantity!==0);
 });
 if(route.sort==='price-up')result.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
 if(route.sort==='price-down')result.sort((a,b)=>(b.price??-1)-(a.price??-1));
 return result;
}
export const searchCount=route=>Math.max(1,Math.ceil(searchProducts(route).length/2));
export function presentationExport(slug,state){
 const p=housePresentation(slug,state);
 const blocks=houseBlocks(slug,state).filter(b=>b.on).map((b,i)=>({kind:b.kind,position:i,content:b.content}));
 const ids=houseProducts(slug,state);
 return {scope:'local-preview',schemaVersion:1,houseSlug:slug,presentation:p,houseTheme:toHouseTheme(p),blocks,
  display:{productIds:ids,assetMode:'alpha-cutout',hinge:'bottom',
   slots:ids.map((id,i)=>({productId:id,x:ids.length===1?0:i?1.2:-1.15,z:.5,scale:1}))}};
}

/** Maps the existing HouseTheme contract into this renderer. Unknown presentation
 * controls are preview-only and never overwrite product, stock or house records. */
export function fromHouseTheme(theme={}){
 const colors=theme.farbwelt||{};
 return {paper:colors.bg||'#ffffff',ink:colors.fg||'#000000',accent:colors.accent||'#000000',muted:colors.muted||'#777777',
  font:{editorial:'Playfair',zart:'Georgia',archiv:'monospace',warm:'Georgia'}[theme.typografie]||'Playfair',
  rhythm:theme.flaechenrhythmus||'ruhig',texture:theme.hintergrundtextur||{typ:'keine'},motion:theme.bewegungscharakter||'ruhig'};
}
export function toHouseTheme(p){
 return {farbwelt:{bg:p.paper,fg:p.ink,accent:p.accent,muted:'#847a6b'},
  typografie:p.font==='Inter'?'archiv':p.font==='Georgia'?'zart':'editorial',flaechenrhythmus:'ruhig',kantenhaerte:'hart',
  bewegungscharakter:'gestaffelt',hintergrundtextur:{typ:'papier'},uebergangsart:'fade',quelle:'manuell_verfeinert'};
}

