#!/usr/bin/env node
/**
 * vercel.json → Caddy. Eine Wahrheit für die Adressen der Seite.
 *
 * vercel.json bleibt die Quelle (src/__tests__/routen.spec.ts hält sie mit
 * App.tsx im Gleichschritt). Dieses Skript übersetzt sie für unseren eigenen
 * Server, ohne eine zweite Liste zu pflegen:
 *   1. echte Dateien zuerst (handle: filesystem)
 *   2. 301-Umzüge
 *   3. bekannte Seiten → index.html mit 200
 *   4. alles andere → index.html mit 404 (die Seite zeigt „nicht gefunden",
 *      Suchmaschinen sehen den richtigen Code)
 *
 *   node routen-aus-vercel.mjs <vercel.json> <ausgabe.caddy>
 */
import fs from "node:fs";

const [, , quelle = "vercel.json", ziel = "routen.caddy"] = process.argv;
const { routes = [] } = JSON.parse(fs.readFileSync(quelle, "utf8"));

const umzuege = routes.filter((r) => r.status === 301 && r.headers?.Location);
const seiten = routes.filter((r) => r.dest === "/index.html" && !r.status && r.src !== "/.*");
const auffang = routes.find((r) => r.src === "/.*" && r.dest === "/index.html");

// Caddy-Matcher-Namen müssen eindeutig sein; Regex bleibt RE2-kompatibel (Go).
const zeilen = [];
zeilen.push("# AUTOMATISCH ERZEUGT aus vercel.json — nicht von Hand ändern.");
zeilen.push(`# ${umzuege.length} Umzüge · ${seiten.length} Seiten · Auffang ${auffang ? auffang.status || 200 : "keiner"}`);
zeilen.push("");
zeilen.push("# Gebaute Dateien mit Fingerabdruck dürfen ein Jahr im Cache liegen.");
zeilen.push("@unveraenderlich path /assets/*");
zeilen.push('header @unveraenderlich Cache-Control "public, max-age=31536000, immutable"');
zeilen.push("");

// 1. Dateien zuerst — genau wie handle: filesystem bei Vercel.
zeilen.push("@datei file {path}");
zeilen.push("handle @datei {");
zeilen.push("\tfile_server");
zeilen.push("}");
zeilen.push("");

// 2. Umzüge (301). Laufen in einem eigenen handle, damit sie vor den Seiten greifen.
umzuege.forEach((r, i) => {
  zeilen.push(`@umzug${i} path_regexp ${JSON.stringify(r.src)}`);
  zeilen.push(`handle @umzug${i} {`);
  zeilen.push(`\tredir * ${r.headers.Location} 301`);
  zeilen.push("}");
});
zeilen.push("");

// 3. Bekannte Seiten — eine einzige Regex, damit Caddy sie in einem Schritt prüft.
const muster = seiten.map((r) => `(?:${r.src.replace(/^\^/, "").replace(/\$$/, "")})`).join("|");
zeilen.push(`@seite path_regexp seite ^(?:${muster})$`);
zeilen.push("handle @seite {");
zeilen.push('\theader Cache-Control "no-cache"');
zeilen.push("\trewrite * /index.html");
zeilen.push("\tfile_server");
zeilen.push("}");
zeilen.push("");

// 4. Auffang: index.html, aber mit dem Code aus vercel.json (404).
zeilen.push("handle {");
if (auffang?.headers) for (const [k, v] of Object.entries(auffang.headers)) zeilen.push(`\theader ${k} ${JSON.stringify(k === "x-pawn-404" ? "pawn-server" : v)}`);
zeilen.push("\trewrite * /index.html");
zeilen.push("\tfile_server {");
zeilen.push(`\t\tstatus ${auffang?.status || 200}`);
zeilen.push("\t}");
zeilen.push("}");

fs.writeFileSync(ziel, zeilen.join("\n") + "\n");
console.log(`routen: ${umzuege.length} Umzüge, ${seiten.length} Seiten → ${ziel}`);
