#!/usr/bin/env node
/**
 * Prueft jede Zusage aus .claude/regressionen.json gegen den echten Code.
 *
 * Grundsatz: eine Pruefung, die an rechtmaessigem Code rot wird, lehrt nur,
 * Rot zu uebersehen. Jede Kontrolle hier ist deshalb so eng wie die Zusage,
 * die sie deckt — nicht breiter. Wo eine Zusage bewusste Ausnahmen hat,
 * stehen sie in `params.begruendung` in der JSON, nicht in diesem Code.
 *
 * Endet mit 1, sobald eine Zusage gefallen ist. Letzte Zeile maschinenlesbar.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lies = (p) => readFileSync(join(WURZEL, p), "utf8");

/** Alle Dateien unter einem Ordner, gefiltert nach Endung. */
function dateien(ordner, endungen = [".ts", ".tsx"]) {
  const wurzel = join(WURZEL, ordner);
  if (!existsSync(wurzel)) return [];
  const raus = [];
  const geh = (d) => {
    for (const e of readdirSync(d)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) geh(p);
      else if (endungen.some((x) => e.endsWith(x))) raus.push(p);
    }
  };
  geh(wurzel);
  return raus;
}

/** Ein Ergebnis: { ok, grund } — `grund` nur bei ok === false noetig. */
const OK = { ok: true };
const nein = (grund) => ({ ok: false, grund });

// ————————————————————————————————————————————————————————————————
// Z1 — jeder Menuepunkt erreichbar
//
// Nimmt die deklarierten Routen aus App.tsx und haelt jedes feste
// Navigationsziel dagegen. Der Auffangweg "*" zaehlt NICHT als Treffer —
// er ist genau der Fehler, den diese Zusage verhindert.
// ————————————————————————————————————————————————————————————————
function wege({ routen, navigation }) {
  const app = lies(routen);
  const muster = [...app.matchAll(/<Route\s+[^>]*path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== "*");
  if (muster.length === 0) return nein(`keine einzige Route in ${routen} gefunden — die Pruefung selbst ist kaputt`);

  const regexe = muster.map((p) => {
    const roh = p
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:[A-Za-z0-9_]+/g, "[^/]+")
      .replace(/\*/g, ".*");
    return new RegExp(`^${roh}/?$`);
  });
  const erreichbar = (ziel) => regexe.some((r) => r.test(ziel));

  const tot = [];
  for (const datei of navigation) {
    if (!existsSync(join(WURZEL, datei))) return nein(`Navigationsdatei fehlt: ${datei}`);
    const text = lies(datei);
    const zeilen = text.split("\n");
    zeilen.forEach((zeile, i) => {
      for (const m of zeile.matchAll(/\b(?:to|href)="(\/[^"{}$]*)"/g)) {
        const ziel = m[1].split("?")[0].split("#")[0];
        if (ziel === "" || erreichbar(ziel)) continue;
        tot.push(`${datei}:${i + 1} → ${ziel}`);
      }
    });
  }
  return tot.length === 0 ? OK : nein(`Navigationsziele ohne Route (landen auf der 404):\n      ${tot.join("\n      ")}`);
}

// ————————————————————————————————————————————————————————————————
// Z2 — kein Plan mit schwarzem Platzhalter
//
// Drei Bedingungen, alle drei noetig:
//   a) es gibt eine Rueckfall-Karte PLAN_BILD mit allen drei Plaenen,
//   b) die Beispielflaeche greift im letzten Zweig auf PLAN_BILD zu,
//   c) die drei Bilddateien existieren wirklich.
// Faellt eine weg, kann wieder ein schwarzes Loch entstehen.
// ————————————————————————————————————————————————————————————————
function planPlatzhalter({ datei, plaene, bilder }) {
  const text = lies(datei);
  const karte = text.match(/const PLAN_BILD[^=]*=\s*\{([^}]*)\}/);
  if (!karte) return nein(`${datei}: keine Rueckfall-Karte PLAN_BILD mehr vorhanden`);
  const fehlend = plaene.filter((p) => !new RegExp(`\\b${p}\\s*:`).test(karte[1]));
  if (fehlend.length) return nein(`${datei}: PLAN_BILD kennt ${fehlend.join(", ")} nicht — dieser Plan faellt ins Schwarze`);

  if (!/PLAN_BILD\[\s*plan\s*\]/.test(text))
    return nein(`${datei}: die Beispielflaeche greift nicht mehr auf PLAN_BILD[plan] zurueck`);

  const weg = bilder.filter((b) => !existsSync(join(WURZEL, b)));
  if (weg.length) return nein(`Rueckfall-Bilder fehlen auf der Platte: ${weg.join(", ")}`);
  return OK;
}

// ————————————————————————————————————————————————————————————————
// Z3 — Sprachschluessel
//
// Zwei Kontrollen. Die Schluesselmengen muessen sich decken, UND die
// Typ-Fessel `Record<keyof typeof de, string>` muss stehen bleiben.
// Ohne die Fessel stirbt die Garantie still, sobald jemand sie loescht —
// und tsc wuerde nie wieder etwas dazu sagen.
// ————————————————————————————————————————————————————————————————
function sprachschluessel({ datei, fessel }) {
  const text = lies(datei);
  if (!text.includes(fessel))
    return nein(`${datei}: die Typ-Fessel „${fessel}“ ist weg — ohne sie prueft niemand mehr die Gleichheit`);

  const schnitt = (start) => {
    const i = text.indexOf(start);
    if (i < 0) return null;
    let tiefe = 0, j = text.indexOf("{", i);
    if (j < 0) return null;
    for (let k = j; k < text.length; k++) {
      if (text[k] === "{") tiefe++;
      else if (text[k] === "}") { tiefe--; if (tiefe === 0) return text.slice(j, k); }
    }
    return null;
  };
  const de = schnitt("const de = {");
  const en = schnitt(fessel);
  if (!de || !en) return nein(`${datei}: die Woerterbuecher de/en lassen sich nicht mehr abgrenzen`);

  const schluessel = (s) => new Set([...s.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1]));
  const kDe = schluessel(de), kEn = schluessel(en);
  const nurDe = [...kDe].filter((k) => !kEn.has(k));
  const nurEn = [...kEn].filter((k) => !kDe.has(k));
  if (nurDe.length || nurEn.length) {
    const teile = [];
    if (nurDe.length) teile.push(`ohne Englisch (${nurDe.length}): ${nurDe.slice(0, 8).join(", ")}`);
    if (nurEn.length) teile.push(`ohne Deutsch (${nurEn.length}): ${nurEn.slice(0, 8).join(", ")}`);
    return nein(teile.join(" · "));
  }
  if (kDe.size < 100) return nein(`nur ${kDe.size} Schluessel gefunden — die Pruefung selbst greift daneben`);
  return OK;
}

// ————————————————————————————————————————————————————————————————
// Z4 — keine ablaufenden Adressen fuer designer-media
//
// Gesucht wird jede Stelle, die den Eimer `designer-media` anfasst und in
// unmittelbarer Naehe eine signierte Adresse erzeugt. Andere Eimer sind
// bewusst ausgenommen (siehe params.begruendung).
// ————————————————————————————————————————————————————————————————
function keineAblaufendenAdressen({ eimer, orte }) {
  const treffer = [];
  for (const ort of orte) {
    for (const pfad of dateien(ort)) {
      const text = readFileSync(pfad, "utf8");
      const rel = pfad.slice(WURZEL.length + 1);
      const re = new RegExp(`from\\(\\s*["'\`]${eimer}["'\`]\\s*\\)`, "g");
      for (const m of text.matchAll(re)) {
        const fenster = text.slice(m.index, m.index + 300);
        if (/createSignedUrl/.test(fenster)) {
          const zeile = text.slice(0, m.index).split("\n").length;
          treffer.push(`${rel}:${zeile}`);
        }
      }
    }
  }
  return treffer.length === 0
    ? OK
    : nein(`signierte (= ablaufende) Adressen auf „${eimer}“:\n      ${treffer.join("\n      ")}`);
}

// ————————————————————————————————————————————————————————————————
// Z5 — das Werk behaelt sein Verhaeltnis
//
// Der Rahmen des Werks traegt die Marker werk-rein / werk-raus. Jede
// className mit einem dieser Marker muss object-contain fuehren und darf
// object-cover nicht fuehren. Kacheln und Kopfbilder anderswo duerfen
// weiterhin beschneiden — das ist Absicht.
// ————————————————————————————————————————————————————————————————
// ————————————————————————————————————————————————————————————————
// Z5 — kein Werk wird beschnitten
//
// Frueher eine Klassenpruefung an ProductDetail.tsx. Die Seite ist mit Teil H ins
// Heft gezogen; der Rahmen des Werks steht jetzt als CSS-Regel. Eng gehalten: nur
// die Regeln, die genau diese Wahl treffen — object-fit anderswo geht die Zusage
// nichts an.
// ————————————————————————————————————————————————————————————————
function werkNichtBeschnittenCss({ datei, wahl, verlangt, verboten }) {
  const text = lies(datei).replace(/\s+/g, "");
  const nadel = wahl.replace(/\s+/g, "");
  const regeln = [];
  let i = text.indexOf(nadel);
  while (i !== -1) {
    const auf = text.indexOf("{", i);
    const zu = text.indexOf("}", auf);
    if (auf === -1 || zu === -1) break;
    regeln.push(text.slice(auf + 1, zu));
    i = text.indexOf(nadel, zu);
  }
  if (regeln.length === 0) return nein(`${datei}: keine Regel fuer „${wahl}“ mehr — die Zusage haengt in der Luft`);

  const schlecht = regeln.filter((r) => !r.includes(verlangt.replace(/\s+/g, "")) || r.includes(verboten.replace(/\s+/g, "")));
  return schlecht.length === 0
    ? OK
    : nein(`der Rahmen des Werks beschneidet — ${schlecht.length} Regel(n) ohne ${verlangt}: ${schlecht[0].slice(0, 90)}`);
}

// ————————————————————————————————————————————————————————————————
// Z6 — der Preisfilter blendet nichts aus, was niemand ausgeblendet hat
//
// Im Heft ist der Filter ein Formularfeld, kein Regler: „Preis bis" startet leer
// und faellt damit auf die volle Spanne zurueck. Ein fester Vorgabewert waere
// genau der alte Fehler in neuer Form.
// ————————————————————————————————————————————————————————————————
function preisfilterOffen({ datei, feld }) {
  const text = lies(datei);
  const treffer = text.match(new RegExp(`<label>[^<]*<input name="${feld}"[^>]*>`));
  if (!treffer) return nein(`${datei}: das Feld „${feld}“ ist nicht mehr auffindbar — die Zusage haengt in der Luft`);
  const wert = treffer[0].match(/value='\+?([^+>]*)/);
  if (!/route\.max\|\|''/.test(treffer[0]))
    return nein(`${datei}: „${feld}“ startet nicht mehr leer, sondern: ${(wert && wert[1]) || treffer[0].slice(0, 100)}`);
  return OK;
}

// ————————————————————————————————————————————————————————————————
// Z7 — was in die Tasche gelegt wird, ist auch darin zu sehen
//
// Diese Zusage laesst sich nicht am Quelltext ablesen: der belegte Fehler war eine
// Zeile, die im Korb lag und beim Anzeigen still herausfiel. Sie wird deshalb
// LAUFEND geprueft (src/heft03/tasche.test.mjs, Teil von `npm run test:heft`).
// Diese Kontrolle stellt nur sicher, dass es diese Pruefung noch gibt und dass sie
// auf die Tasche zeigt — eine geloeschte Pruefung ist eine gebrochene Zusage.
// ————————————————————————————————————————————————————————————————
function taschePruefungLaeuft({ test, datei }) {
  if (!existsSync(join(WURZEL, test))) return nein(`${test} fehlt — die Zusage wird nicht mehr geprueft`);
  const t = lies(test);
  if (!/cartView/.test(t)) return nein(`${test} prueft die Tasche (cartView) nicht mehr`);
  if (!/checkoutLines/.test(t)) return nein(`${test} prueft den Betrag der Kasse nicht mehr`);
  const skripte = JSON.parse(lies("package.json")).scripts || {};
  if (!/test:heft/.test(lies("scripts/verify/verify.sh")) || !skripte["test:heft"])
    return nein("npm run test:heft laeuft nicht mehr in verify.sh — die Pruefung waere da, aber niemand fuehrt sie aus");
  if (!/products\[r\.id\]/.test(lies(datei)))
    return nein(`${datei}: cartView schlaegt das Stueck nicht mehr in der Liste des Hefts nach`);
  return OK;
}

// ————————————————————————————————————————————————————————————————
// Z8 — das Heft startet genau einmal
//
// Der Prototyp bringt eine Selbststart-Sicherung mit. Im Projekt startet die
// Huelle; beides zusammen ergaebe ZWEI Hefte — das zweite mit Beispielhaeusern,
// also mit erfundenen Marken auf einer Seite mit echten Zahlungen. Die Sicherung
// darf nicht zurueckkommen, und die Huelle muss die Fahne setzen.
// ————————————————————————————————————————————————————————————————
function heftStartetEinmal({ modul, huelle }) {
  const app = lies(modul);
  // Nur echte Aufrufe zaehlen, kein Wort im Kommentar.
  const zeile = app.split("\n").findIndex((z) => {
    const ohneKommentar = z.replace(/^\s*(\*|\/\/).*$/, "");
    return /__pawnBoot[\s\S]*startHeft\s*\(/.test(ohneKommentar);
  });
  if (zeile !== -1) return nein(`${modul}:${zeile + 1}: startet sich selbst — neben dem Heft der Huelle stuende ein zweites mit Beispieldaten`);
  if (!/startHeft\s*\(/.test(lies(huelle))) return nein(`${huelle}: ruft startHeft() nicht mehr — dann startet gar kein Heft`);
  if (!/__pawnBoot/.test(lies(huelle))) return nein(`${huelle}: setzt __pawnBoot nicht mehr — der zweite Boden gegen ein zweites Heft fehlt`);
  return OK;
}

// ————————————————————————————————————————————————————————————————
// Z9 — kein Link auf eine umgezogene Adresse
//
// Geprueft werden nur Ziele, die WIRKLICH umziehen: die Liste kommt aus
// routen.js › UMZUEGE, nicht aus einer zweiten Aufzaehlung hier. Und nur echte
// Linkziele (to="…", href="…", `/x/${…}`), nicht jedes Vorkommen der
// Zeichenkette — sonst wuerde die Kontrolle an Kommentaren rot und lehrte,
// Rot zu uebersehen.
// ————————————————————————————————————————————————————————————————
function keineUmgezogenenLinks({ orte, ausnahmen = [] }) {
  const umzuege = umzuegeAusRoutenJs();
  if (!umzuege.length) return nein("routen.js fuehrt keine Umzuege mehr — die Zusage haengt in der Luft");

  const treffer = [];
  for (const ort of orte) {
    for (const datei of dateien(ort)) {
      const rel = datei.slice(WURZEL.length + 1);
      if (ausnahmen.some((a) => rel === a || rel.startsWith(a + "/"))) continue;
      const text = readFileSync(datei, "utf8");
      text.split("\n").forEach((zeile, i) => {
        if (/^\s*(\*|\/\/)/.test(zeile)) return;
        for (const u of umzuege) {
          const muster = u.von.includes(":")
            ? new RegExp("[\"'`]" + u.von.replace(/:[^/]+/, "") + "\\$\\{")
            : new RegExp("(to|href)=[\"{]`?" + u.von + "[\"'`]");
          if (muster.test(zeile)) treffer.push(`${rel}:${i + 1} → ${u.von} (zieht nach ${u.nach})`);
        }
      });
    }
  }
  return treffer.length === 0
    ? OK
    : nein(`${treffer.length} Link(s) laufen ueber eine 301 statt direkt:\n      ${treffer.slice(0, 8).join("\n      ")}`);
}

/** Die Umzugstabelle aus routen.js lesen, ohne sie zu importieren (dies ist ein Skript). */
function umzuegeAusRoutenJs() {
  const t = lies("routen.js");
  const block = t.slice(t.indexOf("export const UMZUEGE"));
  return [...block.matchAll(/\{\s*von:\s*"([^"]+)",\s*nach:\s*"([^"]+)"\s*\}/g)].map((m) => ({ von: m[1], nach: m[2] }));
}

// ————————————————————————————————————————————————————————————————
// Z10 — keine Stripe-Spalte im oeffentlichen Heft
//
// Zwei Orte, eine Zusage: die Auswahlliste, mit der das Heft heute liest, und
// die Sicht, die anon spaeter bekommt. Beide duerfen die Spalte nicht kennen.
// ————————————————————————————————————————————————————————————————
function keineStripeSpalten({ datei, migration, verboten }) {
  const quelle = lies(datei);
  const block = quelle.slice(quelle.indexOf("export const SPALTEN"), quelle.indexOf("};", quelle.indexOf("export const SPALTEN")));
  if (!block.includes("designers:")) return nein(`${datei}: die Spaltenmaske SPALTEN ist nicht mehr auffindbar`);
  for (const wort of verboten) {
    if (block.includes(wort)) return nein(`${datei}: SPALTEN enthaelt „${wort}“ — anon laese damit eine Spalte, die ihn nichts angeht`);
  }
  if (!existsSync(join(WURZEL, migration))) return nein(`${migration} fehlt — die Sicht, die die Luecke schliesst, ist weg`);
  /* Ohne Kommentare: die Migration ERKLAERT die Luecke ("gibt anon auch stripe_*"), und
     eine Kontrolle, die daran rot wird, lehrt nur, Rot zu uebersehen. Geprueft wird, was
     die Datenbank ausfuehrt. */
  const sicht = lies(migration).replace(/--[^\n]*/g, "");
  for (const wort of verboten) {
    if (wort !== "user_id" && sicht.includes(wort)) return nein(`${migration}: die Sicht listet „${wort}“ — sie waere keine Maske mehr`);
  }
  return OK;
}

/* Z11 — Vorschau nur, wenn die Datenbank wirklich weg ist.
   Die Logik selbst ist in anschluss.test.mjs belegt (drei Faelle, einmal rot
   vorgefuehrt). Ungeprueft war bisher die VERKABELUNG: ob das Anklopfen im
   laufenden Heft ueberhaupt stattfindet. Faellt anklopfAdresse aus der Huelle,
   bleibt jeder Test gruen — und pawn.vision entscheidet wieder nach 6 Sekunden
   Uhrzeit statt nach der Frage, ob jemand antwortet. Genau das wird hier geprueft. */
function vorschauNurWennWeg({ modul, huelle, start }) {
  const m = lies(modul);
  if (!/export\s+async\s+function\s+anklopfen/.test(m)) return nein(`${modul}: anklopfen() ist weg — dann entscheidet wieder allein die Frist`);
  if (!/\/auth\/v1\/health/.test(m)) return nein(`${modul}: es wird nicht mehr an /auth/v1/health angeklopft`);
  if (!/o\.anklopfen\s*\?/.test(m)) return nein(`${modul}: quelleWaehlen liest den Anklopf-Befund nicht mehr`);

  const a = lies(start);
  if (!/anklopfen\(\s*optionen\.anklopfAdresse\s*\)/.test(a)) return nein(`${start}: startHeft klopft nicht mehr an`);
  if (!/quelleWaehlen\([^)]*anklopfen\s*:/.test(a.replace(/\n/g, " "))) return nein(`${start}: der Befund wird nicht an quelleWaehlen weitergereicht`);

  const h = lies(huelle);
  if (!/anklopfAdresse\s*:/.test(h)) return nein(`${huelle}: die Huelle reicht keine Adresse zum Anklopfen durch — das Heft faellt auf die Frist zurueck`);
  return OK;
}

/* Z12 — ein Waechter, nicht zwei.
   Geprueft wird die Adresstabelle selbst: jede Adresse unter /admin, /studio
   oder /portal muss entweder hinter einem RoleGate haengen oder eine reine
   Weiterleitung sein. PortalGate allein zaehlt NICHT — er prueft keine Rolle.
   Genau so ist die Luecke entstanden: drei Adressen hingen nur an ihm.
   Steht eine passende Zeile nicht auf EINER Zeile, wird die Pruefung rot statt
   still gruen — eine Kontrolle, die wegsieht, waere schlimmer als keine. */
function nurEinWaechter({ datei, bereiche, waechter, seiten }) {
  const zeilen = lies(datei).split("\n");
  const treffer = [];
  for (const [i, z] of zeilen.entries()) {
    const m = z.match(/<Route\s+path="([^"]+)"/);
    if (!m) continue;
    const pfad = m[1];
    if (!bereiche.some((b) => pfad === b || pfad.startsWith(b + "/"))) continue;
    if (!z.includes("/>")) return nein(`${datei}:${i + 1}: die Route ${pfad} steht ueber mehrere Zeilen — diese Kontrolle kann sie nicht lesen und rate nicht`);
    treffer.push({ nr: i + 1, pfad, zeile: z });
  }
  if (!treffer.length) return nein(`${datei}: keine einzige Adresse unter ${bereiche.join(", ")} gefunden — die Tabelle sieht anders aus als gedacht`);
  for (const t of treffer) {
    if (/element=\{<Navigate\b/.test(t.zeile)) continue;
    if (t.zeile.includes(`<${waechter} `)) continue;
    return nein(`${datei}:${t.nr}: ${t.pfad} haengt an keinem ${waechter} — wer angemeldet ist, kommt hier rein, egal als was`);
  }

  /* Und der dritte Waechter, der lange uebersehen wurde: elf Admin-Seiten hatten
     ihren eigenen. `if (!user || !roles.includes("admin")) return <Navigate to="/auth">`
     sagte das GEGENTEIL von RoleGate, der nicht Angemeldete bewusst durchlaesst.
     Eine Seite darf niemanden wegen seiner Rolle wegschicken — das entscheidet
     die Adresstabelle, nicht die Seite. */
  for (const ordner of seiten ?? []) {
    for (const f of dateien(ordner)) {
      // `dateien()` liefert absolute Pfade, `lies()` haengt die Wurzel davor —
      // deshalb hier direkt lesen und fuer die Meldung wieder kuerzen.
      const kurz = f.slice(f.indexOf("src/"));
      for (const [i, z] of readFileSync(f, "utf8").split("\n").entries()) {
        if (z.includes("<Navigate") && z.includes("roles.includes")) {
          return nein(`${kurz}:${i + 1}: die Seite schickt selbst wegen einer Rolle weg — das entscheidet ${waechter} in ${datei}, nicht die Seite`);
        }
      }
    }
  }
  return OK;
}

/* Z13 — eine Adresse, die nur noch weiterleitet, steht nirgends mehr im Code.
   Warum das eine eigene Kontrolle braucht: keineUmgezogenenLinks (Z9) sucht nach
   to=/href=. In src/pages/admin/TranslationWarmup.tsx stand "/auth" aber als
   blosse Zeichenkette in einer Liste — und damit waermte PAWN fuer die englische
   Fassung eine Weiterleitung statt der Zugang-Doppelseite. Kein Link, kein Fund,
   kein Rot. Diese Pruefung sucht die Adresse als GANZE Zeichenkette, egal wo.
   Eng gehalten: nur exakt "/auth" in Anfuehrungszeichen. /auth/v1/health, wie es
   notbetrieb.mjs braucht, trifft sie nicht. */
function nurWegweiser({ orte, adressen, ausnahmen = [] }) {
  const treffer = [];
  for (const ort of orte) {
    for (const datei of dateien(ort, [".ts", ".tsx", ".js", ".mjs"])) {
      const rel = datei.slice(WURZEL.length + 1);
      if (ausnahmen.some((a) => rel === a)) continue;
      readFileSync(datei, "utf8").split("\n").forEach((zeile, i) => {
        if (/^\s*(\*|\/\/)/.test(zeile)) return;
        for (const a of adressen) {
          if (new RegExp("[\"'`]" + a + "[\"'`]").test(zeile)) treffer.push(`${rel}:${i + 1} → ${a}`);
        }
      });
    }
  }
  return treffer.length === 0
    ? OK
    : nein(`${treffer.length} Stelle(n) nennen eine Adresse, die nur noch weiterleitet:\n      ${treffer.slice(0, 8).join("\n      ")}`);
}

// ————————————————————————————————————————————————————————————————
// Z14 — keine Doppelseite stuerzt ab, weil die Welt leer ist
//
// Belegter Fehler (F3, von Daouda auf der laufenden Seite gefunden): auf der
// Haeuser-Doppelseite eine Welt anwaehlen — und nichts ging mehr, kein Blaettern,
// keine Rueckkehr. Die Ursache war eine einzige Zeile in views.mjs, die
// haeuserDerWelt[0].name las, OHNE zu fragen, ob es ein Haus gibt. Auf der neuen,
// noch leeren Datenbank gibt es keines.
//
// Wie Z7: das laesst sich nicht am Quelltext ablesen, nur am Lauf. Die laufende
// Pruefung steht in anschluss.test.mjs und rendert JEDE Doppelseite JEDER Sektion
// mit leeren Daten. Diese Kontrolle stellt sicher, dass es sie noch gibt und dass
// sie ausgefuehrt wird — eine geloeschte Pruefung ist eine gebrochene Zusage.
// ————————————————————————————————————————————————————————————————
function leereWeltStuerztNicht({ test, datei }) {
  if (!existsSync(join(WURZEL, test))) return nein(`${test} fehlt — die Zusage wird nicht mehr geprueft`);
  const t = lies(test);
  if (!/leeren?\s+Daten|null\s+Haeusern/i.test(t))
    return nein(`${test} rendert die Doppelseiten nicht mehr mit leeren Daten`);
  if (!/Object\.entries\(SEKTIONEN\)/.test(t))
    return nein(`${test} geht nicht mehr ueber ALLE Sektionen — ein Einzelfall ist keine Zusage`);
  const skripte = JSON.parse(lies("package.json")).scripts || {};
  if (!/test:heft/.test(lies("scripts/verify/verify.sh")) || !skripte["test:heft"])
    return nein("npm run test:heft laeuft nicht mehr in verify.sh — die Pruefung waere da, aber niemand fuehrt sie aus");
  // Und die Stelle selbst. Gesucht wird der WAECHTER, nicht das Fehlen des Zugriffs:
  // die erste Fassung dieser Kontrolle schloss jede Zeile mit einem Fragezeichen aus
  // und liess damit genau den belegten Fehler durch. Einmal rot vorgefuehrt, daran
  // aufgefallen, und deshalb steht es jetzt so: haeuserDerWelt[0] muss als Frage
  // dastehen, bevor irgendwer seinen Namen liest.
  const v = lies(datei);
  if (!/haeuserDerWelt\[0\]\s*\r?\n?\s*\?/.test(v))
    return nein(`${datei}: es wird nicht mehr gefragt, OB es ein Haus gibt, bevor haeuserDerWelt[0] gelesen wird`);
  return OK;
}

// ————————————————————————————————————————————————————————————————
// Z15 — das Geruest des Hefts wird erst sichtbar, wenn seine Gestaltung da ist
//
// Belegter Fehler (F1, von Daouda auf der laufenden Seite gesehen und in einer
// Aufnahme gehabt): kurz vor dem Umschlag stand links das nackte Geruest —
// Wortmarke, Menue, „Tasche 0", Hero-Text, alles linksbuendig und ohne Gestaltung.
// Die Huelle haengt ihre Stylesheets zur Laufzeit ein; zwischen „DOM ist da" und
// „CSS ist da" zeichnet der Browser ungestaltet.
//
// Die Kontrolle prueft die DREI Teile, ohne die die Reparatur nicht haelt — das
// Verstecken, das Aufheben, und die Obergrenze. Ohne Obergrenze waere eine nie
// ladende Datei ein dauerhaft unsichtbares Heft; das waere schlimmer als das
// Aufblitzen. Die Obergrenze wird IM Warter gesucht, nicht irgendwo in der Datei:
// die erste Fassung liess ein beliebiges setTimeout gelten und blieb deshalb gruen,
// als die Grenze weg war. Einmal rot vorgefuehrt, daran aufgefallen.
// ————————————————————————————————————————————————————————————————
function geruestErstNachGestaltung({ huelle, warter = "blattGeladen" }) {
  const h = lies(huelle);
  if (!/visibility:\s*["']hidden["']/.test(h))
    return nein(`${huelle}: das Geruest startet nicht mehr versteckt — es blitzt wieder ungestaltet auf`);
  if (!/visibility\s*=\s*["']{2}/.test(h))
    return nein(`${huelle}: nichts hebt das Versteck wieder auf — das Heft blieb unsichtbar`);
  if (!new RegExp(`${warter}\\(`).test(h))
    return nein(`${huelle}: das Aufheben haengt nicht mehr am Laden der Stylesheets (${warter} fehlt)`);
  // Nur der Rumpf des Warters, von seiner Deklaration bis zur naechsten auf
  // Spaltenposition 0 — so zaehlt kein fremdes setTimeout der Datei mit.
  const ab = h.indexOf(`function ${warter}`);
  if (ab < 0) return nein(`${huelle}: ${warter} ist keine eigene Funktion mehr — die Obergrenze ist nicht mehr pruefbar`);
  const rest = h.slice(ab + 1);
  const bis = rest.search(/\n(?:function|const|export|class)\s/);
  const rumpf = bis < 0 ? rest : rest.slice(0, bis);
  if (!/frist\s*=\s*\d+/.test(rumpf))
    return nein(`${huelle}: ${warter} hat keine Obergrenze in Millisekunden mehr — laedt ein Stylesheet nie, bleibt das Heft fuer immer unsichtbar`);
  if (!/setTimeout/.test(rumpf))
    return nein(`${huelle}: ${warter} setzt keine Uhr mehr — die Obergrenze stuende da, ohne je zu greifen`);
  return OK;
}

/**
 * Z16 — die Zustimmungsfrage haengt nicht am Regelwerk des Begleiters.
 *
 * Der Begleiter darf aus fuenf guten Gruenden schweigen: Mindestabstand, aufgebrauchtes
 * Blasenbudget, ein frueheres ×, Stummschaltung, fehlender Platzhalter. Ginge die
 * Zustimmungsfrage durch melde(), wuerde jeder dieser Gruende bedeuten: gemerkt wird,
 * ohne zu fragen. Die Pruefung ist deshalb eng — sie deckt genau diese Zusage:
 * zustimmungFragen() schreibt selbst in die Blase und ruft nie melde()/melden().
 */
function zustimmungOhneRegelwerk({ heft }) {
  const h = lies(heft);
  const ab = h.indexOf("function zustimmungFragen");
  if (ab < 0) return nein(`${heft}: zustimmungFragen() gibt es nicht mehr — wer fragt jetzt nach der Zustimmung?`);
  const rest = h.slice(ab + 1);
  const bis = rest.search(/\n(?:function|const|let|export|class)\s/);
  const rumpf = bis < 0 ? rest : rest.slice(0, bis);
  if (!/state\.consent\s*!==\s*null/.test(rumpf))
    return nein(`${heft}: zustimmungFragen() prueft nicht mehr auf consent === null — die Frage kaeme wieder und wieder oder gar nicht`);
  if (/\bmelde[n]?\s*\(/.test(rumpf))
    return nein(`${heft}: zustimmungFragen() geht durch das Regelwerk — dann kann Schweigen bedeuten: gemerkt ohne zu fragen`);
  if (!/data-consent-ja/.test(rumpf) || !/data-consent-nein/.test(rumpf))
    return nein(`${heft}: die Zustimmungsfrage hat nicht mehr beide Antworten`);
  // Und die andere Haelfte der Zusage: solange die Frage steht, schweigt der Begleiter.
  const stumm = h.slice(h.indexOf("function istStumm"), h.indexOf("function begleiterZustand"));
  if (!/data-consent-ja/.test(stumm))
    return nein(`${heft}: istStumm() achtet nicht mehr auf die offene Zustimmungsfrage — der Bauer redet dazwischen`);
  return OK;
}

/**
 * Z17 — ein Riegel, den niemand bedient, ist kein Riegel.
 *
 * quelle.mjs fragt vor jedem Schreiben nach begleiter_ereignisse
 * `funktionen.darfZaehlen?.()`. Uebergibt die Huelle diese Funktion nicht, ist
 * `!undefined?.()` immer wahr — und es wird NIE gezaehlt, ganz gleich ob jemand
 * angemeldet ist oder zugestimmt hat. Genau so lag es da, bis der Pruefer es fand.
 *
 * Eng gehalten: geprueft wird nur, dass die Frage gestellt wird, dass die Huelle sie
 * beantwortet und dass die Antwort an der Zustimmung haengt — nicht, wie das im
 * Einzelnen geschrieben ist.
 */
function zaehlenNurMitErlaubnis({ quelle, huelle }) {
  const q = lies(quelle);
  if (!/funktionen\.darfZaehlen\?\.\(\)/.test(q))
    return nein(`${quelle}: vor dem Zaehlen wird nicht mehr nach der Erlaubnis gefragt`);
  const h = lies(huelle);
  if (!/darfZaehlen\s*:/.test(h))
    return nein(`${huelle}: reicht kein darfZaehlen an die Quelle — die Frage bliebe unbeantwortet und es wuerde NIE gezaehlt`);
  if (!/consent\?\.analytics|consent\.analytics/.test(h))
    return nein(`${huelle}: die Zaehl-Erlaubnis haengt nicht mehr an der Zustimmung (consent.analytics)`);
  return OK;
}

// ————————————————————————————————————————————————————————————————
// Z18 — kein Mantel an der Wand
//
// Die Verzweigung in passformAssistent fragte zuerst nach sizes.length, dann
// nach interior — und fiel SONST in den Kunst-Zweig. Ein Mode-Stueck ohne
// Groessentabelle (size_variants: []) landete damit in der Kunst-Formulierung:
// „Wool Coat", Welt MODE, 480 EUR, darunter „ob die Arbeit an deine Wand passt".
// Gesehen auf der Aufnahme des Pruefstand-Laufs 177.
//
// Die Pruefung ist eng: sie verlangt genau, dass mode VOR dem Auffang-else
// abgefangen wird und dass in diesem Zweig kein Wand-Satz steht.
// ————————————————————————————————————————————————————————————————
function modeNieAnDieWand({ views }) {
  const v = lies(views);
  const ab = v.indexOf("export function passformAssistent");
  if (ab < 0) return nein(`${views}: passformAssistent() gibt es nicht mehr — wer beantwortet jetzt die Passform?`);
  const rest = v.slice(ab);
  const bis = rest.indexOf("\nexport function");
  const rumpf = bis < 0 ? rest : rest.slice(0, bis);

  const iMode = rumpf.indexOf("p.world==='mode'");
  if (iMode < 0)
    return nein(`${views}: passformAssistent() kennt keinen eigenen Mode-Zweig mehr — ein Mantel ohne Groessentabelle faellt wieder in die Kunst-Formulierung`);

  // Der Auffang-Zweig (Kunst) ist das letzte `}else{` im Rumpf. Mode muss davor stehen.
  const iSonst = rumpf.lastIndexOf("}else{");
  if (iSonst < 0) return nein(`${views}: der Auffang-Zweig der Passform ist weg — die Pruefung selbst ist kaputt`);
  if (iMode > iSonst)
    return nein(`${views}: der Mode-Zweig steht HINTER dem Auffang-Zweig und wird nie erreicht`);

  /*
   * Die ganze Kette, nicht nur der neue Zweig. Beim Einsetzen des Mode-Zweigs am
   * 12.09.2026 ist mir die interior-Zeile verlorengegangen — Interior lief danach in
   * den Kunst-Zweig, also derselbe Fehler eine Welt weiter. Durchgerutscht sind dabei:
   * node --test 81/81, npm test 353/353, tsc 0 und VERIFY 5/5. Kein Werkzeug hat es
   * gemeldet, weil passformAssistent nirgends geprueft wird. Deshalb deckt diese
   * Zusage die Reihenfolge der drei Welten, nicht bloss den einen Satz.
   */
  const iInterior = rumpf.indexOf("p.world==='interior'");
  if (iInterior < 0)
    return nein(`${views}: der Interior-Zweig ist weg — Raumstuecke fallen in die Kunst-Formulierung`);
  if (!(iMode < iInterior && iInterior < iSonst))
    return nein(`${views}: die Reihenfolge der Passform-Zweige stimmt nicht mehr (mode -> interior -> Auffang)`);

  // Und der ausgegebene Text des Mode-Zweigs darf die Wand nicht erwaehnen.
  // OHNE die Kommentare: der Zweig traegt die Herkunftsnotiz aus #195, und die
  // zitiert den falschen Satz absichtlich. Eine Pruefung, die daran rot wird,
  // lehrt Rot zu uebersehen.
  const nachMode = rumpf.slice(iMode, iSonst)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  if (/[Ww]and/.test(nachMode))
    return nein(`${views}: im Mode-Zweig steht wieder ein Wand-Satz — ein Mantel haengt nicht an der Wand`);
  return OK;
}

// ————————————————————————————————————————————————————————————————
// Z19 — der Ueberspringen-Knopf liegt nie unter der Bildunterschrift
//
// Kontrolle 3.8 des Pruefstands, gemessen bei 844x390 (Telefon quer) im
// Eroeffnungszustand: #intro-caption 156-285, #skip 246-280. Der Knopf lag
// VOLLSTAENDIG im Band der Schrift, Anteil 1,000 bei erlaubten 0,25.
//
// Ursache: beide hingen an der Hoehe und keiner an der anderen — die Schrift auf
// top:42%, der Knopf auf bottom:110px. Quer ist die Ansicht nur 390 hoch, dann
// treffen sie sich. Die Loesung haengt den Knopf an die Schrift.
//
// Die Pruefung deckt genau das: in der Querformat-Abfrage bekommt #skip ein
// `top` UND ausdruecklich `bottom:auto`. Faellt eines von beiden weg, sitzt der
// Knopf wieder am unteren Rand und wandert der Schrift entgegen.
// ————————————————————————————————————————————————————————————————
function ueberspringenNichtUnterDerSchrift({ stil }) {
  const css = lies(stil);
  const ab = css.indexOf("@media(orientation:landscape) and (max-height:540px){");
  if (ab < 0)
    return nein(`${stil}: die Querformat-Abfrage (max-height:540px) gibt es nicht mehr — dort haengt die Reparatur von 3.8`);
  const rest = css.slice(ab);
  const bis = rest.indexOf("\n}");
  const block = bis < 0 ? rest : rest.slice(0, bis);

  const regel = block.match(/#skip\{([^}]*)\}/);
  if (!regel)
    return nein(`${stil}: die Querformat-Abfrage setzt #skip nicht mehr — der Knopf sitzt wieder am unteren Rand, unter der Bildunterschrift`);
  if (!/\btop:/.test(regel[1]))
    return nein(`${stil}: #skip haengt quer nicht mehr an einem top — ohne das wandert er der Schrift entgegen`);
  if (!/\bbottom:\s*auto/.test(regel[1]))
    return nein(`${stil}: #skip behaelt quer sein bottom — top und bottom zugleich, das ergibt wieder die Ueberschneidung`);
  return OK;
}


// ————————————————————————————————————————————————————————————————
// Z20 — der Menuepunkt „Auftritt" zeigt die Doppelseite
//
// Von Daouda auf der laufenden Seite gefunden: „die bearbeitung der doppelseiten im
// auftritt menuepunkt des designer studios zeigt aktuell noch nicht an". Der Rundgang
// hat DREI Ursachen gefunden, und zwei davon sind hier mechanisch gedeckt.
//
// URSACHE 1 — StudioHeft.tsx holte `studioQuelle` aus quelle.mjs. Den Export gab es
// nicht. Die Seite brach mit `fehlt = "studioQuelle"` ab, bevor das Heft startete.
// Kein Absturz, keine Warnung, keine rote Pruefung: ein leerer weisser Rahmen.
// Genau diese Luecke schliesst der erste Teil — jeder Name, den die Huelle aus einem
// Heft-Modul zieht, muss dort wirklich stehen.
//
// URSACHE 2 — dort stand ein LEERES div. app.js sucht feste Knoten per
// getElementById (#mobile-reader, #drawer-content, #hotspots …) und fand keinen.
// Dazu KASTEN_STIL (contain:paint): ohne ihn spannt sich die Buehne ueber das
// Fenster statt ueber den Kasten und deckt die Seite zu. Gemessen in Chromium,
// Kasten 390x520: ohne Einsperrung ist #stage 1440x900, mit ihr 386x516.
//
// (Ursache 3, die fehlenden i18n-Schluessel, deckt der zweite Teil.)
//
// ENG GEHALTEN: geprueft werden nur die Namen, die StudioHeft.tsx TATSAECHLICH in der
// Form `modul.name` liest, und nur die Schluessel, die sie mit t("studio.heft…")
// benutzt. Die Pruefung waechst mit der Datei mit und erfindet nichts dazu.
function auftrittZeigtDieSeite({ huelle, quelle, app, sprachen }) {
  // OHNE die Kommentare — und das ist nicht Feinschliff, es ist der Unterschied
  // zwischen Pruefung und Schein. Die erste Fassung dieser Kontrolle blieb GRUEN, als
  // ich KASTEN_STIL aus dem Code entfernte: der Name stand noch im Kommentar darueber,
  // und das Muster hatte die Prosa getroffen. Derselbe Fehler wie bei Z18, wo die
  // Herkunftsnotiz aus #195 das Wort „Wand" trug. Wer Kommentare mitliest, prueft nichts.
  const src = lies(huelle)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
  const fehlt = [];

  // 1 · Jeder Name, den die Huelle aus einem Heft-Modul zieht, steht dort auch.
  for (const [datei, kuerzel] of [[quelle, "quelleModul"], [app, "appModul"]]) {
    const modul = lies(datei);
    const gesucht = new Set(
      [...src.matchAll(new RegExp(kuerzel + "\\.([a-zA-Z_$][\\w$]*)", "g"))].map((m) => m[1]),
    );
    for (const name of gesucht) {
      if (!new RegExp("export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+" + name + "\\b").test(modul)
        && !new RegExp("export\\s*\\{[^}]*\\b" + name + "\\b[^}]*\\}").test(modul)) {
        fehlt.push(`${huelle} erwartet ${name} aus ${datei} — dort gibt es das nicht`);
      }
    }
  }

  // 2 · Jeder studio.heft-Schluessel, den sie benutzt, steht in ALLEN Sprachen.
  const woerter = lies(sprachen);
  const schluessel = new Set([...src.matchAll(/t\(\s*"(studio\.heft\.[\w.]+)"/g)].map((m) => m[1]));
  for (const k of schluessel) {
    // t() faellt auf den Schluessel selbst zurueck — ein fehlender Schluessel steht
    // woertlich auf dem Bildschirm, statt einen Fehler zu werfen. Darum die Wache.
    const treffer = (woerter.match(new RegExp('"' + k.replace(/\./g, "\\.") + '"\\s*:', "g")) || []).length;
    if (treffer < 2) fehlt.push(`Sprachschluessel ${k} fehlt (${treffer} von 2 Woerterbuechern) — er stuende woertlich auf dem Bildschirm`);
  }

  // 3 · Das Geruest und die Einsperrung. Ohne beides ist die Flaeche wieder leer.
  if (!/\bGERUEST\b/.test(src)) fehlt.push(`${huelle} setzt das Geruest nicht mehr ein — app.js faende keinen seiner Knoten`);
  if (!/\bKASTEN_STIL\b/.test(src)) fehlt.push(`${huelle} sperrt die Buehne nicht mehr ein — sie spannt sich dann ueber das Fenster statt ueber den Kasten`);

  return fehlt.length === 0 ? OK : nein(fehlt.slice(0, 6).join("\n      "));
}

// Z21 — die Anprobe ist angeschlossen, nicht angekuendigt
//
// Von Daouda auf der laufenden Seite gefunden: „Die Dna sektion muss noch
// ueberarbeitet werden … die steht mir das sektion als erstes, und zwar wie
// beauftragt inspiriert von trymira.style."
//
// Was dahinter lag, war NICHT fehlendes Backend. Die Function `anprobe` ist
// ausgeliefert (gemessen ueber 401-statt-404) und kann sechs Aktionen. Das Heft
// rief keine einzige: app.js beantwortete die Chips `anprobe`, `raum` und `wand`
// mit dem Satz „Das kommt gleich — die Werkstatt dafuer wird gerade angeschlossen."
// Ein Platzhalter ist keine leere Stelle, die auffaellt — er ist eine Stelle, die
// AUSSIEHT wie Arbeit. Nichts wurde je rot.
//
// ENG GEHALTEN, drei Saetze, mehr nicht:
//   1 · Jede Methode, die das Heft auf `quelle.anprobe` ruft, gibt es in ALLEN DREI
//       Quellen (echt, Vorschau, Studio) — app.js ruft sie ohne `?.`, eine fehlende
//       waere ein harter Absturz mitten auf der Seite.
//   2 · Der Platzhaltersatz steht nicht mehr in der Chip-Behandlung.
//   3 · `anprobe_fertig` hat einen Absender. Es steht in STARKE_EREIGNISSE und war
//       das einzige Ereignis des Katalogs ohne einen.
function anprobeIstAngeschlossen({ quelle, app }) {
  const ohneProsa = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const q = ohneProsa(lies(quelle));
  const a = ohneProsa(lies(app));
  const fehlt = [];

  // 1 · Was app.js und die Seiten auf quelle.anprobe rufen, muss es dreimal geben.
  const seiten = ohneProsa(lies("src/heft03/extra-views.mjs"));
  const gerufen = new Set(
    [...(a + seiten).matchAll(/quelle\.anprobe\.([a-zA-Z_$][\w$]*)/g)].map((m) => m[1]),
  );
  // Die drei Quellen als Abschnitte: ab „anprobe:{" bis zur naechsten Zeile, die
  // wieder auf Quellenebene beginnt. Gezaehlt wird je Abschnitt, nicht in der Datei —
  // sonst genuegte EINE Quelle, und die Vorschau stuerzte trotzdem ab.
  const abschnitte = [...q.matchAll(/anprobe:\s*\{/g)].map((m) => {
    let tiefe = 0, i = m.index + m[0].length - 1;
    for (; i < q.length; i++) {
      if (q[i] === "{") tiefe++;
      else if (q[i] === "}" && --tiefe === 0) break;
    }
    return q.slice(m.index, i + 1);
  });
  if (abschnitte.length < 3) {
    fehlt.push(`nur ${abschnitte.length} von 3 Quellen haben einen anprobe-Block (echt, Vorschau, Studio)`);
  }
  for (const name of gerufen) {
    const ohne = abschnitte.filter((b) => !new RegExp("\\b" + name + "\\s*[:(]").test(b)).length;
    if (ohne) fehlt.push(`quelle.anprobe.${name} wird gerufen, fehlt aber in ${ohne} der ${abschnitte.length} Quellen — app.js ruft ohne ?.`);
  }

  // 2 · Kein Platzhalter mehr fuer die drei Chips.
  if (/die Werkstatt daf/.test(a) && /f\s*===?\s*'anprobe'/.test(a) === false) {
    fehlt.push("app.js beantwortet die Anprobe-Chips wieder mit dem Platzhaltersatz");
  }

  // 3 · Das Ereignis hat einen Absender.
  if (!/melden\('anprobe_fertig'/.test(a)) {
    fehlt.push("anprobe_fertig wird nirgends gemeldet — jede Begleiter-Regel darauf waere unerreichbar");
  }

  return fehlt.length === 0 ? OK : nein(fehlt.slice(0, 6).join("\n      "));
}

const PRUEFUNGEN = {
  wege,
  planPlatzhalter,
  sprachschluessel,
  keineAblaufendenAdressen,
  werkNichtBeschnittenCss,
  preisfilterOffen,
  taschePruefungLaeuft,
  heftStartetEinmal,
  keineUmgezogenenLinks,
  keineStripeSpalten,
  vorschauNurWennWeg,
  nurEinWaechter,
  nurWegweiser,
  leereWeltStuerztNicht,
  geruestErstNachGestaltung,
  zustimmungOhneRegelwerk,
  zaehlenNurMitErlaubnis,
  modeNieAnDieWand,
  ueberspringenNichtUnterDerSchrift,
  auftrittZeigtDieSeite,
  anprobeIstAngeschlossen,
};

const { zusagen } = JSON.parse(lies(".claude/regressionen.json"));
let bestanden = 0;
const gefallen = [];

for (const z of zusagen) {
  const fn = PRUEFUNGEN[z.pruefung];
  let ergebnis;
  if (!fn) ergebnis = nein(`keine Kontrolle namens „${z.pruefung}“ — die Zusage ist eine Karteileiche`);
  else {
    try { ergebnis = fn(z.params ?? {}); }
    catch (e) { ergebnis = nein(`Kontrolle abgestuerzt: ${e.message}`); }
  }
  if (ergebnis.ok) { bestanden++; console.log(`  ✓ ${z.id} · ${z.zusage}`); }
  else {
    gefallen.push(z.id);
    console.log(`  ✗ ${z.id} · ${z.zusage}`);
    console.log(`      ${ergebnis.grund}`);
    console.log(`      Beleg: ${z.beleg}`);
  }
}

console.log(`REGRESSION: ${bestanden}/${zusagen.length} · FEHLER: ${gefallen.join(",") || "keine"}`);
process.exit(gefallen.length ? 1 : 0);
