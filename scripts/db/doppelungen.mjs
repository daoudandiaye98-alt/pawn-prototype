#!/usr/bin/env node
/**
 * Legt die Kette etwas ZWEIMAL an? Dann bricht sie dort.
 *
 * DER BELEGTE FEHLER: am 11.09.2026 brach das Abspielen gegen die echte Datenbank bei
 * 20260729052933 mit `42P07: relation "staging_requests" already exists`. Das war keine
 * Ausnahme, sondern eine Form: der Lovable-Agent hatte mehrere Repo-Dateien in EINER
 * Migration gebündelt angewandt, und dieselben Dateien liegen zusätzlich einzeln im
 * Ordner, zwei davon mit späterem Datum. Fünf Stellen, nicht eine — gefunden, indem
 * einmal ALLE gesucht wurden statt eine nach der anderen anzulaufen.
 *
 * WIE SIE PRÜFT: nicht an den Dateien, sondern an dem, was nach Anwendung der Deckung
 * (scripts/db/deckung.json) WIRKLICH an die Datenbank geht. Genau dort darf kein Objekt
 * zweimal angelegt werden. Damit prüft sie die Deckung mit, statt sie zu glauben: wer
 * die falsche Fassung deckt, wird hier rot.
 *
 * UND SIE PRÜFT DAS ZWEITE, WAS SCHIEFGEHEN KANN: dass nichts VERLOREN geht. Jede
 * Anweisung, die eine Deckung wegnimmt, muss in einer der unter `gedeckt_von` genannten
 * Dateien stehen — Zeichen für Zeichen, leerzeichen-normiert. Das ist nicht theoretisch:
 * drei der gebündelten Migrationen tragen GRANTs, die den späteren Einzeldateien fehlen.
 * Wer die falsche Fassung deckt, verliert Rechte still. Diese Prüfung fängt genau das.
 *
 * WAS SIE NICHT PRÜFT: ob die Begründung in deckung.json stimmt. Das ist eine
 * Leseaufgabe, keine Rechenaufgabe.
 *
 * Letzte Zeile maschinenlesbar:
 *   DOPPELUNGEN: <gedeckt>/<gesamt> · FEHLER: <kurzliste>
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DECKUNG, WURZEL, version, wirksam, weggenommen, anweisungen } from "./deckung.mjs";

const ORDNER = join(WURZEL, "supabase/migrations");

/**
 * Was eine Migration anlegt. Nur Formen ohne IF NOT EXISTS zählen — alles andere läuft
 * zweimal ohne Schaden. `create index on` (ohne Namen) bleibt absichtlich draußen:
 * Postgres erfindet den Namen, zwei davon stören sich nicht.
 */
const ARTEN = [
  { mu: /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_0-9]+)/gi, art: "TABELLE",
    weg: (n) => new RegExp(`drop\\s+table\\s+if\\s+exists\\s+(?:public\\.)?${n}\\b`, "i") },
  { mu: /create\s+type\s+(?:public\.)?([a-z_0-9]+)/gi, art: "TYP",
    weg: (n) => new RegExp(`drop\\s+type\\s+if\\s+exists\\s+(?:public\\.)?${n}\\b`, "i") },
  { mu: /create\s+policy\s+"([^"]+)"/gi, art: "POLICY",
    weg: (n) => new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+"${n}"`, "i") },
  { mu: /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?(?!on\b)([a-z_0-9]+)/gi, art: "INDEX",
    weg: (n) => new RegExp(`drop\\s+index\\s+if\\s+exists\\s+(?:public\\.)?${n}\\b`, "i") },
  { mu: /create\s+trigger\s+([a-z_0-9]+)/gi, art: "TRIGGER",
    weg: (n) => new RegExp(`drop\\s+trigger\\s+if\\s+exists\\s+${n}\\b`, "i") },
];

const ohneKommentare = (s) =>
  s.split("\n").filter((z) => !z.trimStart().startsWith("--")).join("\n");
const quote = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Welche Datei legt welches Objekt an — über eine beliebige Fassung des Textes. */
function anlagen(textJeDatei) {
  const wo = new Map();
  for (const [datei, sql] of textJeDatei) {
    const rein = ohneKommentare(sql);
    for (const { mu, art, weg } of ARTEN) {
      for (const m of rein.matchAll(mu)) {
        const schluessel = `${art} ${m[1].toLowerCase()}`;
        // Idempotent oder vorher weggenommen: stört nie.
        if (/if\s+not\s+exists/i.test(m[0])) continue;
        if (weg(quote(m[1])).test(rein)) continue;
        if (!wo.has(schluessel)) wo.set(schluessel, []);
        if (!wo.get(schluessel).includes(datei)) wo.get(schluessel).push(datei);
      }
    }
  }
  return wo;
}

const dateien = readdirSync(ORDNER).filter((d) => d.endsWith(".sql")).sort();
const roh = dateien.map((d) => [d, readFileSync(join(ORDNER, d), "utf8")]);
const gedeckt = roh.map(([d, sql]) => [d, wirksam(d, sql)]);

const imOrdner = anlagen(roh);
const anDerDatenbank = anlagen(gedeckt);

const fehler = [];

// 1. Was nach der Deckung noch doppelt ankommt, bricht die Kette.
const bricht = new Map();
for (const [schluessel, wo] of anDerDatenbank) {
  if (wo.length < 2) continue;
  bricht.set(schluessel, wo);
  fehler.push(`${schluessel} aus ${wo.join(" + ")}`);
}

// 2. NICHTS DARF VERLOREN GEHEN. Jede weggenommene Anweisung muss in einer der
//    genannten Dateien stehen. Ohne diese Pruefung waeren am 11.09.2026 drei GRANTs
//    auf public.house_themes still verschwunden — und die veroeffentlichte Hausseite
//    haette ihre eigene Welt nicht mehr lesen koennen.
const nachDatei = new Map(roh);
for (const [v, d] of Object.entries(DECKUNG)) {
  const meine = dateien.find((x) => version(x) === v);
  if (!meine) { fehler.push(`deckung.json deckt ${v}, die Datei gibt es nicht`); continue; }
  const weg = weggenommen(meine, nachDatei.get(meine));
  // 3. Eine Deckung, die nichts wegnimmt, ist eine Karteileiche.
  if (!weg.length) { fehler.push(`${v}: die Deckung nimmt nichts weg`); continue; }
  const woanders = new Set();
  for (const q of d.gedeckt_von) {
    const quelle = dateien.find((x) => version(x) === q);
    if (!quelle) { fehler.push(`${v}: gedeckt_von nennt ${q}, die Datei gibt es nicht`); continue; }
    for (const a of anweisungen(nachDatei.get(quelle))) woanders.add(a);
  }
  const verloren = weg.filter((a) => !woanders.has(a));
  if (verloren.length)
    fehler.push(`${v}: ${verloren.length} Anweisung(en) gehen verloren, z. B. „${verloren[0].slice(0, 70)}"`);
}

for (const [v, d] of Object.entries(DECKUNG).sort()) {
  const meine = dateien.find((x) => version(x) === v);
  const weg = meine ? weggenommen(meine, nachDatei.get(meine)).length : 0;
  console.log(`  ${d.art.padEnd(11)} ${v} · ${String(weg).padStart(3)} Anweisung(en) gedeckt von ${d.gedeckt_von.join(", ")}`);
}
for (const [schluessel, wo] of bricht)
  console.log(`  OFFEN       ${schluessel}: ${wo.join(" + ")}`);

const gedeckteAnzahl = Object.keys(DECKUNG).length;
console.log(`\nDOPPELUNGEN: ${gedeckteAnzahl}/${gedeckteAnzahl + bricht.size} · FEHLER: ${fehler.length ? fehler.join(" · ") : "keine"}`);
process.exit(fehler.length ? 1 : 0);
