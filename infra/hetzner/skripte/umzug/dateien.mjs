#!/usr/bin/env node
/**
 * Umzug · Schritt 4 — alle Dateien (Werkbilder, Medien, Rechnungen …) holen.
 *
 * Das Verzeichnis (storage.objects) ist mit den Daten schon eingespielt; hier
 * kommen die Dateien selbst. Jede Datei wird aus dem alten Projekt geladen und
 * über die Storage-API des eigenen Servers an exakt denselben Ort gelegt.
 * Danach bekommen alle Einträge ihren ursprünglichen Besitzer zurück.
 *
 *   ALT_URL=https://<alt>.supabase.co   (Standard: das alte PAWN-Projekt)
 *   ALT_SCHLUESSEL=…                    optional: Schlüssel mit Lesezugriff auf private Eimer
 *   node dateien.mjs [--nur <eimer>]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const ALT = (process.env.ALT_URL || "https://rnakubexbqfgfciynqpt.supabase.co").replace(/\/$/, "");
const ALT_KEY = process.env.ALT_SCHLUESSEL || "";
const env = Object.fromEntries(fs.readFileSync("/opt/pawn/stack/.env", "utf8").split("\n").filter((z) => /^[A-Z0-9_]+=/.test(z)).map((z) => [z.slice(0, z.indexOf("=")), z.slice(z.indexOf("=") + 1)]));
const NEU = "http://127.0.0.1:8000";
const SERVICE = env.SERVICE_ROLE_KEY;
const nur = process.argv.includes("--nur") ? process.argv[process.argv.indexOf("--nur") + 1] : null;

function sql(q) {
  return execFileSync("docker", ["exec", "-i", "supabase-db", "psql", "-U", "supabase_admin", "-d", "postgres", "-tA", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

// Besitzer sichern, bevor die API die Einträge beim Hochladen überschreibt.
sql(`create schema if not exists umzug;
create table if not exists umzug.besitzer as select id, bucket_id, name, owner, owner_id, created_at, user_metadata, metadata from storage.objects;`);

const eimer = Object.fromEntries(sql("select id, public from storage.buckets").trim().split("\n").filter(Boolean).map((z) => { const [id, p] = z.split("|"); return [id, p === "t"]; }));
const liste = sql(`select json_build_object('b', bucket_id, 'n', name, 'm', metadata->>'mimetype', 's', (metadata->>'size')::bigint)
  from umzug.besitzer ${nur ? `where bucket_id = '${nur.replace(/'/g, "''")}'` : ""} order by bucket_id, name`)
  .trim().split("\n").filter(Boolean).map((z) => JSON.parse(z));

const pfad = (n) => n.split("/").map(encodeURIComponent).join("/");
let ok = 0, fehler = 0, bytes = 0;
const fehlerListe = [];

async function eine(o) {
  const quelle = eimer[o.b]
    ? `${ALT}/storage/v1/object/public/${o.b}/${pfad(o.n)}`
    : `${ALT}/storage/v1/object/authenticated/${o.b}/${pfad(o.n)}`;
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      let r = await fetch(quelle, { headers: ALT_KEY ? { Authorization: `Bearer ${ALT_KEY}`, apikey: ALT_KEY } : {} });
      if (!r.ok && !eimer[o.b] && !ALT_KEY) r = await fetch(`${ALT}/storage/v1/object/public/${o.b}/${pfad(o.n)}`);
      if (!r.ok) throw new Error(`alt ${r.status}`);
      const inhalt = Buffer.from(await r.arrayBuffer());
      const hoch = await fetch(`${NEU}/storage/v1/object/${o.b}/${pfad(o.n)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "x-upsert": "true", "content-type": o.m || r.headers.get("content-type") || "application/octet-stream" },
        body: inhalt,
      });
      if (!hoch.ok) throw new Error(`neu ${hoch.status} ${(await hoch.text()).slice(0, 120)}`);
      ok++; bytes += inhalt.length;
      return;
    } catch (e) {
      if (versuch === 3) { fehler++; fehlerListe.push(`${o.b}/${o.n}: ${e.message}`); }
      else await new Promise((w) => setTimeout(w, 800 * versuch));
    }
  }
}

const PARALLEL = 6;
let i = 0;
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (i < liste.length) {
    const o = liste[i++];
    await eine(o);
    if ((ok + fehler) % 50 === 0) console.log(`… ${ok + fehler}/${liste.length}`);
  }
}));

// Besitzer und Zeitstempel zurück.
sql(`update storage.objects o set owner = b.owner, owner_id = b.owner_id, created_at = b.created_at, user_metadata = b.user_metadata
     from umzug.besitzer b where o.bucket_id = b.bucket_id and o.name = b.name;`);

console.log(JSON.stringify({ dateien: liste.length, ok, fehler, megabyte: +(bytes / 1048576).toFixed(1), eimer }, null, 2));
if (fehlerListe.length) { console.log("Fehler (erste 30):"); for (const f of fehlerListe.slice(0, 30)) console.log("  " + f); }
fs.writeFileSync("/opt/pawn/umzug/dateien-ergebnis.json", JSON.stringify({ ok, fehler, fehlerListe }, null, 2));
process.exitCode = fehler ? 1 : 0;
