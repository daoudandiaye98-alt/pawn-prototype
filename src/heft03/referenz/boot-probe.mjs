// Probe: das Heft mit Zeilen in der Form der echten Datenbank (fixtures/zeilen.mjs) — keine Beispielhäuser.
// So sieht das Heft aus, wenn supabaseQuelle() liefert. Öffnen: probe-echt.html
globalThis.__pawnBoot=true;
const [{startHeft},{heftAusZeilen},{zeilen},{demoQuelle}]=await Promise.all([import('./app.js'),import('./adapters.mjs'),import('./fixtures/zeilen.mjs'),import('./quelle.mjs')]);
const q={...demoQuelle(),art:'probe',
 async heft(){return heftAusZeilen(zeilen);},
 async chat({messages}){await new Promise(r=>setTimeout(r,600));return {reply:'Probe-Antwort auf: „'+messages.at(-1).content+'“ — ein Stück dazu:',treffer:['lind-mantel-01']};},
 async kasse(){return {fehler:'designer_not_ready',fehlt:['Versandkosten','Stripe-Konto'],text:'Dieses Haus kann noch nicht verkaufen.'};},
 async anfrage(){return {ok:false,anmelden:true};}
};
startHeft({quelle:q}).then(h=>{globalThis.__pawnHeft=h;window.pawnHeft=h;});
