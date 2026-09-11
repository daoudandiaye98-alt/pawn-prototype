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
 * WAS SIE NICHT PRÜFT: ob eine Deckung die RICHTIGE Fassung stumm schaltet. Manche
 * Fassung trägt GRANTs, die der anderen fehlen — das steht als Begründung je Version in
 * deckung.json und ist eine Leseaufgabe, keine Rechenaufgabe.
 *
 * Letzte Zeile maschinenlesbar:
 *   DOPPELUNGEN: <gedeckt>/<gesamt> · FEHLER: <kurzliste>
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DECKUNG, WURZEL, version, wirksam } from "./deckung.mjs";

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
  const zeile = `${schluessel} aus ${wo.join(" + ")}`;
  bricht.set(schluessel, wo);
  fehler.push(zeile);
}

// 2. Eine Deckung ohne Doppelung im Ordner ist eine Karteileiche — sie würde eine
//    Datei stumm schalten, die gar nichts doppelt. Schlimmer als keine Deckung.
const doppeltImOrdner = new Map();   // version -> anzahl Objekte
for (const [, wo] of imOrdner) {
  if (wo.length < 2) continue;
  for (const d of wo) doppeltImOrdner.set(version(d), (doppeltImOrdner.get(version(d)) || 0) + 1);
}
for (const v of Object.keys(DECKUNG))
  if (!doppeltImOrdner.has(v)) fehler.push(`deckung.json deckt ${v}, dort ist aber keine Doppelung`);

// 3. Die genannte Quelle muss die Doppelung auch wirklich tragen.
for (const [v, d] of Object.entries(DECKUNG)) {
  const meine = dateien.find((x) => version(x) === v);
  if (!meine) { fehler.push(`deckung.json deckt ${v}, die Datei gibt es nicht`); continue; }
  const partner = new Set();
  for (const [, wo] of imOrdner) if (wo.includes(meine)) for (const x of wo) if (x !== meine) partner.add(version(x));
  const fremd = d.gedeckt_von.filter((q) => !partner.has(q));
  if (fremd.length) fehler.push(`${v}: deckung.json nennt ${fremd.join("/")}, dort doppelt sich nichts`);
}

const paare = [...imOrdner.values()].filter((wo) => wo.length > 1).length;
for (const [v, d] of Object.entries(DECKUNG).sort())
  console.log(`  ${d.art.padEnd(11)} ${v} → gedeckt von ${d.gedeckt_von.join(", ")}`
    + `  (${doppeltImOrdner.get(v) || 0} Objekt(e) doppelt im Ordner)`);
for (const [schluessel, wo] of bricht)
  console.log(`  OFFEN       ${schluessel}: ${wo.join(" + ")}`);

console.log(`\nDOPPELUNGEN: ${paare - bricht.size}/${paare} · FEHLER: ${fehler.length ? fehler.join(" · ") : "keine"}`);
process.exit(fehler.length ? 1 : 0);
