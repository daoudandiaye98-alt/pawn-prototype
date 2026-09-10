export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
export const phase=(t,a,b)=>smooth((t-a)/(b-a));
export const reading=r=>!['entdecken','mode','interior','kunst'].includes(r.section);
export const key=r=>routeHash(r);
const queryKeys=['q','world','house','max','available','sort'];
export const routeHash=r=>{
 const params=new URLSearchParams();for(const k of queryKeys)if(r[k])params.set(k,String(r[k]));
 return '#/'+(r.section==='haus'?'haus/'+r.slug:r.section)+'/'+((r.index||0)+1)+(params.size?'?'+params:'');
};
export function parseRoute(hash,counts,houses){
 const clean=(hash||"").replace("#",""),[path,query=""]=(clean.startsWith("/")?clean.slice(1):clean).split("?"),[section,part,num]=path.split("/");
 const params=new URLSearchParams(query),extra={};
 for(const k of queryKeys){const v=params.get(k);if(v)extra[k]=v.slice(0,240);}
 if(section==='haus'&&houses[part])return {section,slug:part,index:clamp(Math.floor((Number(num)||1)-1),0,2)};
 if(section in counts)return {section,index:clamp(Math.floor((Number(part)||1)-1),0,section==='suche'?100:counts[section]-1),...(section==='suche'?extra:{})};
 return {section:'entdecken',index:0};
}
export class Magazine {
 constructor(route,reduced=false){this.route=route;this.from=route;this.target=null;this.pending=null;this.status=reduced?'ready':'intro';this.progress=reduced?1:0;this.swapped=false;this.origin=null;}
 go(route){
  if(this.status==='turn'){this.pending=route;return;}
  if(this.status==='intro'){this.status='ready';this.progress=1;}
  if(key(route)===key(this.route))return;
  this.from={...this.route};this.target={...route};this.progress=0;this.status='turn';this.swapped=false;
 }
 step(dir,count){if(this.status!=='ready')return false;const index=this.route.index+Math.sign(dir);if(index<0||index>=count)return false;this.go({...this.route,index});return true;}
 house(slug){if(!reading(this.route))this.origin={...this.route};this.go({section:'haus',slug,index:0});}
 back(){this.go(this.origin||{section:'haeuser',index:0});}
 tick(dt,speed=1){
  if(this.status==='ready')return false;
  this.progress=clamp(this.progress+dt*speed/(this.status==='intro'?4.8:2.25));
  if(this.status==='turn'&&this.progress>=.5&&!this.swapped){this.route=this.target;this.swapped=true;}
  if(this.progress===1){this.status='ready';this.target=null;if(this.pending){const p=this.pending;this.pending=null;this.go(p);}}
  return true;
 }
 skip(){if(this.status==='intro'){this.progress=1;this.status='ready';}}
 replay(){this.route={section:'entdecken',index:0};this.from=this.route;this.status='intro';this.progress=0;this.target=null;this.pending=null;this.origin=null;}
 pose(){
  const t=this.progress;
  if(this.status==='intro')return {lay:phase(t,.10,.52),open:phase(t,.19,.64),fold:phase(t,.76,1),read:reading(this.route)?phase(t,.66,1):0,leaf:0};
  if(this.status==='ready')return {lay:1,open:1,fold:reading(this.route)?0:1,read:reading(this.route)?1:0,leaf:0};
  const a=Number(reading(this.from)),b=Number(reading(this.target));
  return {lay:1,open:1,fold:t<.5?(1-a)*(1-phase(t,0,.24)):(1-b)*phase(t,.58,1),read:a+(b-a)*phase(t,.25,.88),leaf:phase(t,.24,.7)};
 }
}
export function purchaseMode(product){return ['auftragsarbeit','live_portrait','massanfertigung'].includes(product.kind)?'inquiry':product.inventory_mode==='stock'&&product.stock_quantity===0?'soldout':'cart';}
export function addCart(cart,p,size){
 if(purchaseMode(p)!=='cart')throw Error('Dieses Werk ist nicht direkt kaufbar.');
 if(p.sizes?.length&&!p.sizes.includes(size))throw Error('Bitte eine Größe wählen.');
 const next=cart.map(x=>({...x})),found=next.find(x=>x.id===p.id&&x.size===(size||''));
 const total=next.filter(x=>x.id===p.id).reduce((n,x)=>n+x.qty,0);
 if(p.inventory_mode==='stock'&&total>=p.stock_quantity)throw Error('Mehr Stücke sind in dieser Vorschau nicht verfügbar.');
 if(found)found.qty++;else next.push({id:p.id,size:size||'',qty:1});
 return next;
}
export const blockKinds=['auftakt','editorial_text','zitat','produktreihe','lookbook_streifen','banner_seitlich','banner_vollbreite','ueberlappend'];
export const orderedBlocks=blocks=>[...blocks].sort((a,b)=>a.position-b.position);
