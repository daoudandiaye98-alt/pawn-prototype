/**
 * Augen für das Heft: die Probe mit Zeilen in Datenbankform (fixtures/zeilen.mjs) in einem
 * echten Browser. Nicht Teil des Baus — ein Werkzeug für die Sitzung.
 *
 * WICHTIG: Dieser Container rendert mit 1 Bild/Sekunde (Software-Renderer, kein GPU).
 * Die Eröffnung braucht dadurch ~29 s statt 5,8 s. Die Lesestrecken werden deshalb mit
 * `reducedMotion:'reduce'` aufgenommen — dann setzt das Heft die Doppelseite sofort.
 * Über Bewegungsqualität sagt dieser Lauf NICHTS; das misst nur echte Hardware.
 */
import {chromium} from 'playwright';
const ZIEL=process.env.ZIEL||'/tmp/heft-probe';
const b=await chromium.launch({executablePath:process.env.PRUEFSTAND_CHROMIUM,args:['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox']});
const S='/src/heft03/referenz/probe-echt.html';
const fehler=[];
async function schuss(name,hash,{breite=1440,hoehe=900,ruhig=true,mobil=false}={}){
 const ctx=await b.newContext({viewport:{width:breite,height:hoehe},reducedMotion:ruhig?'reduce':'no-preference',isMobile:mobil,hasTouch:mobil});
 const p=await ctx.newPage();
 p.on('console',m=>{if(m.type()==='error')fehler.push(name+': '+m.text().slice(0,180));});
 p.on('pageerror',e=>fehler.push(name+' PAGEERROR: '+String(e).slice(0,180)));
 await p.goto('http://127.0.0.1:8080'+S+hash,{waitUntil:'load',timeout:60000});
 await p.waitForFunction(()=>document.body.dataset.motion==='ready',{timeout:ruhig?30000:90000}).catch(()=>fehler.push(name+': nicht ready'));
 await p.waitForTimeout(ruhig?1200:2500);
 if(mobil)await p.click('#rotate-skip').catch(()=>{}),await p.waitForTimeout(1200);
 await p.screenshot({path:ZIEL+'/'+name+'.png'});
 const s=await p.evaluate(()=>{const sp=document.querySelector('#reader-layer .spread'),mr=document.getElementById('mobile-reader');
  return {motion:document.body.dataset.motion,
   sicht:sp?getComputedStyle(sp).opacity:(mr&&!mr.hidden?'lesespalte':'buehne'),
   inhalt:((sp||mr)?.textContent||document.getElementById('scene-title')?.textContent||'').replace(/\s+/g,' ').trim().slice(0,58),
   hotspots:document.querySelectorAll('.hotspot').length};});
 console.log(name.padEnd(12),JSON.stringify(s));
 await ctx.close();
}
await schuss('01-hero','',{ruhig:false});
await schuss('02-mode','#/mode/1',{ruhig:false});
await schuss('03-kunst','#/kunst/1',{ruhig:false});
await schuss('04-haus-1','#/haus/haus-lind/1');
await schuss('05-haus-2','#/haus/haus-lind/2');
await schuss('06-haeuser','#/haeuser/1');
await schuss('07-dna-richtung','#/dna/3');
await schuss('08-suche','#/suche/1');
await schuss('09-frag-pawn','#/frag-pawn/1');
await schuss('10-konto','#/konto/1');
await schuss('11-fuer-designer','#/fuer-designer/1');
await schuss('12-vision','#/vision/1');
await schuss('13-390-haeuser','#/haeuser/1',{breite:390,hoehe:844,mobil:true});
await schuss('14-390-haus','#/haus/haus-lind/1',{breite:390,hoehe:844,mobil:true});
await schuss('15-ipad','#/haus/haus-lind/2',{breite:834,hoehe:1112});
await b.close();
console.log('\nKONSOLENFEHLER:',fehler.length);
for(const f of fehler)console.log('  ·',f);
