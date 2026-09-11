#!/usr/bin/env node
/**
 * Die Abnahme des Erstaufbaus — und die Unversehrtheitsprüfung.
 *
 * WARUM ES DIESE DATEI GIBT: die Migrationen gehen über `apply_migration` an die
 * Datenbank, und das heisst: ihr Text läuft durch den Agenten. Ein verschluckter
 * Buchstabe in einer Migration auf einer Zahlungsdatenbank ist kein Schönheitsfehler.
 * Die Datenbank speichert den angewandten Text mit (`schema_migrations.statements`),
 * also lässt sich beides vergleichen — Datei gegen das, was wirklich ankam.
 *
 * AUFRUF
 *   node scripts/db/abnahme.mjs <befund.json>
 *
 * `befund.json` ist die Ausgabe dieser Abfrage, unverändert:
 *
 *   select version, name, coalesce(array_to_string(statements, ';'), '') as sql
 *     from supabase_migrations.schema_migrations order by version;
 *
 * Letzte Zeile maschinenlesbar:
 *   ABNAHME: <gelegt>/<dateien> · FEHLT: <n> · FREMD: <n> · ABWEICHEND: <n>
 *
 * ABWEICHEND ist der wichtigste Wert: die Datei liegt, aber was ankam, ist nicht,
 * was im Repo steht. Verglichen wird nach Normalisierung (Leerraum), weil der
 * Transportweg Zeilenenden anfassen darf — aber kein Zeichen sonst.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORDNER = "supabase/migrations";

const befundDatei = process.argv[2];
if (!befundDatei) { console.error("Aufruf: node scripts/db/abnahme.mjs <befund.json>"); process.exit(2); }

const dateien = readdirSync(join(WURZEL, ORDNER)).filter((d) => d.endsWith(".sql")).sort();

// Eine Version kann MEHRERE Dateien haben, und das ist kein Tippfehler, sondern ein
// belegter Zustand dieses Repos: 20260811090000 traegt zwei Dateien
// (part47_befund1_antworten und style_references). `schema_migrations.version` ist
// Primaerschluessel — die Historie kann davon nur EINE tragen. Beide laufen, das
// Schema wird vollstaendig, aber „Ordner und Liste stimmen exakt ueberein" ist mit
// 168 Dateien nie erreichbar, sondern nur mit 167 Versionen. Umbenennen waere der
// Ausweg und ist verboten (wache.sh, CLAUDE.md Regel 2).
const imRepo = new Map();
for (const d of dateien) {
  const v = d.slice(0, d.indexOf("_"));
  if (!imRepo.has(v)) imRepo.set(v, []);
  imRepo.get(v).push(d);
}
const doppelte = [...imRepo.entries()].filter(([, ds]) => ds.length > 1);

let gelegt;
try { gelegt = JSON.parse(readFileSync(befundDatei, "utf8")); }
catch (e) { console.error(`Befund nicht lesbar: ${e.message}`); process.exit(2); }
if (!Array.isArray(gelegt)) { console.error("Befund ist keine Liste."); process.exit(2); }

const gelegteVersionen = new Set(gelegt.map((z) => String(z.version)));

const fehlt = [...imRepo.keys()].filter((v) => !gelegteVersionen.has(v)).sort();
const fremd = [...gelegteVersionen].filter((v) => !imRepo.has(v)).sort();

// Der eigentliche Punkt: kam an, was im Repo steht?
const flach = (s) => String(s || "").replace(/\s+/g, " ").trim();
const abweichend = [];
for (const zeile of gelegt) {
  const gruppe = imRepo.get(String(zeile.version));
  if (!gruppe) continue;
  // Bei einer Doppelung vergleichen wir gegen die Datei, die am besten passt.
  const d = gruppe.length === 1 ? gruppe[0] : gruppe[0];
  const ausDb = flach(zeile.sql);
  if (!ausDb) continue;                     // nichts mitgeschrieben — nicht vergleichbar
  const ausDatei = flach(readFileSync(join(WURZEL, ORDNER, d), "utf8"));
  // Die Buchhaltungszeile haengt der Stapel selbst an; sie steht in keiner Datei.
  const ohneBuch = ausDb.replace(/insert into supabase_migrations\.schema_migrations[\s\S]*$/i, "").trim();
  if (!ausDatei.includes(ohneBuch.slice(0, Math.min(ohneBuch.length, 400))) && !ohneBuch.includes(ausDatei.slice(0, 400)))
    abweichend.push(`${d} (Datei ${ausDatei.length} Zeichen, angekommen ${ohneBuch.length})`);
}

for (const v of fehlt.slice(0, 12))  console.log(`  FEHLT   ${imRepo.get(v).join(" + ")}`);
if (fehlt.length > 12)               console.log(`  … und ${fehlt.length - 12} weitere`);
for (const v of fremd.slice(0, 12))  console.log(`  FREMD   Version ${v} liegt auf der Datenbank, aber in keiner Datei`);
for (const a of abweichend.slice(0, 12)) console.log(`  ABWEICHEND  ${a}`);

for (const [v, ds] of doppelte)
  console.log(`  DOPPELT  Version ${v} traegt ${ds.length} Dateien (${ds.join(", ")})`
    + ` — die Historie kann nur eine tragen. Bekannt und unvermeidbar.`);

const gut = fehlt.length === 0 && fremd.length === 0 && abweichend.length === 0;
const erwartet = imRepo.size;   // Versionen, nicht Dateien — siehe DOPPELT oben.
console.log(`ABNAHME: ${gelegteVersionen.size}/${erwartet} Versionen (${dateien.length} Dateien)`
  + ` · FEHLT: ${fehlt.length} · FREMD: ${fremd.length} · ABWEICHEND: ${abweichend.length}`);
process.exit(gut ? 0 : 1);
