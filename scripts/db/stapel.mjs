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
// OBERGRENZE IN ZEICHEN, und sie ist keine Schaetzung: die Ausgabe eines Werkzeugs
// wird oberhalb von ~32 kB abgeschnitten und in eine Datei ausgelagert. Gemessen am
// 11.09.2026 — ein Stapel von 38 kB kam nicht mehr durch, einer von 17 kB schon.
// Ein Stapel, den der Agent nicht lesen kann, kann er auch nicht anwenden.
const JE_ZEICHEN = Number(process.env.STAPEL_ZEICHEN || 20000);

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

/**
 * DIE DECKUNG — siehe scripts/db/deckung.json.
 *
 * Fuenf Migrationen legen Dinge an, die eine ANDERE Migration der Kette schon
 * angelegt hat. Die Kette bricht dort mit 42P07 oder 42710. Belegt am 11.09.2026
 * beim Abspielen gegen die echte Datenbank: `42P07: relation "staging_requests"
 * already exists`. Gefunden wurden alle fuenf auf einen Schlag mit
 * scripts/db/doppelungen.mjs — die Pruefung, die eine sechste kuenftig selbst faengt.
 *
 * KEINE MIGRATION WIRD GEAENDERT. Die Deckung wirkt nur auf das, was hier gedruckt
 * wird. Gedeckt ist immer die AERMERE Fassung: drei der Buendel-Migrationen tragen
 * GRANTs, die in den spaeteren Einzeldateien fehlen.
 */
const DECKUNG = JSON.parse(
  readFileSync(join(WURZEL, "scripts/db/deckung.json"), "utf8")).versionen;

/** Was von einer Datei wirklich an die Datenbank geht. Leer = nur buchen. */
function wirksam(datei, sql) {
  const d = DECKUNG[version(datei)];
  if (!d) return sql;
  if (d.art === "ganz") return "";
  if (d.art === "abschnitte") {
    // Das Buendel tragt seine Abschnittsgrenzen selbst: `-- Datei N: <dateiname>`.
    const stellen = [...sql.matchAll(/^-- Datei \d+: (\S+)$/gm)];
    if (!stellen.length) throw new Error(`${datei}: keine Abschnittsmarken gefunden`);
    let aus = "";
    for (const [i, m] of stellen.entries()) {
      const bis = i + 1 < stellen.length ? stellen[i + 1].index : sql.length;
      if (!d.weglassen.includes(m[1])) aus += sql.slice(m.index, bis);
    }
    if (!aus.trim()) throw new Error(`${datei}: die Deckung laesst nichts uebrig`);
    return aus;
  }
  if (d.art === "anweisung") {
    const t = d.weglassen_text;
    const treffer = sql.split(t).length - 1;
    if (treffer !== 1)
      throw new Error(`${datei}: der zu deckende Text kommt ${treffer}x vor, erwartet genau 1x`);
    return sql.replace(t, "-- (diese Anweisung ist gedeckt, siehe scripts/db/deckung.json)");
  }
  throw new Error(`${datei}: unbekannte Deckungsart ${d.art}`);
}

/**
 * Was schon liegt, wird nicht nochmal gedruckt — `--ohne <datei>`.
 *
 * WARUM: ein Lauf ueber 33 Stapel ueberlebt keine Sitzung zwangslaeufig. Ohne diesen
 * Schalter muesste die naechste Schicht die Stapelgrenzen im Kopf nachrechnen, um zu
 * wissen, wo sie weitermacht — und genau da entstehen die Fehler. Die Datei enthaelt
 * die Versionen, die auf der Datenbank liegen, eine je Zeile:
 *
 *   select version from supabase_migrations.schema_migrations order by version;
 */
function schonGelegt() {
  const i = process.argv.indexOf("--ohne");
  if (i < 0) return new Set();
  return new Set(readFileSync(process.argv[i + 1], "utf8")
    .split("\n").map((z) => z.trim()).filter(Boolean));
}

function stapeln() {
  const liegt = schonGelegt();
  const dateien = ordnung().filter((d) => !liegt.has(version(d)));
  const stapel = [];
  let laufend = [];
  for (const d of dateien) {
    const roh = readFileSync(join(WURZEL, ORDNER, d), "utf8");
    const sql = wirksam(d, roh);
    if (mussAlleinLaufen(sql)) {
      if (laufend.length) { stapel.push(laufend); laufend = []; }
      stapel.push([{ datei: d, sql, allein: true }]);
      continue;
    }
    const bisher = laufend.reduce((n, e) => n + e.sql.length, 0);
    if (laufend.length && bisher + sql.length > JE_ZEICHEN) { stapel.push(laufend); laufend = []; }
    laufend.push({ datei: d, sql, allein: false });
    if (laufend.length >= JE_STAPEL) { stapel.push(laufend); laufend = []; }
  }
  if (laufend.length) stapel.push(laufend);
  return stapel;
}

/**
 * WELCHE DATEI GIBT DEM STAPEL SEINEN NAMEN. Normalerweise die letzte — ihre Zeile
 * schreibt apply_migration selbst. Eine GANZ GEDECKTE Datei schickt aber gar kein SQL
 * mehr; sie darf den Namen nicht tragen, sonst ginge ein Stapel an die Datenbank, der
 * nur aus Kommentaren besteht. Der Name ist deshalb die letzte Datei mit echtem SQL.
 */
function nameStelle(eintraege) {
  for (let i = eintraege.length - 1; i >= 0; i--)
    if (eintraege[i].sql.trim() !== "") return i;
  throw new Error("Stapel ohne eine einzige Datei mit eigenem SQL — Stapelgrenzen pruefen");
}

/** Die SQL eines Stapels, fertig für apply_migration. */
function sqlFuer(eintraege) {
  // WOERTLICH, mit Kommentaren. Eine knappe Fassung haette 18 % gespart und dafuer
  // einen eigenen Kommentar-Entferner ueber Funktionsrumpf und Zeichenkette laufen
  // lassen. 18 % rechtfertigen dieses Risiko nicht. Gemessen, dann verworfen.
  const teile = eintraege.map(({ datei, sql }) => {
    const d = DECKUNG[version(datei)];
    if (sql.trim() === "")
      return `-- ${datei}\n-- GANZ GEDECKT von ${d.gedeckt_von.join(", ")} — kein SQL.\n`
           + `-- ${d.grund.replace(/\n/g, "\n-- ")}\n`;
    return `-- ${datei}${d ? "  (teilweise gedeckt, siehe scripts/db/deckung.json)" : ""}\n${sql.trimEnd()}\n`;
  });
  // DIE LETZTE DATEI BLEIBT HIER AUSSEN VOR. `apply_migration` schreibt ihre Zeile
  // selbst (der Name, den --name liefert, ist ihrer). Wuerde der Stapel sie auch
  // einfuegen, liefe apply_migration danach in einen Schluessel-Konflikt und der
  // ganze Stapel faellt zurueck. Gemessen am Verhalten des Werkzeugs, nicht geraten.
  const selbst = eintraege.filter((_, i) => i !== nameStelle(eintraege));
  const zeilen = selbst
    .map(({ datei }) => `    ('${version(datei)}', '${kennung(datei)}')`)
    .join(",\n");
  const buch = selbst.length === 0 ? "" :
      `\n-- Buchhaltung: eine Zeile je Datei AUSSER der letzten — die schreibt\n`
    + `-- apply_migration selbst aus dem uebergebenen Namen.\n`
    + `insert into supabase_migrations.schema_migrations (version, name)\n`
    + `  values\n${zeilen}\n`
    + `  on conflict (version) do nothing;\n`;
  // Der Rueckweg hinterlaesst seine eigene Zeile (Version 00000000000000). Sie
  // gehoert zu keiner Datei und wuerde in der Abnahme als FREMD auftauchen. Der
  // erste Stapel raeumt sie weg — eng, nur diese eine Version.
  const aufraeumen = eintraege === ersterStapel && schonGelegt().size === 0
    ? `\n-- Die Zeile des Rueckwegs gehoert zu keiner Datei.\n`
      + `delete from supabase_migrations.schema_migrations where version = '00000000000000';\n`
    : "";
  return teile.join("\n") + aufraeumen + buch;
}

const RUECKWEG = `-- Der Rückweg. Vorführen, nicht behaupten.
--
-- WAS DIE ERSTE FASSUNG DIESES RUECKWEGS UEBERSEHEN HAT, belegt am 11.09.2026:
-- \`storage.objects\` liegt NICHT im Schema public. Ein \`drop schema public cascade\`
-- nimmt seine Policies also nicht mit, und die Kette brach beim zweiten Stapel mit
--   ERROR: 42710: policy "applicant upload own folder" for table "objects" already exists
-- Gemessen waren es 17 Policies auf storage.objects, alle aus PAWNs Migrationen
-- (applicant, designer media, campaign assets, taste uploads, model pool,
-- product shots, site assets) — keine einzige eine Supabase-Vorgabe. Ein echter
-- Rueckweg muss sie mitnehmen, sonst ist er keiner.
--
-- Was NICHT mitgelöscht wird: das Schema \`auth\`. Die Konten bleiben; ihre Zeilen in
-- public (profiles, user_roles) kommen über die Nachzieh-Schleife in
-- 20260929120000 von selbst zurück.
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;
delete from supabase_migrations.schema_migrations;

-- Die Policies auf storage.objects, die public cascade nicht erreicht.
do $$
declare p record;
begin
  for p in select polname from pg_policy pol
             join pg_class c on c.oid = pol.polrelid
             join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'storage' and c.relname = 'objects'
  loop
    execute format('drop policy if exists %I on storage.objects', p.polname);
  end loop;
end $$;`;

const stapel = stapeln();
const ersterStapel = stapel[0];
if (stapel.length === 0) { console.log("STAPEL: 0 · DATEIEN: 0 · ALLEIN: 0 — alles liegt."); process.exit(0); }
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
    console.log(kennung(stapel[i][nameStelle(stapel[i])].datei));
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
    + `\n            ${s.map((e) => e.datei + (DECKUNG[version(e.datei)]
        ? (e.sql.trim() === "" ? "   [ganz gedeckt, nur Buchung]" : "   [teils gedeckt]") : ""))
        .join("\n            ")}`);
}
console.log(`\nSTAPEL: ${stapel.length} · DATEIEN: ${dateien} · ALLEIN: ${allein}`);
