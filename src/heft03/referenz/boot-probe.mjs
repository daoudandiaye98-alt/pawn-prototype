// Probe: das Heft mit Zeilen in der Form der echten Datenbank (fixtures/zeilen.mjs) — keine Beispielhäuser.
// So sieht das Heft aus, wenn supabaseQuelle() liefert. Öffnen: probe-echt.html
globalThis.__pawnBoot=true;
const [{startHeft},{heftAusZeilen},{zeilen},{demoQuelle}]=await Promise.all([import('../app.js'),import('../adapters.mjs'),import('../fixtures/zeilen.mjs'),import('../quelle.mjs')]);
const q={...demoQuelle(),art:'probe',
 // Die Fixture-Zeilen tragen Bildadressen der Vorschau ('./assets/…'); im Projekt liegen die
 // Bilder unter /heft/assets/. Genau das tut im Ernstfall media.ts — hier eine Zeile statt eines Dienstes.
 async heft(){return heftAusZeilen(zeilen,{bild:u=>String(u||'').replace(/^\.\/assets\//,'/heft/assets/')});},
 async chat({messages}){await new Promise(r=>setTimeout(r,600));return {reply:'Probe-Antwort auf: „'+messages.at(-1).content+'“ — ein Stück dazu:',treffer:['lind-mantel-01']};},
 async kasse(){return {fehler:'designer_not_ready',fehlt:['Versandkosten','Stripe-Konto'],text:'Dieses Haus kann noch nicht verkaufen.'};},
 async anfrage(){return {ok:false,anmelden:true};}
};
startHeft({quelle:q,assets:'/heft/assets/'}).then(h=>{globalThis.__pawnHeft=h;window.pawnHeft=h;});
