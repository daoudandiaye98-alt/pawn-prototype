import {THREE,CSS3DObject,CSS3DRenderer} from './dreiD.mjs';
import {phase,smooth,clamp} from './model.mjs';
import {cutouts,alphaHit,bilder} from './cutouts.mjs';
import {products,displays} from './data.mjs';
const PI=Math.PI;
export function createWorld(container,readerLayer,onDirty){
 const materials=new Map(),textures=new Map(),cache=new Map();
 let scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,innerWidth/innerHeight,.1,90);
 let book,leftPage,rightPage,leaf,shadow,currentStage,style='contour',currentId='';
 const printPlanes=[],paperMats=[];
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.setSize(innerWidth,innerHeight);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 container.append(renderer.domElement);
 scene.add(new THREE.HemisphereLight('#ffffff','#c6c0b5',2.3));
 const light=new THREE.DirectionalLight('#fff8ec',3.3);light.position.set(-4,9,6);light.castShadow=true;
 light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.5,far:30});
 light.shadow.bias=-.0005;light.shadow.normalBias=.02;light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;scene.add(light);
 const fill=new THREE.DirectionalLight('#ffffff',.9);fill.position.set(5,4,-4);scene.add(fill);
 shadow=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.12}));
 shadow.rotation.x=-PI/2;shadow.position.y=-.185;shadow.receiveShadow=true;scene.add(shadow);
 function material(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if(!materials.has(key)) materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.83,side:THREE.DoubleSide,...extra}));
  return materials.get(key);
}
function mesh(geo, mat, parent, x=0,y=0,z=0) {
  const obj = new THREE.Mesh(geo,mat); obj.position.set(x,y,z); obj.castShadow=true; obj.receiveShadow=true; parent.add(obj); return obj;
}
function box(parent,w,h,d,color,x=0,y=0,z=0) { return mesh(new THREE.BoxGeometry(w,h,d),material(color),parent,x,y,z); }
function group(parent,x=0,y=0,z=0) { const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g; }
function line(parent,points,color='#7e756b',radius=.008) {
  const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve,40,radius,5,false),material(color),parent);
}
function polygon(parent,points,color,depth=.018) {
  const s = new THREE.Shape(); points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
  return mesh(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false}),material(color),parent);
}

 function canvasTexture(draw,w=1024,h=1024) {
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');draw(ctx,w,h);
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}
function wordmark(ctx,x,y,size) {
  ctx.fillStyle='#171717';ctx.font=`500 ${size}px Playfair`;ctx.textBaseline='alphabetic';
  ctx.fillText('P',x,y);const p=ctx.measureText('P').width;ctx.save();ctx.translate(x+p+size*.03,y-size*.72);ctx.scale(size*.0068,size*.0068);
  ctx.fill(new Path2D('M50 4c11 0 20 9 20 20 0 7.5-4.1 14-10.2 17.4 1.5 1.5 2.4 3.5 2.4 5.8 0 2.6-1.2 4.9-3.1 6.4C63.4 60 68 70.8 69.6 82H30.4C32 70.8 36.6 60 40.9 53.6c-1.9-1.5-3.1-3.8-3.1-6.4 0-2.3.9-4.3 2.4-5.8C34.1 38 30 31.5 30 24c0-11 9-20 20-20zM22 88h56l6 10H16z'));
  ctx.restore();ctx.fillText('WN',x+p+size*.72,y);
}
function spaced(c,text,x,y,gap=2.2,align='left') {
  const width=[...text].reduce((n,ch)=>n+c.measureText(ch).width+gap,-gap);
  let cx=align==='right'?x-width:x;
  for(const ch of text){c.fillText(ch,cx,y);cx+=c.measureText(ch).width+gap;}
}
function rules(c,x,y,width,lines,gap=15,color='#c9c0af') {
  c.fillStyle=color;
  for(let i=0;i<lines;i++)c.fillRect(x,y+i*gap,width-(i%4)*22-(i===lines-1?width*.42:0),1.6);
}
// Die bedruckte Innenseite. Sie ist beim Aufschlagen und zwischen zwei Szenen
// für einen Moment allein sichtbar und muss deshalb als echte Seite tragen.
function pageTexture(side) {
 const links=side==='01';
 const zeilen=(c,x,y,texte,gap=27)=>{for(const t of texte){c.fillText(t,x,y);y+=gap;}return y;}
 return canvasTexture((c,w,h)=>{
  const rand=58,breite=w-rand*2;
  c.fillStyle='#faf8f1';c.fillRect(0,0,w,h);
  c.fillStyle='#8d8478';c.font='500 13px Inter';
  spaced(c,links?'PAWN':'OBJECTS OF CHARACTER',rand,46,2.6);
  spaced(c,links?'AUSGABE 03':'MODE · INTERIOR · KUNST',w-rand,46,2.6,'right');
  c.fillStyle='#cec5b4';c.fillRect(rand,62,breite,1);
  c.fillStyle='#232220';
  if(links){
   c.font='500 84px Playfair';c.fillText('Your move.',rand,168);
   c.fillStyle='#6c6459';c.font='italic 500 30px Playfair';c.fillText('Jeder beginnt als Bauer. Keiner bleibt einer.',rand,214);
   c.fillStyle='#4a453d';c.font='400 19px Inter';
   let y=zeilen(c,rand,290,['Mode, Kunst und Design entstehen heute überall.','Ein Designer arbeitet in seinem Schlafzimmer.','Eine Künstlerin baut ihre erste Serie in einem kleinen Atelier.','','Jeden Tag entsteht mehr. Jeden Tag verschwindet mehr.','PAWN entsteht in genau diesem Spannungsfeld.'],30);
   c.fillStyle='#8d8478';c.font='500 12px Inter';spaced(c,'WAS WIR SEHEN',rand,y+30,2.4);
   c.fillStyle='#232220';c.font='500 46px Playfair';c.fillText('Wir glauben an die',rand,y+96);c.fillText('Kraft der Auswahl.',rand,y+150);
  } else {
   c.font='500 74px Playfair';c.fillText('A closer',rand,158);c.fillText('look.',rand,232);
   c.fillStyle='#6c6459';c.font='italic 500 26px Playfair';c.fillText('Vier Häuser. Eine Ausgabe.',rand,282);
   c.fillStyle='#4a453d';c.font='400 19px Inter';
   let y=zeilen(c,rand,340,['Eine Arbeit erscheint bei PAWN nicht einfach','zwischen tausenden anderen Produkten.','Sie bekommt Kontext. Eine Geschichte. Eine Nummer.','','Haus 07 · DRAPÉ · Berlin','Haus 12 · NOIR · Antwerpen','Haus 18 · FORME · Kopenhagen','Haus 24 · TRACES · Paris'],30);
   c.fillStyle='#8d8478';c.font='500 12px Inter';spaced(c,'WENIGER RAUSCHEN. MEHR BEDEUTUNG.',rand,y+30,2.4);
  }
  c.fillStyle='#cec5b4';c.fillRect(rand,h-92,breite,1);
  c.fillStyle='#4a453d';c.font='500 21px Playfair';c.fillText(links?'01':'02',rand,h-58);
  if(!links)wordmark(c,rand+52,h-58,21);
  c.fillStyle='#8d8478';c.font='500 12px Inter';
  spaced(c,links?'THE THIRD EDITION':'INDEPENDENT PERSPECTIVES',w-rand,h-60,2.4,'right');
  const gr=c.createLinearGradient(links?w:0,0,links?w-132:132,0);gr.addColorStop(0,'#0000002e');gr.addColorStop(1,'#00000000');c.fillStyle=gr;c.fillRect(0,0,w,h);
 },768,1024);
}
function buildBook() {
  book=group(scene);leftPage=group(book);rightPage=group(book);
  for(const [part,sign,num] of [[leftPage,-1,'01'],[rightPage,1,'02']]) {
    box(part,4.26,.075,5.32,'#cbc3b4',sign*2.11,-.07,0);
    box(part,4.19,.02,5.25,'#e9e3d6',sign*2.09,-.028,0);
    const top=box(part,4.10,.07,5.14,'#f7f4ec',sign*2.065,.005,0);
    top.material=top.material.clone();paperMats.push(top.material);
    for(let i=0;i<16;i++)box(part,4.10+(i%3)*.007,.0022,5.145+(i%2)*.006,i%2?'#d9d1c1':'#c9c0ae',sign*2.065,-.046+i*.0056,0);
    const page=mesh(new THREE.PlaneGeometry(4.1,5.14),new THREE.MeshStandardMaterial({map:pageTexture(num),roughness:1,side:THREE.DoubleSide}),part,sign*2.065,.049,0);page.rotation.x=-PI/2;page.castShadow=false;printPlanes.push(page);
  }
  const coverTex=canvasTexture((c,w,h)=>{
   // Das Titelbild trägt die Seite. Die Typografie liegt darüber, damit sie scharf bleibt.
   c.fillStyle='#2a1c1e';c.fillRect(0,0,w,h);
   const foto=bilder.get('cover.webp');
   if(foto)c.drawImage(foto,0,54,w,h);
   const oben=c.createLinearGradient(0,0,0,340);oben.addColorStop(0,'#1b1214aa');oben.addColorStop(1,'#1b121400');c.fillStyle=oben;c.fillRect(0,0,w,340);
   const unten=c.createLinearGradient(0,h,0,h-470);unten.addColorStop(0,'#160f10e0');unten.addColorStop(1,'#160f1000');c.fillStyle=unten;c.fillRect(0,h-470,w,470);
   c.fillStyle='#f6f1e7';
   c.font='500 196px Playfair';c.fillText('PAWN',56,204);
   c.font='16px Inter';c.fillText('INDEPENDENT MINDS. EXTRAORDINARY THINGS.',62,246);
   c.strokeStyle='#f6f1e755';c.beginPath();c.moveTo(62,278);c.lineTo(w-62,278);c.stroke();
   c.save();c.translate(84,900);c.rotate(-Math.PI/2);c.font='15px Inter';c.fillStyle='#f6f1e7cc';c.fillText('EVERY NUMBER TELLS A STORY.',0,0);c.restore();
   c.fillStyle='#f6f1e7';c.font='500 124px Playfair';c.fillText('YOUR MOVE.',56,1170);
   c.font='21px Inter';c.fillStyle='#f6f1e7cc';c.fillText('Jeder beginnt als Bauer. Keiner bleibt einer.',62,1222);
   c.strokeStyle='#f6f1e755';c.beginPath();c.moveTo(62,1278);c.lineTo(w-62,1278);c.stroke();
   c.font='15px Inter';c.fillStyle='#f6f1e7aa';c.fillText('03 / THE THIRD EDITION',62,1318);
   c.textAlign='right';c.fillText('FASHION · INTERIOR · ART',w-62,1318);
  },1024,1365);
  const cover=mesh(new THREE.PlaneGeometry(4.26,5.32),new THREE.MeshStandardMaterial({map:coverTex,roughness:.83,side:THREE.DoubleSide}),leftPage,-2.075,-.118,0);cover.rotation.set(PI/2,0,PI);
  leaf=group(book);const paper=box(leaf,4.11,.016,5.15,'#faf9f6',2.055,.079,0);paper.material=paper.material.clone();paperMats.push(paper.material);leaf.visible=false;
  const leafPrint=mesh(new THREE.PlaneGeometry(4.10,5.13),new THREE.MeshStandardMaterial({map:pageTexture('PAWN'),roughness:1,side:THREE.DoubleSide}),leaf,2.055,.09,0);leafPrint.rotation.x=-PI/2;printPlanes.push(leafPrint);
  for(const z of [-1.55,1.55])line(book,[[-.045,.057,z],[0,.061,z+.045],[.045,.057,z]],'#89857c',.004);
  const spine=mesh(new THREE.CylinderGeometry(.055,.055,5.3,20,1,false,0,PI),material('#c2b9ab'),book,0,.02,0);spine.rotation.set(PI/2,0,0);spine.castShadow=false;
}


 function hinge(stage,x,z,yaw,sign,delay=0) {
  const base=group(stage.root,x,.058,z);base.rotation.y=yaw;
  const pivot=group(base);stage.hinges.push({pivot,sign,delay});return pivot;
}
function addPlinth(stage,x,z,w,h,d,color='#f2efe8') {
  // Each face folds at its lower edge; the top rides the rising side walls.
  const base=group(stage.root,x,.07,z),walls=[];
  for(const side of [-1,1]) {
    const p=group(base,side*w/2,0,0);const f=box(p,.016,h,d,color,0,h/2,0);walls.push({p,axis:'z',sign:side});
  }
  for(const side of [-1,1]) {
    const p=group(base,0,0,side*d/2);box(p,w,h,.016,color,0,h/2,0);walls.push({p,axis:'x',sign:-side});
  }
  const top=box(base,w,.02,d,color,0,h,0);
  stage.plinths.push({walls,top,h});return h;
}

 function foldStage(stage,q) {
  // Die Bühne taucht aus der gedruckten Seite auf, statt flach darauf zu liegen.
  const appear=clamp(q/.16);
  if(stage.fade!==appear){
   stage.fade=appear;const durchsichtig=appear<1;
   stage.materials.forEach(m=>{if(m.transparent!==durchsichtig){m.transparent=durchsichtig;m.needsUpdate=true;}m.opacity=appear;});
  }
  stage.hinges.forEach(({pivot,sign,delay})=>{
    const amount=phase(q,delay,1);pivot.rotation.x=sign*(1-amount)*PI/2;
    pivot.scale.z=1;
  });
  stage.plinths.forEach(({walls,top,h})=>{
    const amount=smooth(q);
    walls.forEach(({p,axis,sign})=>p.rotation[axis]=sign*(1-amount)*PI/2);
    top.position.y=h*Math.sin(amount*PI/2)+.015;
  });
}

 buildBook();
 const cssRenderer=new CSS3DRenderer();cssRenderer.setSize(innerWidth,innerHeight);cssRenderer.domElement.style.overflow='clip';readerLayer.append(cssRenderer.domElement);
 const spread=document.createElement('article');spread.className='spread';spread.setAttribute('aria-label','Geöffnete Doppelseite');
 const cssObject=new CSS3DObject(spread);cssObject.scale.setScalar(8.2/1200);cssObject.rotation.x=-PI/2;cssObject.position.set(0,.067,0);book.add(cssObject);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),temp=new THREE.Vector3();
 function texture(url){
  if(!textures.has(url)){const t=new THREE.TextureLoader().load(url,()=>{letzteSignatur='';onDirty();},undefined,()=>onDirty());t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;textures.set(url,t);}
  return textures.get(url);
 }
 const standeeMaps=new Map();
 function standee(id,parent){
  const item=cutouts.get(id),g=group(parent),h=products[id]?.stage?.h||2.6,width=h*item.ratio;
  if(!standeeMaps.has(id)){const m=new THREE.Texture(item.image);m.needsUpdate=true;m.colorSpace=THREE.SRGBColorSpace;m.anisotropy=renderer.capabilities.getMaxAnisotropy();standeeMaps.set(id,m);}
  const map=standeeMaps.get(id);
  const mat=new THREE.MeshStandardMaterial({map,roughness:1,side:THREE.DoubleSide,transparent:false,alphaTest:.35});
  const photo=mesh(new THREE.PlaneGeometry(width,h),mat,g,0,h/2,.004);
  photo.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map,alphaTest:.35,side:THREE.DoubleSide});
  photo.userData.cutout=id;photo.receiveShadow=false;
  return {g,point:new THREE.Vector3(0,.05,.2),oben:new THREE.Vector3(0,h+.12,0)};
 }
 function makeStage(id,pieces){
  const data={...displays[id],pieces:pieces||displays[id].pieces},stage={root:group(book),hinges:[],plinths:[],products:[],id};stage.root.visible=false;
  if(data.layout==='fan'){
   const fluegel=data.pieces.length===3?[[-2.3,-.55,-.28,'#d9781f',3.0],[-.75,-1.1,.12,'#1f3d8a',3.1],[1.05,-1.08,-.14,'#8a1d22',2.95],[2.55,-.58,.36,'#f1ede5',2.5]]:[[-2.25,-.50,-.3,'#e5dfd4',2.9],[-.8,-1.05,.15,data.color,3.05],[1.1,-1.04,-.18,'#d4c7b5',2.85],[2.55,-.55,.4,'#f1ede5',2.5]];
   fluegel.forEach(([x,z,yaw,color,h],i)=>{
    const wing=hinge(stage,x,z,yaw,1,i*.035);
    polygon(wing,[[-.7,0],[-.7,h*.91],[.63,h],[.8,0]],color);
    if(i===2)line(wing,[[-.6,.02,.03],[-.45,2.45,.03],[.63,h,.03]],'#c0af98',.004);
   });
  }else{
   const back=hinge(stage,.1,-1.15,0,1,0);
   box(back,4.3,2.98,.024,data.color,0,1.49,0);
   if(data.architecture!=='frame')for(let i=0;i<24;i++){const strip=box(back,.09,2.97,.026,i%2?data.color:'#853e43',-2.08+i*.18,1.49,.035);if(data.color!=='#722d33')strip.material=material(i%2?data.color:'#c4b8a6');strip.rotation.y=Math.sin(i*.8)*.3;}
   const frame=hinge(stage,0,-.70,0,1,.03);
   for(const x of [-2.35,2.35])box(frame,.1,3.25,.065,'#29292b',x,1.625,0);
   box(frame,4.8,.1,.065,'#29292b',0,3.25,0);
   const arch=new THREE.Shape();arch.moveTo(-2.2,0);arch.lineTo(-2.2,3.1);arch.lineTo(2.2,3.1);arch.lineTo(2.2,0);arch.lineTo(1.72,0);arch.lineTo(1.72,1.8);arch.absarc(0,1.8,1.72,0,PI,false);arch.lineTo(-1.72,0);arch.closePath();
   if(data.architecture!=='frame')mesh(new THREE.ExtrudeGeometry(arch,{depth:.025,bevelEnabled:false}),material('#ece5d9'),frame,0,0,.04);
   const side=hinge(stage,2.88,.04,.43,1,.08);polygon(side,[[-.4,0],[-.4,2.4],[.6,2.1],[.6,0]],'#f3efe6');
  }
  data.pieces.forEach((id,i)=>{
   const n=data.pieces.length,x=n===1?.2:n===3?[-1.95,.15,2.05][i]:[-1.15,1.2][i],z=n===1?.53:n===3?[.6,.3,.62][i]:[.35,.65][i],h=products[id]?.stage?.lift??.17;
   addPlinth(stage,x,z,1.8,h,1.03);
   const pivot=hinge(stage,x,z,n===3?[.16,0,-.16][i]:i===1?-.13:.09,-1,.11+i*.055);
   const piece=standee(id,pivot);piece.g.position.y=h;
   piece.g.traverse(o=>{if(o.isMesh)o.userData.product=id;});
   stage.products.push({id,object:piece.g,point:piece.point,oben:piece.oben});
  });
  stage.materials=[];stage.fade=-1;
  stage.root.traverse(o=>{if(o.isMesh){o.material=o.material.clone();stage.materials.push(o.material);}});
  cache.set(id+style+(pieces||[]).join(),stage);return stage;
 }
 function display(id,pieces){
  const schluessel=id+style+(pieces||[]).join();
  if(currentId===schluessel)return;
  if(currentStage)currentStage.root.visible=false;
  currentStage=cache.get(schluessel)||makeStage(id,pieces);currentStage.root.visible=true;currentId=schluessel;letzteSignatur='';
 }
 let letzteSignatur='';
 function render(pose,{angle=0,manualFold=1,interactive=false,search=false,paging=false}={}){
  const {lay,open,fold,read}=pose,mobile=innerWidth<760;
  book.scale.set((mobile?.9:1)+read*.13,1,1);
  book.rotation.set((1-lay)*PI/2+read*1.53,(-.15+angle)*lay*(1-read),read*.006);
  book.position.set(-2.075*(1-lay),-.08+read*.20,0);
  leftPage.rotation.z=-PI*(1-open);rightPage.rotation.z=0;
  // Beim DOM-Blättern bleibt das 3D-Blatt unsichtbar — das Papier liegt bereits als Fläche im Lesebild.
  leaf.visible=!paging&&pose.leaf>0&&pose.leaf<1;leaf.rotation.z=pose.leaf*PI;
  if(currentStage){const q=fold*manualFold;currentStage.root.visible=read<.85&&open>.96&&lay>.95&&q>.004;foldStage(currentStage,q);}
  for(const p of printPlanes)p.visible=read<.5;
  shadow.visible=read<.75;
  const flat=mobile?[2.4,5.5,13.1]:[3.72,4.15,11.6],front=mobile?[0,2.0,20]:[0,.65,13.4];
  camera.position.set(...flat.map((a,i)=>a+(front[i]-a)*read));
  const chrome=Math.min(search?200:112,Math.max(search?150:92,innerHeight*(search?.27:.15))),availableH=Math.min(innerHeight-chrome,innerWidth*.99/1.82),frontFov=2*Math.atan(5.32*innerHeight/(2*13.4*Math.max(availableH,180)))*180/PI;
  const flatFov=Math.max(31,2*Math.atan(.376*innerHeight/(innerWidth*.78))*180/PI);
  camera.fov=mobile?39+27*lay-28*read:flatFov+(frontFov-flatFov)*read;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  camera.lookAt(mobile?0:-1.22*(1-read),mobile?1.85*(1-read):.5*(1-read)+(search?.40:.1)*read,0);camera.updateMatrixWorld(true);
  spread.style.opacity=(interactive&&read>.98)||paging?'1':'0';spread.inert=!(interactive&&read>.98);spread.setAttribute('aria-hidden',String(spread.inert));
  readerLayer.style.pointerEvents=interactive&&read>.98?'auto':'none';
  cssObject.visible=read>.5||paging;
  // Steht das Buch still (z. B. während des Blätterns zwischen zwei Leseseiten), wird WebGL nicht neu gezeichnet.
  const signatur=[lay,open,fold,read,leaf.visible?pose.leaf.toFixed(3):0,angle,manualFold,innerWidth,innerHeight,currentId,currentStage?currentStage.fade:0,search?1:0].join('|');
  if(signatur!==letzteSignatur){letzteSignatur=signatur;light.shadow.needsUpdate=true;renderer.render(scene,camera);}
  cssRenderer.render(scene,camera);
 }
 return {
  display,render,spread,canvas:renderer.domElement,
  updateHouse(slug,p){letzteSignatur='';for(const [id,d] of Object.entries(displays)){if(d.house!==slug)continue;d.color=p.accent;d.architecture=p.architecture;d.layout=p.architecture==='fan'?'fan':'frame';for(const [k,old] of [...cache]){if(!k.startsWith(id+style))continue;book.remove(old.root);old.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.material&&!standeeMaps.has(o.userData.cutout))o.material.dispose();}});cache.delete(k);if(currentStage===old)currentStage=null;}currentId='';}},
  resize(){renderer.setSize(innerWidth,innerHeight);cssRenderer.setSize(innerWidth,innerHeight);letzteSignatur='';},
  paperStyle(next){style=next;currentId='';letzteSignatur='';display(currentStage.id);onDirty();},
  setContent(html,theme){letzteSignatur='';spread.innerHTML=html;const vars=theme||{paper:'#f9f7f2',ink:'#252421',accent:'#733039',font:'Playfair'};for(const m of paperMats)m.color.set(vars.paper);for(const [k,v]of Object.entries(vars))spread.style.setProperty('--house-'+k,v);spread.dataset.theme=vars.theme||'';},
  hotspots(oben=false){return(currentStage?.products||[]).map(p=>{p.object.localToWorld(temp.copy(oben?p.oben:p.point));temp.project(camera);return{id:p.id,x:(temp.x*.5+.5)*innerWidth,y:(-temp.y*.5+.5)*innerHeight};});},
  hit(x,y){pointer.set(x/innerWidth*2-1,-y/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(currentStage?.root.children||[],true).find(hit=>hit.object.userData.cutout&&hit.uv&&alphaHit(hit.object.userData.cutout,hit.uv.x,hit.uv.y))?.object.userData.product;}
 };
}
