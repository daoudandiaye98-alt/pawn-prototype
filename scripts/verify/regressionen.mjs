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
import { execFileSync } from "node:child_process";

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
function keineStripeSpalten({ datei, migration, verboten, huelle }) {
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

  /* UND DER DRITTE ORT, und er war der stille: die Maske muss auch BENUTZT werden.
     Belegt am 12.09.2026 — die Sichten lagen seit dem Erstaufbau auf der Datenbank
     (heft_haeuser, heft_produkte, security_invoker=true, anon hat SELECT), und die
     Huelle stand die ganze Zeit auf `sichten: false`. Die Maske war gebaut, bezahlt
     und wirkungslos. Eine Auswahlliste ohne Stripe-Spalte schuetzt nur, solange
     niemand sie erweitert; die Sicht schuetzt, egal was die Liste sagt. Deshalb wird
     hier geprueft, dass das Heft wirklich durch sie liest. */
  if (huelle) {
    const h = lies(huelle).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    if (!/sichten:\s*true/.test(h))
      return nein(`${huelle}: sichten steht nicht auf true — das Heft liest die Basistabellen, die Sicht laeuft leer mit`);
    const q = lies(datei).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    if (!/designers:heft_haeuser\(/.test(q))
      return nein(`${datei}: der eingebettete Join geht nicht auf heft_haeuser — damit beruehrt das Heft public.designers weiter direkt`);
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

// ————————————————————————————————————————————————————————————————
// Z16 — kein Geheimnis im Klartext in einer Migration
//
// Belegter Fehler: 20260721221200_jarvis_wissen_postfach_dna.sql, Zeile 6, setzt
// ai_config.jarvis_cron_secret mit einem 64-stelligen Wert im Klartext. Wer das Repo
// lesen kann, liest ihn mit — und aus der Git-Geschichte ist er nicht mehr
// herausloeschbar.
//
// DIESE DATEI IST DIE EINE DOKUMENTIERTE AUSNAHME, und zwar mit Absicht: sie zu
// aendern ist mechanisch blockiert (wache.sh) und wuerde nichts nuetzen. Die Zusage
// gilt ab hier nach vorn — KEINE NEUE Migration bringt je wieder ein Geheimnis mit.
// Eine Pruefung, die an unveraenderbarem Altbestand dauerhaft rot steht, lehrt nur,
// Rot zu uebersehen.
// ————————————————————————————————————————————————————————————————
function keinGeheimnisInMigration({ ordner, ausnahmen = [] }) {
  const dateien = readdirSync(join(WURZEL, ordner)).filter((d) => d.endsWith(".sql")).sort();
  // Gesucht wird ein langer Zufallswert in der Naehe eines Geheimnis-Wortes — beides
  // zusammen, nie eines allein: eine uuid in einer Spalte ist kein Geheimnis, und das
  // Wort „key" steht in jeder zweiten Zeile dieses Repos.
  const wort = /secret|token|passwor[dt]|api[_-]?key|private[_-]?key/i;
  // DREI FORMEN. Die dritte ist spaeter dazugekommen, weil die Kontrolle ohne sie ein
  // Loch genau an der wichtigsten Stelle hatte: ein JWT enthaelt PUNKTE, und das
  // Base64-Muster ohne Punkte ging daran vorbei. In einem Supabase-Repo ist der JWT die
  // haeufigste Geheimnisform ueberhaupt. Gefunden am 11.09.2026, beim Lesen von
  // 20260709092523 — dort steht der anon-JWT des alten Projekts im Klartext, und Z16
  // blieb gruen.
  const wert = new RegExp(
    ["['\"][0-9a-f]{32,}['\"]",                                   // Hex-Geheimnis
     "['\"][A-Za-z0-9+/]{40,}={0,2}['\"]",                        // Base64
     "eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}", // JWT
    ].join("|"));
  const funde = [];
  for (const d of dateien) {
    if (ausnahmen.includes(d)) continue;
    const zeilen = lies(join(ordner, d)).split("\n");
    zeilen.forEach((z, i) => {
      if (/^\s*--/.test(z)) return;           // Kommentare erklaeren, sie verraten nicht
      if (wort.test(z) && wert.test(z)) funde.push(`${ordner}/${d}:${i + 1}`);
    });
  }
  if (funde.length) return nein(`Geheimnis im Klartext: ${funde.slice(0, 3).join(" · ")}`);
  return OK;
}

/**
 * Z20 (M4) — keine Tabelle ohne RLS, und keine RLS-Tabelle ohne Policy ausser den benannten.
 *
 * WARUM BEIDE HAELFTEN zusammen stehen: sie sind die zwei Arten, wie eine Tabelle falsch
 * zugaenglich wird, und sie zeigen in entgegengesetzte Richtungen.
 *
 *   Ohne RLS ist eine Tabelle OFFEN — und zwar seit 20260930140000 erst richtig, denn
 *   jetzt hat `authenticated` auf 77 Tabellen ein ausdrueckliches GRANT. Ein GRANT ohne
 *   RLS heisst: jeder angemeldete Mensch liest alle Zeilen. Vorher haette dasselbe
 *   Versehen weniger geschadet, weil das GRANT fehlte. Die Reparatur macht diese Haelfte
 *   also NOETIGER als sie vorher war.
 *
 *   RLS ohne Policy ist das Gegenteil: die Tabelle ist fuer alle ausser service_role
 *   ZU. Manchmal genau richtig (nur Edge Functions kommen heran), manchmal eine Tabelle,
 *   die niemand benutzen kann und an der jemand lange sucht. Der Unterschied ist eine
 *   Absicht, und Absichten gehoeren aufgeschrieben — genau das verlangt M4.
 *
 * Gemessen am 12.09.2026, Datei-Sicht und Datenbank stimmen ueberein: 80 Tabellen,
 * 80 mit RLS, 77 mit Policy, 3 ohne. Die drei sind unten benannt.
 */
function rlsUndPolicySindVollstaendig({ ordner, ohne_policy_erlaubt = [] }) {
  const alles = readdirSync(join(WURZEL, ordner)).filter((d) => d.endsWith(".sql")).sort()
    .map((d) => lies(join(ordner, d)).split("\n").filter((z) => !z.trimStart().startsWith("--")).join("\n"))
    .join("\n");

  const tab = new Set([...alles.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_0-9]+)/gi)]
    .map((m) => m[1].toLowerCase()));
  const rls = new Set([...alles.matchAll(/alter\s+table\s+public\.([a-z_0-9]+)\s+enable\s+row\s+level\s+security/gi)]
    .map((m) => m[1].toLowerCase()));
  const mitPolicy = new Set([...alles.matchAll(/create\s+policy\s+(?:"[^"]+"|\S+)\s+on\s+(?:table\s+)?public\.([a-z_0-9]+)/gi)]
    .map((m) => m[1].toLowerCase()));

  const ohneRls = [...tab].filter((t) => !rls.has(t)).sort();
  const ohnePolicy = [...tab].filter((t) => rls.has(t) && !mitPolicy.has(t) && !ohne_policy_erlaubt.includes(t)).sort();

  const klagen = [];
  if (ohneRls.length) klagen.push(`${ohneRls.length} Tabelle(n) OHNE RLS — mit dem GRANT fuer authenticated liest dort jeder angemeldete Mensch alles: ${ohneRls.join(", ")}`);
  if (ohnePolicy.length) klagen.push(`${ohnePolicy.length} Tabelle(n) mit RLS aber ohne Policy und ohne Begruendung — entweder Absicht aufschreiben oder Policy nachziehen: ${ohnePolicy.join(", ")}`);
  return klagen.length ? nein(klagen.join(" · ")) : OK;
}

/**
 * Z19 — jede Tabelle hat ihre Rechte ausdruecklich in einer Migration, nicht per Vorgabe.
 *
 * DER BELEGTE FEHLER, und er war mein eigener: der Rueckweg des Erstaufbaus macht
 * `drop schema public cascade; create schema public;`. Ein NEUES Schema traegt keine
 * Vorgabe-Rechte. Supabase hatte am alten `public`
 *     alter default privileges in schema public grant all on tables to anon, authenticated, service_role
 * haengen — deshalb schreiben die meisten Migrationen gar keine GRANTs: sie brauchten keine.
 * Nach dem Rueckweg ist diese Vorgabe weg (gemessen am 12.09.2026: pg_default_acl hat
 * Eintraege fuer storage, auth, graphql, realtime, cron, extensions — fuer public KEINEN).
 *
 * Gemessen war die Folge: von 80 Tabellen durfte `authenticated` nur 63 lesen und
 * `service_role` ebenfalls nur 63. Die Edge Functions arbeiten mit service_role — auf 17
 * Tabellen waeren sie mit einem Berechtigungsfehler abgebrochen. Und eine Policy ohne das
 * zugehoerige GRANT laeuft ins Leere: RLS sagt, WELCHE Zeilen jemand sieht, das GRANT sagt,
 * ob er die Tabelle ueberhaupt anfassen darf. Nachgezogen in 20260930140000.
 *
 * Diese Pruefung haelt den Ordner unabhaengig von jeder Vorgabe: jede Tabelle braucht ein
 * ausdrueckliches GRANT fuer service_role, und jede Tabelle mit einer Policy, die
 * `authenticated` einschliesst, eines fuer authenticated. `anon` ist NICHT Gegenstand —
 * wer oeffentlich lesen darf, ist eine Entscheidung, keine Vollstaendigkeitsfrage.
 */
function tabellenrechteSindAusdruecklich({ ordner, ausnahmen_authenticated = [] }) {
  const alles = readdirSync(join(WURZEL, ordner)).filter((d) => d.endsWith(".sql")).sort()
    .map((d) => lies(join(ordner, d)).split("\n").filter((z) => !z.trimStart().startsWith("--")).join("\n"))
    .join("\n");

  const tabellen = new Set([...alles.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_0-9]+)/gi)]
    .map((m) => m[1].toLowerCase()));

  // Eine Policy ohne `TO` gilt fuer alle Rollen, also auch fuer authenticated.
  const authPolicy = new Set();
  for (const m of alles.matchAll(/create\s+policy\s+"[^"]+"\s+on\s+public\.([a-z_0-9]+)([\s\S]{0,120}?)(?:using|with\s+check)/gi))
    if (!/\bto\s+/i.test(m[2]) || /\bauthenticated\b/i.test(m[2])) authPolicy.add(m[1].toLowerCase());

  const grant = { service_role: new Set(), authenticated: new Set() };
  for (const m of alles.matchAll(/grant\s+([a-z, ]+?)\s+on\s+((?:\s*(?:table\s+)?public\.[a-z_0-9]+\s*,?)+)\s*to\s+([^;]+);/gi)) {
    const liste = [...m[2].matchAll(/public\.([a-z_0-9]+)/gi)].map((x) => x[1].toLowerCase());
    for (const rolle of Object.keys(grant))
      if (new RegExp(`\\b${rolle}\\b`, "i").test(m[3])) for (const t of liste) grant[rolle].add(t);
  }

  const ohneService = [...tabellen].filter((t) => !grant.service_role.has(t)).sort();
  const ohneAuth = [...authPolicy].filter((t) => tabellen.has(t)
    && !grant.authenticated.has(t) && !ausnahmen_authenticated.includes(t)).sort();

  const klagen = [];
  if (ohneService.length) klagen.push(`${ohneService.length} Tabelle(n) ohne service_role-GRANT (die Edge Functions brechen dort ab): ${ohneService.join(", ")}`);
  if (ohneAuth.length) klagen.push(`${ohneAuth.length} Tabelle(n) mit authenticated-Policy, aber ohne GRANT (die Policy laeuft ins Leere): ${ohneAuth.join(", ")}`);
  return klagen.length ? nein(klagen.join(" · ")) : OK;
}

/**
 * Z18 — jede SECURITY-DEFINER-Funktion entscheidet ihre Rechte ausdruecklich.
 *
 * PostgreSQL vergibt EXECUTE auf eine neue Funktion per VORGABE an PUBLIC. Wer eine
 * SECURITY-DEFINER-Funktion anlegt und nur `GRANT ... TO service_role` schreibt, hat
 * damit nichts eingeschraenkt: PUBLIC behaelt sein Recht, und `anon` erbt es.
 *
 * BELEGT am 12.09.2026, nach dem vollstaendigen Abspielen der Kette:
 * `assign_invoice_number(uuid, uuid)` war fuer `anon` aufrufbar. Sie ist SECURITY
 * DEFINER und sie SCHREIBT — zaehlt designer_billing_profiles.invoice_next_number hoch
 * und stempelt die Nummer auf eine Bestellung. Ihre eigene Datei vergibt EXECUTE
 * ausdruecklich nur an service_role. Wer den oeffentlichen Schluessel hat, konnte
 * Rechnungsnummern verbrennen; ein Rechnungsnummernkreis muss lueckenlos sein.
 * Dasselbe bei next_invoice_number. Zugezogen in 20260930130000.
 *
 * ENG GEHALTEN: Trigger-Funktionen (returns trigger) zaehlen nicht — PostgREST stellt
 * sie nicht bereit, und die Trigger rufen sie im DEFINER-Zusammenhang ohne EXECUTE.
 * Ein ausdrueckliches `GRANT ... TO anon` gilt als Entscheidung, nicht als Verstoss:
 * eine oeffentliche Funktion ist erlaubt, eine versehentlich oeffentliche nicht.
 */
function secdefEntscheidetRechte({ ordner, ausnahmen = [] }) {
  const alles = readdirSync(join(WURZEL, ordner)).filter((d) => d.endsWith(".sql")).sort()
    .map((d) => lies(join(ordner, d)).split("\n").filter((z) => !z.trimStart().startsWith("--")).join("\n"))
    .join("\n");

  const secdef = new Map();
  const re = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_0-9]+)\s*\(([\s\S]*?)\)\s*returns\s+([a-z_0-9 ]+)([\s\S]{0,400}?)\bas\s*\$/gi;
  for (const m of alles.matchAll(re)) {
    const [, name, , rueck, kopf] = m;
    if (!/security\s+definer/i.test(kopf)) continue;
    if (/^\s*trigger\b/i.test(rueck)) continue;
    if (!secdef.has(name)) secdef.set(name, true);
  }

  const entschieden = new Set();
  for (const m of alles.matchAll(/revoke\s+(?:all|execute)[\s\S]{0,80}?on\s+function\s+public\.([a-z_0-9]+)/gi))
    entschieden.add(m[1]);
  for (const m of alles.matchAll(/grant\s+execute\s+on\s+function\s+public\.([a-z_0-9]+)\s*\([^)]*\)\s*to\s+([^;]+);/gi))
    if (/\banon\b/i.test(m[2])) entschieden.add(m[1]);

  const offen = [...secdef.keys()].filter((n) => !entschieden.has(n) && !ausnahmen.includes(n));
  if (offen.length)
    return nein(`${offen.length} SECURITY-DEFINER-Funktion(en) ohne Rechte-Entscheidung, PUBLIC behaelt EXECUTE: ${offen.join(", ")}`);
  return OK;
}

/**
 * Z17 — die Kette ist spielbar. Die Umsetzung liegt in scripts/db/doppelungen.mjs,
 * weil sie dort auch von Hand aufgerufen wird, wenn jemand mitten im Lauf steht.
 * Hier steht nur der Aufruf: eine Umsetzung, zwei Tueren, keine Kopie.
 */
function jedeDoppelungIstGedeckt() {
  try {
    execFileSync("node", [join(WURZEL, "scripts/db/doppelungen.mjs")],
      { cwd: WURZEL, encoding: "utf8", stdio: "pipe" });
    return OK;
  } catch (e) {
    const letzte = String(e.stdout || "").trim().split("\n").pop() || e.message;
    return nein(letzte);
  }
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
  keinGeheimnisInMigration,
  jedeDoppelungIstGedeckt,
  secdefEntscheidetRechte,
  tabellenrechteSindAusdruecklich,
  rlsUndPolicySindVollstaendig,
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
