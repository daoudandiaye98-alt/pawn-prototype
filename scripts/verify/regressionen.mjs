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
