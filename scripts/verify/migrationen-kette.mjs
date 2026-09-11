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
const ORDNER = process.argv[2] || 'supabase/migrations';

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

if (luecken.length === 0) {
  console.log(`  ${dateien.length} Dateien, Kette geschlossen.`);
  console.log('KETTE: 1/1 · FEHLER: keine');
  process.exit(0);
}

console.log(`  ${dateien.length} Dateien geprueft, ${luecken.length} Luecke(n):`);
for (const l of luecken) {
  const wo = l.spaeter
    ? `wird erst in ${l.spaeter} angelegt — zu spaet`
    : 'wird von KEINER Datei angelegt';
  console.log(`  · ${l.tabelle}`);
  console.log(`      geaendert in ${l.datei}`);
  console.log(`      ${wo}`);
}
const namen = [...new Set(luecken.map((l) => l.tabelle))];
console.log(`KETTE: 0/1 · FEHLER: ${namen.join(', ')}`);
process.exit(1);
