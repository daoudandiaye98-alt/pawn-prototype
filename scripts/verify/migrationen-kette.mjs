#!/usr/bin/env node
// Ist supabase/migrations/ in Dateinamen-Reihenfolge ueberhaupt abspielbar?
//
// Der Anlass, belegt: beim Erstaufbau auf cnxtdcifkrdxvajaikxq brach der Lauf bei
// 20260721230200_jarvis_akquise_autopilot.sql mit
//   ERROR: 42P01: relation "public.acquisition_leads" does not exist
// ab. Keine einzige Datei im Ordner legt diese Tabelle an — 24 aendern sie.
//
// Die Pruefung liest kein Netz und keine Datenbank. Sie liest nur die Dateien und
// fragt je Aenderung: gab es vorher, in Dateinamen-Reihenfolge, ein CREATE TABLE
// dafuer? Fremde Schemata (storage, auth, cron, net, supabase_migrations) gehoeren
// nicht uns und werden nicht geprueft.
//
// Ausgang: 0 = Kette geschlossen · 1 = Luecke.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Zweites Argument nur fuer den Gegenbeweis: die Pruefung an einem geschlossenen
// Ordner gruen zu zeigen. Ohne Argument der echte Ordner.
const ORDNER = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'supabase/migrations';

// Tabellen im Schema public, die nicht aus diesem Ordner stammen. Heute leer —
// die Zeile bleibt als Ort fuer den Fall, dass es je eine gibt.
const FREMD = new Set([]);

const ohneKommentar = (s) =>
  s.split('\n').map((z) => z.replace(/--.*$/, '')).join('\n');

// Ein Name kann qualifiziert sein: public.x, storage.objects, auth.users.
// NAME faengt Schema und Tabelle getrennt, damit "storage.objects" nicht als
// Tabelle "storage" gelesen wird — genau dieser Fehlalarm war die erste Fassung.
const NAME = String.raw`(?:"?([a-z0-9_]+)"?\s*\.\s*)?"?([a-z0-9_]+)"?`;

const RE_CREATE  = new RegExp(String.raw`\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?` + NAME, 'gi');
// Was eine bestehende Tabelle voraussetzt:
const RE_ALTER   = new RegExp(String.raw`\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?` + NAME, 'gi');
const RE_INDEX   = new RegExp(String.raw`\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?\S+\s+on\s+` + NAME, 'gi');
const RE_TRIGGER = new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?trigger\s+\S+[\s\S]{0,120}?\son\s+` + NAME, 'gi');
const RE_POLICY  = new RegExp(String.raw`\bcreate\s+policy\s+(?:"[^"]+"|\S+)\s+on\s+(?:table\s+)?` + NAME, 'gi');

// Nur was uns gehoert: ohne Schema oder ausdruecklich public. Alles andere
// (storage, auth, cron, net, supabase_migrations, extensions) bringt Supabase mit.
const treffer = (re, text) => {
  const raus = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    const schema = (m[1] || 'public').toLowerCase();
    if (schema !== 'public') continue;
    raus.push(m[2].toLowerCase());
  }
  return raus;
};

const dateien = readdirSync(ORDNER).filter((f) => f.endsWith('.sql')).sort();
const angelegt = new Map(); // tabelle -> datei
const luecken = [];

for (const datei of dateien) {
  const text = ohneKommentar(readFileSync(join(ORDNER, datei), 'utf8'));

  // Innerhalb einer Datei zaehlt die Reihenfolge nicht: ein CREATE am Ende deckt
  // ein ALTER am Anfang, weil beides in einem Zug laeuft.
  const hierAngelegt = new Set(treffer(RE_CREATE, text));

  const braucht = new Set([
    ...treffer(RE_ALTER, text),
    ...treffer(RE_INDEX, text),
    ...treffer(RE_TRIGGER, text),
    ...treffer(RE_POLICY, text),
  ]);

  for (const tabelle of braucht) {
    if (FREMD.has(tabelle)) continue;
    if (hierAngelegt.has(tabelle)) continue;
    if (angelegt.has(tabelle)) continue;
    luecken.push({ datei, tabelle });
  }

  for (const tabelle of hierAngelegt) {
    if (!angelegt.has(tabelle)) angelegt.set(tabelle, datei);
  }
}

// Zweite Runde nur fuer die Meldung: wird die Tabelle spaeter doch angelegt?
for (const l of luecken) l.spaeter = angelegt.get(l.tabelle) ?? null;

// Zwei Klassen, und der Unterschied entscheidet ueber Rot und Gruen.
//
//  A · NIE ANGELEGT — keine Datei erschafft die Tabelle. Der Erstaufbau kann das nicht
//      heilen; es braucht eine neue Datei. Das ist rot.
//  B · ZU SPAET ANGELEGT — die Datei existiert, sie steht nur hinter der ersten
//      Aenderung. Eine frueh einsortierte Zweitanlage waere hier FALSCH: zwei der drei
//      anlegenden Dateien schreiben `create table` OHNE `if not exists` und wuerden an
//      einer bereits bestehenden Tabelle brechen. Aufgeloest wird das durch die
//      Abspielordnung unten, nicht durch eine weitere Datei. Das ist gruen, aber benannt.
const nie = luecken.filter((l) => !l.spaeter);
const spaet = luecken.filter((l) => l.spaeter);

/** Die Reihenfolge, in der der Erstaufbau spielen muss: jede Anlage vor ihrer ersten Aenderung. */
function abspielordnung() {
  const vorziehen = new Map(); // anlegende Datei -> Datei, vor die sie gehoert
  for (const l of spaet) {
    const bisher = vorziehen.get(l.spaeter);
    if (!bisher || l.datei < bisher) vorziehen.set(l.spaeter, l.datei);
  }
  const raus = [];
  for (const datei of dateien) {
    for (const [anlage, vorDiese] of vorziehen) {
      if (vorDiese === datei && !raus.includes(anlage)) raus.push(anlage);
    }
    if (!raus.includes(datei)) raus.push(datei);
  }
  return raus;
}

if (process.argv.includes("--ordnung")) {
  for (const d of abspielordnung()) console.log(d);
  process.exit(nie.length ? 1 : 0);
}

if (nie.length === 0 && spaet.length === 0) {
  console.log(`  ${dateien.length} Dateien, Kette geschlossen.`);
  console.log("KETTE: 1/1 · FEHLER: keine");
  process.exit(0);
}

console.log(`  ${dateien.length} Dateien geprueft.`);

for (const l of nie) {
  console.log(`  · ${l.tabelle} — wird von KEINER Datei angelegt`);
  console.log(`      geaendert in ${l.datei}`);
}

if (spaet.length) {
  console.log(`  ${spaet.length} Aenderung(en) stehen vor ihrer Anlage. Aufgeloest durch die`);
  console.log(`  Abspielordnung (scripts/verify/migrationen-kette.mjs --ordnung):`);
  for (const l of spaet) {
    console.log(`  · ${l.tabelle}: ${l.spaeter}`);
    console.log(`      gehoert vor ${l.datei}`);
  }
}

if (nie.length === 0) {
  console.log(`KETTE: 1/1 · FEHLER: keine · VORZUZIEHEN: ${[...new Set(spaet.map((l) => l.tabelle))].join(", ")}`);
  process.exit(0);
}

console.log(`KETTE: 0/1 · FEHLER: ${[...new Set(nie.map((l) => l.tabelle))].join(", ")}`);
process.exit(1);
