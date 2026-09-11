#!/usr/bin/env node
/**
 * Der Stapel-Drucker für den Erstaufbau.
 *
 * WARUM DIESE DATEI IM REPO LIEGT UND NICHT IM SCRATCHPAD: beim ersten Versuch
 * (Teil L1) lag sie im Scratchpad. Der Container wechselte, sie war weg, und die
 * nächste Schicht musste die ganze Maschinerie neu bauen. Gesetz 1 — was der Agent
 * nicht sehen kann, existiert nicht.
 *
 * WAS SIE TUT
 * Sie druckt die Migrationen in der Reihenfolge, in der sie abspielbar sind, zu
 * Stapeln gebündelt, jeder Stapel fertig für EINEN Aufruf von `apply_migration`.
 *
 * DREI DINGE, DIE SIE BERÜCKSICHTIGT, UND JEDES IST EIN BELEGTER FEHLER
 *
 *  1. DIE ABSPIELORDNUNG. supabase/migrations/ ist in Dateinamen-Reihenfolge NICHT
 *     abspielbar: drei Tabellen werden geändert, bevor sie angelegt werden. Die
 *     Reihenfolge kommt deshalb aus `migrationen-kette.mjs --ordnung`, nicht aus
 *     einem `sort`. Ohne das bricht der Lauf bei designer_opportunities.
 *
 *  2. `ALTER TYPE ... ADD VALUE` KANN NICHT IN EINER TRANSAKTION LAUFEN, in der der
 *     neue Wert danach benutzt wird. `apply_migration` ist transaktional. Jede Datei
 *     mit einem solchen Befehl bekommt deshalb ihren EIGENEN Stapel, allein.
 *
 *  3. DIE BUCHHALTUNG. `apply_migration` schreibt genau EINE Zeile in
 *     supabase_migrations.schema_migrations, mit der Version aus dem übergebenen
 *     Namen (nachgemessen am 11.09.2026). Ein Stapel aus acht Dateien würde also
 *     sieben Zeilen verschlucken, und die Abnahme („migration list und Ordner
 *     stimmen überein") wäre nicht erfüllbar. Jeder Stapel hängt deshalb selbst die
 *     Zeilen für alle seine Dateien an.
 *
 * AUFRUF
 *   node scripts/db/stapel.mjs --liste          # Übersicht: Stapel, Dateien, Größe
 *   node scripts/db/stapel.mjs --stapel 14      # die SQL für Stapel 14, zum Anwenden
 *   node scripts/db/stapel.mjs --ab 14          # Übersicht ab Stapel 14
 *   node scripts/db/stapel.mjs --name 14        # der Name für apply_migration
 *   node scripts/db/stapel.mjs --rueckweg       # die SQL für den Rückweg
 *
 * Die letzte Zeile von --liste ist maschinenlesbar:
 *   STAPEL: <anzahl> · DATEIEN: <anzahl> · ALLEIN: <anzahl>
 */
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORDNER = "supabase/migrations";
const JE_STAPEL = Number(process.env.STAPEL_GROESSE || 8);

/** Die abspielbare Reihenfolge — aus der Prüfung, nicht aus einem sort. */
function ordnung() {
  const aus = execFileSync("node", [join(WURZEL, "scripts/verify/migrationen-kette.mjs"), "--ordnung"],
    { cwd: WURZEL, encoding: "utf8" });
  const namen = aus.split("\n").map((z) => z.trim()).filter((z) => z.endsWith(".sql"));
  const vorhanden = new Set(readdirSync(join(WURZEL, ORDNER)).filter((d) => d.endsWith(".sql")));
  const fehlt = namen.filter((n) => !vorhanden.has(n));
  if (fehlt.length) throw new Error(`Abspielordnung nennt Dateien, die es nicht gibt: ${fehlt.join(", ")}`);
  if (namen.length !== vorhanden.size)
    throw new Error(`Abspielordnung hat ${namen.length} Dateien, der Ordner ${vorhanden.size}`);
  return namen;
}

/** `ALTER TYPE ... ADD VALUE` muss allein laufen — siehe Kopf, Punkt 2. */
function mussAlleinLaufen(sql) {
  return /alter\s+type\s+[^;]*\badd\s+value\b/i.test(sql.replace(/--[^\n]*/g, ""));
}

const version = (datei) => datei.slice(0, datei.indexOf("_"));
const kennung = (datei) => datei.replace(/\.sql$/, "");

function stapeln() {
  const dateien = ordnung();
  const stapel = [];
  let laufend = [];
  for (const d of dateien) {
    const sql = readFileSync(join(WURZEL, ORDNER, d), "utf8");
    if (mussAlleinLaufen(sql)) {
      if (laufend.length) { stapel.push(laufend); laufend = []; }
      stapel.push([{ datei: d, sql, allein: true }]);
      continue;
    }
    laufend.push({ datei: d, sql, allein: false });
    if (laufend.length >= JE_STAPEL) { stapel.push(laufend); laufend = []; }
  }
  if (laufend.length) stapel.push(laufend);
  return stapel;
}

/** Die SQL eines Stapels, fertig für apply_migration. */
function sqlFuer(eintraege) {
  const teile = eintraege.map(({ datei, sql }) =>
    `-- ══════════════════════════════════════════════════════════════\n`
    + `-- ${datei}\n`
    + `-- ══════════════════════════════════════════════════════════════\n${sql.trimEnd()}\n`);
  const zeilen = eintraege
    .map(({ datei }) => `    ('${version(datei)}', '${kennung(datei)}')`)
    .join(",\n");
  const buch = `\n-- Buchhaltung: eine Zeile je Datei, Version aus dem Dateinamen.\n`
    + `insert into supabase_migrations.schema_migrations (version, name)\n`
    + `  values\n${zeilen}\n`
    + `  on conflict (version) do nothing;\n`;
  return teile.join("\n") + buch;
}

const RUECKWEG = `-- Der Rückweg. Vorführen, nicht behaupten.
--
-- Was NICHT mitgelöscht wird: das Schema \`auth\`. Die Konten bleiben; ihre Zeilen in
-- public (profiles, user_roles) kommen über die Nachzieh-Schleife in
-- 20260929120000 von selbst zurück.
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;
delete from supabase_migrations.schema_migrations;`;

const stapel = stapeln();
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? null : process.argv[i + 1];
};

if (process.argv.includes("--rueckweg")) { console.log(RUECKWEG); process.exit(0); }

const nr = arg("--stapel") ?? arg("--name");
if (nr !== null) {
  const i = Number(nr) - 1;
  if (!stapel[i]) { console.error(`Stapel ${nr} gibt es nicht (1 bis ${stapel.length}).`); process.exit(1); }
  if (arg("--name") !== null) {
    // Der Name entscheidet, welche Version apply_migration selbst schreibt — und
    // das ist die LETZTE Datei des Stapels, damit die Reihenfolge stimmt.
    console.log(kennung(stapel[i].at(-1).datei));
  } else {
    console.log(sqlFuer(stapel[i]));
  }
  process.exit(0);
}

const ab = Number(arg("--ab") || 1);
let allein = 0, dateien = 0;
for (const [i, s] of stapel.entries()) {
  dateien += s.length;
  if (s[0].allein) allein++;
  if (i + 1 < ab) continue;
  const bytes = s.reduce((n, e) => n + e.sql.length, 0);
  console.log(`Stapel ${String(i + 1).padStart(3)} · ${String(s.length).padStart(2)} Datei(en)`
    + ` · ${String(Math.round(bytes / 1024)).padStart(3)} kB`
    + (s[0].allein ? "  ALLEIN (ALTER TYPE)" : "")
    + `\n            ${s.map((e) => e.datei).join("\n            ")}`);
}
console.log(`\nSTAPEL: ${stapel.length} · DATEIEN: ${dateien} · ALLEIN: ${allein}`);
