// Start der Vorschau: Beispieldaten, Hash-Adressen, nichts geht nach außen.
// Im echten Projekt ruft die React-Hülle startHeft() selbst — mit supabaseQuelle() und adresse:'pfad'.
globalThis.__pawnBoot=true;
try{
 const [{startHeft},{demoQuelle}]=await Promise.all([import('./app.js'),import('./quelle.mjs')]);
 const heft=await startHeft({quelle:demoQuelle()});globalThis.__pawnHeft=heft;window.pawnHeft=heft;
}catch(e){console.error(e);const l=document.getElementById('loading');if(l){l.hidden=false;l.textContent='Das Heft konnte nicht geöffnet werden: '+(e&&e.message||e);}}
