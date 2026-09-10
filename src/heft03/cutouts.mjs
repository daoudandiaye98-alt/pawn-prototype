// Aufsteller-Bilder der Bühne. Die Freistellung passiert NICHT im Browser:
// Beispieldaten kommen fertig transparent aus assets/ (tools/freistellen.py),
// echte Werke bringen ihre freigestellte Fassung mit (product.cutout = product_dna.heft.cutout_url).
// Ohne Freistellung kommt ein Werk nicht auf die Bühne — es bleibt auf den Seiten (Suche, Haus, Seitenfenster).
// Aus jedem Bild wird eine kleine Alphakarte für die räumliche Trefferprüfung abgeleitet.
import {asset} from './data.mjs';
export const cutouts=new Map();
const MASK_WIDTH=256;
let manifest=null;

async function demoManifest(){
 if(manifest)return manifest;
 try{const r=await fetch(asset('cutouts.json'));manifest=r.ok?await r.json():{};}catch(e){manifest={};}
 return manifest;
}
/** Adresse des Aufstellers: freigestellte Fassung des Hauses, sonst Beispiel-Freistellung. Nie das Produktfoto. */
export async function aufstellerQuelle(p){
 if(typeof p==='string')p={id:p};
 if(p.cutout)return {url:p.cutout,frei:true};
 const m=await demoManifest();
 if(m[p.id])return {url:asset('cutout-'+p.id+'.webp'),frei:true,ratio:m[p.id].ratio};
 throw Error('Keine Freistellung für: '+(p.id||'?'));
}
/** prepareCutouts(produkte) — nur bühnenfähige Produkte übergeben (data.mjs › buehnenfaehig). */
export async function prepareCutouts(liste){
 await Promise.all(liste.map(async p=>{
  const q=await aufstellerQuelle(p),id=typeof p==='string'?p:p.id;
  const image=await ladeBild(q.url,/^https?:/.test(q.url)&&!q.url.startsWith(location.origin));
  const w=Math.min(MASK_WIDTH,image.naturalWidth),h=Math.max(1,Math.round(w*image.naturalHeight/image.naturalWidth));
  let data=null;
  try{
   const mask=document.createElement('canvas');mask.width=w;mask.height=h;
   const ctx=mask.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);
   data=ctx.getImageData(0,0,w,h).data;
  }catch(e){data=null;} // fremde Herkunft ohne CORS: ganze Fläche gilt als Treffer (Storage von Supabase sendet CORS)
  cutouts.set(id,{image,url:q.url,frei:q.frei,ratio:q.ratio||image.naturalWidth/image.naturalHeight,mask:{width:w,height:h,data}});
 }));
}
export function alphaHit(id,u,v){
 const item=cutouts.get(id);if(!item)return false;
 const {width,height,data}=item.mask;if(!data)return true;
 const x=Math.max(0,Math.min(width-1,Math.floor(u*width))),y=Math.max(0,Math.min(height-1,Math.floor((1-v)*height)));
 return data[(y*width+x)*4+3]>32;
}

export const bilder=new Map();
export async function prepareBilder(namen){
 await Promise.all(namen.map(async n=>bilder.set(n,await ladeBild(asset(n)))));
}
// Auf das load-Ereignis warten, nicht auf decode(): in einem Hintergrund-Tab
// schiebt der Browser das Dekodieren auf und die Seite bliebe im Ladezustand stehen.
export function ladeBild(url,fremd=false){
 return new Promise((fertig,fehler)=>{
  const i=new Image();i.decoding='async';if(fremd)i.crossOrigin='anonymous';
  i.onload=()=>fertig(i);i.onerror=()=>fehler(Error('Bild nicht ladbar: '+url));
  i.src=url;
  if(i.complete&&i.naturalWidth)fertig(i);
 });
}
