#!/usr/bin/env node
/**
 * Findet Anlagen, die in ZWEI Migrationen stehen — und damit die Kette brechen.
 *
 * DER BELEGTE FEHLER: am 11.09.2026 brach das Abspielen der Kette gegen die echte
 * Datenbank bei 20260729052933 mit `42P07: relation "staging_requests" already
 * exists`. Der Grund war keine Ausnahme, sondern eine Form: der Lovable-Agent hatte
 * mehrere Repo-Dateien in EINER Migration gebündelt angewandt, und dieselben Dateien
 * liegen zusätzlich einzeln im Ordner, zwei davon mit späterem Datum. Fünf Stellen
 * in der Kette, nicht eine. Gefunden wurden sie, indem einmal ALLE gesucht wurden
 * statt eine nach der anderen anzulaufen.
 *
 * WAS SIE PRÜFT: jede Doppelung muss in scripts/db/deckung.json stehen. Eine neue,
 * unbekannte Doppelung macht diese Prüfung rot — und damit `verify.sh` rot, bevor
 * jemand Stunden in einen Lauf steckt, der auf halbem Weg bricht.
 *
 * WAS SIE NICHT PRÜFT: ob die Deckung inhaltlich richtig ist. Das steht als Begründung
 * je Version in deckung.json und ist eine Leseaufgabe, keine Rechenaufgabe.
 *
 * Letzte Zeile maschinenlesbar:
 *   DOPPELUNGEN: <gedeckt>/<gesamt> · FEHLER: <kurzliste>
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORDNER = join(WURZEL, "supabase/migrations");

/**
 * Was eine Migration anlegt. Nur Formen ohne IF NOT EXISTS zählen — alles andere
 * läuft zweimal ohne Schaden. `create index on` (ohne Namen) bleibt absichtlich
 * draußen: Postgres erfindet den Namen, zwei davon stören sich nicht.
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
const version = (datei) => datei.slice(0, datei.indexOf("_"));
const quote = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const dateien = readdirSync(ORDNER).filter((d) => d.endsWith(".sql")).sort();
const wo = new Map();           // "ART name" -> [{datei, idempotent, nimmtVorherWeg}]
for (const d of dateien) {
  const sql = ohneKommentare(readFileSync(join(ORDNER, d), "utf8"));
  for (const { mu, art, weg } of ARTEN) {
    for (const m of sql.matchAll(mu)) {
      const schluessel = `${art} ${m[1].toLowerCase()}`;
      if (!wo.has(schluessel)) wo.set(schluessel, []);
      wo.get(schluessel).push({
        datei: d,
        idempotent: /if\s+not\s+exists/i.test(m[0]),
        nimmtVorherWeg: weg(quote(m[1])).test(sql),
      });
    }
  }
}

// Eine Doppelung bricht nur, wenn das zweite Vorkommen weder IF NOT EXISTS nutzt
// noch das Objekt vorher wegnimmt.
const brueche = new Map();      // datei -> {gedecktVon, sachen[]}
for (const [schluessel, vork] of wo) {
  if (vork.length < 2) continue;
  for (const v of vork.slice(1)) {
    if (v.idempotent || v.nimmtVorherWeg) continue;
    if (!brueche.has(v.datei)) brueche.set(v.datei, { erste: vork[0].datei, sachen: [] });
    brueche.get(v.datei).sachen.push(schluessel);
  }
}

const deckung = JSON.parse(readFileSync(join(WURZEL, "scripts/db/deckung.json"), "utf8")).versionen;
const fehler = [];
const gedeckt = [];
for (const [datei, { erste, sachen }] of [...brueche].sort()) {
  const d = deckung[version(datei)];
  if (!d) {
    fehler.push(`${datei} (${sachen.length}× schon in ${erste})`);
    continue;
  }
  gedeckt.push(datei);
  if (!d.gedeckt_von.includes(version(erste)))
    fehler.push(`${datei}: deckung.json nennt ${d.gedeckt_von.join("/")}, die Doppelung kommt aber aus ${version(erste)}`);
}

// Eine Deckung ohne Doppelung ist eine Karteileiche — sie würde eine Datei stumm
// schalten, die gar nichts doppelt. Das ist schlimmer als keine Deckung.
const gedeckteVersionen = new Set([...brueche.keys()].map(version));
for (const v of Object.keys(deckung))
  if (!gedeckteVersionen.has(v)) fehler.push(`deckung.json deckt ${v}, dort ist aber keine Doppelung`);

for (const [datei, { erste, sachen }] of [...brueche].sort()) {
  const d = deckung[version(datei)];
  console.log(`  ${d ? "gedeckt " : "OFFEN   "} ${datei}`);
  console.log(`             ${sachen.length}× schon in ${erste}: ${sachen.slice(0, 6).join(", ")}${sachen.length > 6 ? " …" : ""}`);
}

console.log(`\nDOPPELUNGEN: ${gedeckt.length}/${brueche.size} · FEHLER: ${fehler.length ? fehler.join(" · ") : "keine"}`);
process.exit(fehler.length ? 1 : 0);
