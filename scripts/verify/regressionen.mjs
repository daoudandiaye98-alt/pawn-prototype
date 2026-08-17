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
function werkNichtBeschnitten({ datei, marker, verlangt, verboten }) {
  const text = lies(datei);
  const klassen = [...text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
    .map((m) => ({ wert: m[1] ?? m[2] ?? "", index: m.index }))
    .filter((k) => marker.some((mk) => k.wert.includes(mk)));

  if (klassen.length === 0)
    return nein(`${datei}: kein Rahmen mit ${marker.join("/")} mehr gefunden — die Zusage haengt in der Luft`);

  const schlecht = klassen
    .filter((k) => !k.wert.includes(verlangt) || k.wert.includes(verboten))
    .map((k) => `Zeile ${text.slice(0, k.index).split("\n").length}: „${k.wert.trim().slice(0, 80)}“`);

  return schlecht.length === 0
    ? OK
    : nein(`der Rahmen des Werks beschneidet (${verlangt} fehlt oder ${verboten} steht da):\n      ${schlecht.join("\n      ")}`);
}

// ————————————————————————————————————————————————————————————————
// Z6 — der Preisfilter steht auf der vollen Spanne
//
// Der Anfangszustand muss `null` sein, und `null` muss auf die volle
// Spanne abbilden. Ein Anfangswert wie [0, 50] waere genau der alte Fehler.
// ————————————————————————————————————————————————————————————————
function preisfilterVoll({ datei, zustand }) {
  const text = lies(datei);
  const start = new RegExp(`useState<\\[number,\\s*number\\]\\s*\\|\\s*null>\\(\\s*null\\s*\\)`);
  const deklaration = new RegExp(`\\[${zustand},\\s*set[A-Za-z]*\\]\\s*=\\s*useState[^;]*;`);
  const d = text.match(deklaration);
  if (!d) return nein(`${datei}: der Zustand „${zustand}“ ist nicht mehr auffindbar`);
  if (!start.test(d[0]))
    return nein(`${datei}: „${zustand}“ startet nicht mehr auf null, sondern: ${d[0].trim().slice(0, 120)}`);

  if (!/:\s*\[preisVon,\s*preisBis\]/.test(text))
    return nein(`${datei}: null bildet nicht mehr auf die volle Spanne [preisVon, preisBis] ab`);
  return OK;
}

// ————————————————————————————————————————————————————————————————

const PRUEFUNGEN = {
  wege,
  planPlatzhalter,
  sprachschluessel,
  keineAblaufendenAdressen,
  werkNichtBeschnitten,
  preisfilterVoll,
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
