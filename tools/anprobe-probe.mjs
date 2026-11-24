#!/usr/bin/env node
/**
 * Augen für die Anprobe-Drehbühne — der echte Ablauf im Heft, mit einer GESTELLTEN Function.
 *
 * Warum es das gibt: Die Drehbühne hängt an einer Function, die hier nicht läuft (fal, Konto,
 * Einwilligung). tools/heft-sicht.mjs zeigt die Seite nur vor dem Hochladen. Diese Probe tauscht
 * `boot-probe.mjs` im Browser gegen eine Fassung, deren `quelle.anprobe` antwortet wie die
 * Function — und klickt dann wie eine Kundin: Bild, Stücke, „Outfit anprobieren", warten,
 * drehen (Antippen, Pfeiltaste, Wischen). Gemessen am 24.11.2026 hat sie gefunden, dass die
 * gestapelte Fassung 245 px über den Seitenrand lief.
 *
 * Voraussetzung wie bei heft-sicht: der Entwicklungsserver läuft.
 *   npx vite --host 127.0.0.1 --port 8080 --strictPort &
 *   PRUEFSTAND_CHROMIUM=$(find /opt/pw-browsers -type f -name chrome | head -1) \
 *     node tools/anprobe-probe.mjs [ruhig|bewegt|mobil] [sechs] [alt|fehlschlag]
 *
 *   ruhig       Desktop, reduzierte Bewegung (schnell; Überblendung statt Drehung)
 *   bewegt      Desktop mit Bewegung (die Eröffnung dauert hier ~30 s) — zeigt den 3D-Ring
 *   mobil       390 px
 *   sechs       sechs Mode-Stücke statt zwei (Raster in zwei Reihen)
 *   alt         die ALTE Function: kein ansichten_status, keine stuecke — eine Ansicht, ehrlicher Titel
 *   fehlschlag  der Rücken scheitert, „noch einmal" holt ihn
 *
 * Aufnahmen unter /tmp/anprobe-probe/<lauf>/ — ANSEHEN, nicht zählen. Letzte Zeile:
 *   ANPROBE-PROBE: <bestanden>/<gesamt> · FEHLER: <kurzliste>
 */
import {chromium} from 'playwright';
import fs from 'node:fs';
const arg=process.argv.slice(2);
const MODUS=['ruhig','bewegt','mobil'].find(m=>arg.includes(m))||'ruhig';
const SECHS=arg.includes('sechs'),ALT=arg.includes('alt'),FEHLSCHLAG=arg.includes('fehlschlag');
const LAUF=[MODUS,SECHS&&'sechs',ALT&&'alt',FEHLSCHLAG&&'fehlschlag'].filter(Boolean).join('-');
const ZIEL=(process.env.ZIEL||'/tmp/anprobe-probe')+'/'+LAUF;fs.mkdirSync(ZIEL,{recursive:true});

// Die gestellte Function. Antwortformen wie supabase/functions/anprobe/index.ts (stand, ansichten).
const BOOT=`
globalThis.__pawnBoot=true;
const [{startHeft},{heftAusZeilen},{zeilen},{demoQuelle}]=await Promise.all([import('../app.js'),import('../adapters.mjs'),import('../fixtures/zeilen.mjs'),import('../quelle.mjs')]);
const basis=zeilen.products.find(p=>p.id==='p-1');
const extra=${SECHS}?[['p-21','Mantel Blau','cutout-mantelblau.webp'],['p-22','Kleid Noir','cutout-noir.webp'],['p-23','Kleid','cutout-dress.webp'],['p-24','Mantel','cutout-coat.webp']]
 .map(([id,name,bild],i)=>({...basis,id,slug:'probe-'+i,name,image_url:'./assets/'+bild})):[];
const z={...zeilen,products:[...zeilen.products,...extra]};
const B='/heft/assets/';let standRufe=0,laeufe=0;globalThis.__freigabe=0;globalThis.__rufe=[];
const anprobe={...demoQuelle().anprobe,
 async bild(d,art){__rufe.push('bild');return {ok:true,bild_id:'b-1',art,name:d?.name||'ich.jpg'};},
 async bereinigen(){__rufe.push('bereinigen');return {ok:true,basis_url:B+'mensch-cape.webp'};},
 async starten(o){__rufe.push('starten');globalThis.__start=o;return {ok:true,anprobe_id:'a-1'};},
 async stand(){__rufe.push('stand');standRufe++;if(standRufe<2)return {ok:true,status:'laeuft'};
  const sig='?sig='+standRufe,vorne=B+'mensch-cape.webp';
  if(${ALT})return {ok:true,status:'fertig',result_url:vorne+sig,fehler:null,dauer_ms:1};
  const an={vorne};let st='offen';
  if(laeufe){const f=globalThis.__freigabe;st='laeuft';
   if(f>=1)an.seite=B+'foto-spiegel.webp';
   if(f>=2){if(${FEHLSCHLAG}&&laeufe===1)st='fehler';else{an.hinten=B+'mensch-trio.webp';st='fertig';}}}
  return {ok:true,status:'fertig',result_url:vorne+sig,ansichten:Object.fromEntries(Object.entries(an).map(([k,v])=>[k,v+sig])),
   ansichten_status:st,stuecke:globalThis.__start?.product_ids||[globalThis.__start?.product_id]};},
 async ansichten(){__rufe.push('ansichten');laeufe++;return {ok:true,status:'laeuft',fehlend:['seite','hinten']};},
 async bewerten(){return {ok:true};}
};
const q={...demoQuelle(),art:'probe',anprobe,
 async heft(){return heftAusZeilen(z,{bild:u=>String(u||'').replace(/^\\.\\/assets\\//,'/heft/assets/')});},
 async chat(){return {reply:'Probe',treffer:[]};},async kasse(){return {fehler:'designer_not_ready'};},async anfrage(){return {ok:false,anmelden:true};}
};
startHeft({quelle:q,assets:'/heft/assets/'}).then(h=>{globalThis.__pawnHeft=h;});
`;

const b=await chromium.launch({executablePath:process.env.PRUEFSTAND_CHROMIUM,args:['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox']});
const mobil=MODUS==='mobil',ruhig=MODUS!=='bewegt';
const ctx=await b.newContext({viewport:mobil?{width:390,height:844}:{width:1440,height:900},reducedMotion:ruhig?'reduce':'no-preference',isMobile:mobil,hasTouch:mobil});
const p=await ctx.newPage();const konsole=[],pruef=[];
const soll=(name,ok,was='')=>{pruef.push({name,ok});console.log((ok?'  ✓ ':'  ✗ ')+name+(was?' — '+was:''));};
p.on('console',m=>{if(m.type()==='error')konsole.push(m.text().slice(0,160));});
p.on('pageerror',e=>konsole.push('PAGEERROR '+String(e).slice(0,160)));
await p.route('**/referenz/boot-probe.mjs',r=>r.fulfill({contentType:'text/javascript',body:BOOT}));
await p.goto('http://127.0.0.1:8080/src/heft03/referenz/probe-echt.html#/dna/2',{waitUntil:'load',timeout:60000});
await p.waitForFunction(()=>document.body.dataset.motion==='ready',{timeout:ruhig?40000:120000}).catch(()=>konsole.push('nicht ready'));
await p.waitForTimeout(ruhig?1500:3000);
if(mobil){await p.click('#rotate-skip').catch(()=>{});await p.waitForTimeout(1500);}
const W=mobil?'#mobile-reader':'#reader-layer .spread';
const L=sel=>p.locator(W+' '+sel);
const schuss=async(name,sel)=>{const ziel=sel?L(sel).first():null;
 if(ziel&&await ziel.count()){await ziel.scrollIntoViewIfNeeded().catch(()=>{});await ziel.screenshot({path:ZIEL+'/'+name+'.png'}).catch(()=>{});}
 else await p.screenshot({path:ZIEL+'/'+name+'.png'});};
const lage=()=>p.evaluate(w=>{const z=document.querySelector(w+' [data-drehbuehne]');if(!z)return null;
 const s=z.closest('.paper-page');
 return {flaechen:[...z.querySelectorAll('.drehflaeche')].map(f=>(f.classList.contains('wartet')?'~':'')+(f.querySelector('img')?.getAttribute('src')||'').replace(/^.*\//,'').replace(/\?.*$/,'')+(f.getAttribute('aria-hidden')==='false'?'*':'')),
  ansichten:[...z.querySelectorAll('[data-anprobe-ansicht]')].map(x=>x.textContent+(x.getAttribute('aria-pressed')==='true'?'*':'')).join('|'),
  titel:z.querySelector('.drehbuehne-titel')?.textContent||'',nochmal:!!z.querySelector('[data-anprobe-ansichten-neu]'),
  hash:location.hash,ueberlauf:s?Math.max(0,s.scrollHeight-s.clientHeight):null};},W);
const ueberlauf=()=>p.evaluate(w=>[...document.querySelectorAll(w+' .paper-page')].map(s=>Math.max(0,s.scrollHeight-s.clientHeight)),W);
const vorn=l=>(l?.flaechen||[]).find(f=>f.endsWith('*'))||'';

console.log('Lauf',LAUF);
soll('Anprobe-Seite steht',/Steht\s*mir das/.test(await p.evaluate(w=>document.querySelector(w)?.textContent||'',W)));
await L('[data-anprobe-datei]').first().setInputFiles('public/heft/assets/foto-spiegel.webp');
await p.waitForTimeout(1200);
const zahl=await L('[data-anprobe-stueck]').count();
soll('Stücke sichtbar',zahl===(SECHS?6:2),String(zahl));
await L('[data-anprobe-stueck]').nth(0).click();await p.waitForTimeout(300);
await L('[data-anprobe-stueck]').nth(1).click();await p.waitForTimeout(500);
soll('Knopf nennt das Outfit',(await L('[data-anprobe-los]').textContent())?.includes('(2)'));
const spiegel=await p.evaluate(w=>{const z=document.querySelector(w+' .drehbuehne.spiegel');return z?{bild:(z.querySelector('.spiegel-bild')?.getAttribute('src')||'').replace(/^.*\//,''),titel:z.querySelector('.drehbuehne-titel')?.textContent||''}:null;},W);
soll('Spiegel zeigt dein Bild und die Wahl',!!spiegel&&/mensch-cape|^blob:|[0-9a-f-]{36}$/.test(spiegel.bild)&&spiegel.titel==='Mantel 01 + Hemd 03',JSON.stringify(spiegel));
soll('Upload-Knopf zeigt die Miniatur',await L('.upload-mini').count()===1);
soll('Gewählte Stücke tragen 1 und 2',JSON.stringify(await L('.stueck-nr').allTextContents())==='["1","2"]');
soll('Spiegel: keine Seite läuft über',(await ueberlauf()).every(x=>x===0),JSON.stringify(await ueberlauf()));
await schuss('a-auswahl',mobil?null:'');
await L('[data-anprobe-los]').click();await p.waitForTimeout(800);
soll('Outfit geht als product_ids',JSON.stringify(await p.evaluate(()=>globalThis.__start?.product_ids))==='["p-1","p-2"]');
soll('PAWN legt an: Spiegel mit Scan',await L('.drehbuehne.spiegel.laeuft .spiegel-scan').count()===1);
if(!ruhig){const t1=await L('.spiegel-scan').first().evaluate(e=>getComputedStyle(e).transform);await p.waitForTimeout(700);
 const t2=await L('.spiegel-scan').first().evaluate(e=>getComputedStyle(e).transform);
 soll('Die Scan-Linie fährt',t1!==t2&&t2!=='none',t1+' → '+t2);}
await schuss('a2-laeuft',mobil?null:'');
await p.waitForFunction(w=>!!document.querySelector(w+' [data-drehbuehne]'),W,{timeout:20000,polling:50}).catch(()=>{});
if(!ruhig){
 if(process.env.LANGSAM)await p.addStyleTag({content:'.drehbuehne.enthuellt .drehbuehne-raum::after{animation-duration:6s!important}'});
 await p.waitForTimeout(process.env.LANGSAM?900:350);await schuss('a3-vorhang','[data-drehbuehne]');
 soll('Der Vorhang hebt sich',await p.evaluate(w=>{const r=document.querySelector(w+' .drehbuehne.enthuellt .drehbuehne-raum');if(!r)return false;const m=getComputedStyle(r,'::after').transform;return m!=='none';},W));}
await p.waitForTimeout(1500);
let l=await lage();
soll('Bühne: keine Seite läuft über',(await ueberlauf()).every(x=>x===0),JSON.stringify(await ueberlauf()));
if(ALT){
 soll('alte Function: eine Ansicht, Titel nur das erste Stück',l?.flaechen.length===1&&l?.titel==='Mantel 01',JSON.stringify(l));
 soll('alte Function: kein ansichten-Ruf',!(await p.evaluate(()=>globalThis.__rufe)).includes('ansichten'));
 await schuss('b-alt','[data-drehbuehne]');
}else{
 soll('Vorne steht, Seite und Rücken warten',JSON.stringify(l?.flaechen)==='["mensch-cape.webp*","~","~"]',JSON.stringify(l?.flaechen));
 soll('Titel aus der Function',l?.titel==='Mantel 01 + Hemd 03',l?.titel);
 await schuss('b-wartet','[data-drehbuehne]');
 await p.evaluate(()=>{globalThis.__freigabe=1;});await p.waitForTimeout(3800);
 await p.evaluate(()=>{globalThis.__freigabe=2;});await p.waitForTimeout(3800);
 l=await lage();
 if(FEHLSCHLAG){
  soll('Rücken gescheitert: zwei Flächen und „noch einmal"',l?.flaechen.length===2&&l?.nochmal,JSON.stringify(l));
  await schuss('c-gescheitert','[data-drehbuehne]');
  await L('[data-anprobe-ansichten-neu]').click();await p.waitForTimeout(4200);
  l=await lage();
 }
 soll('drei Ansichten stehen',l?.flaechen.length===3&&!l?.nochmal,JSON.stringify(l?.flaechen));
 await schuss('d-drei','[data-drehbuehne]');await schuss('d-ganz',mobil?null:'');
 await L('[data-anprobe-ansicht="2"]').click();await p.waitForTimeout(ruhig?300:450);await schuss('e-dreht','[data-drehbuehne]');
 await p.waitForTimeout(1500);l=await lage();
 soll('Antippen „Rücken" dreht den kurzen Weg',vorn(l).startsWith('mensch-trio'),vorn(l));
 await L('[data-drehbuehne]').focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(1600);l=await lage();
 soll('Pfeiltaste dreht die Bühne, nicht das Heft',vorn(l).startsWith('mensch-cape')&&l?.hash==='#/dna/2',vorn(l)+' '+l?.hash);
 await schuss('f-nach-taste','[data-drehbuehne]');
 const r=await L('.drehbuehne-raum').boundingBox();
 await p.mouse.move(r.x+r.width/2+60,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+r.width/2-60,r.y+r.height/2,{steps:6});await p.mouse.up();
 await p.waitForTimeout(1600);l=await lage();
 soll('Wischen dreht',vorn(l).startsWith('foto-spiegel'),vorn(l));
 await L('[data-anprobe-drehen="1"]').click();await p.waitForTimeout(1600);l=await lage();
 soll('Drehknopf im Bild dreht weiter',vorn(l).startsWith('mensch-trio'),vorn(l));
 await L('[data-anprobe-vorher]').click();await p.waitForTimeout(700);
 soll('Vorher blendet dein Bild ein',await p.evaluate(w=>{const z=document.querySelector(w+' [data-drehbuehne]');return !!z&&z.classList.contains('zeigt-vorher')&&getComputedStyle(z.querySelector('.drehbuehne-vorher')).opacity==='1';},W));
 await schuss('g-vorher','[data-drehbuehne]');
 await L('[data-anprobe-vorher]').click();await p.waitForTimeout(700);
 soll('Nachher wieder da',await p.evaluate(w=>!document.querySelector(w+' [data-drehbuehne]').classList.contains('zeigt-vorher'),W));
 if(process.env.LANGSAM){await p.addStyleTag({content:'.drehring{transition-duration:9s!important;transition-timing-function:linear!important}'});
  await L('[data-anprobe-ansicht="0"]').click();for(const t of [1,2,3]){await p.waitForTimeout(1300);await schuss('l-'+t,'[data-drehbuehne]');}}
}
soll('keine Konsolenfehler',!konsole.length,konsole.join(' | '));
await b.close();
const gut=pruef.filter(x=>x.ok).length;
console.log('ANPROBE-PROBE: '+gut+'/'+pruef.length+' · FEHLER: '+(pruef.filter(x=>!x.ok).map(x=>x.name).join(', ')||'keine'));
process.exit(gut===pruef.length?0:1);
