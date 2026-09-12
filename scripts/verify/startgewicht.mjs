import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
// Misst den Einstieg einschliesslich statischer Abhaengigkeiten, keine spaeteren Routen.
const root = resolve(process.argv[2] || "dist");
const manifest = JSON.parse(readFileSync(resolve(root, ".vite/manifest.json"), "utf8"));
const visited = new Set();
function walk(key) {
  if (visited.has(key)) return;
  visited.add(key);
  for (const child of manifest[key]?.imports || []) walk(child);
}
for (const [key, value] of Object.entries(manifest)) if (value.isEntry) walk(key);
const files = [...visited].map(k => manifest[k]?.file).filter(f => f?.endsWith(".js"));
if (!files.length) throw new Error("Kein JavaScript-Einstieg im Build-Manifest.");
const bytes = files.map(f => readFileSync(resolve(root, f)));
const report = { files, rawBytes: bytes.reduce((n, b) => n + b.length, 0), gzipBytes: bytes.reduce((n, b) => n + gzipSync(b).length, 0) };
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
// Nach der Trennung am 12.09.2026: 896 607 B. Rund 23 % Spielraum fuer Weiterentwicklung.
// Der alte Einstieg (2 187 402 B) faellt hier durch; keine stille Rueckkehr ins Gesamtpaket.
const limit = Number(process.env.PAWN_START_MAX_BYTES || 1_100_000);
if (!Number.isFinite(limit) || limit <= 0) throw new Error("Ungueltige Startgewicht-Grenze.");
if (report.rawBytes > limit) {
  console.error("Start-JavaScript ueber Budget: " + report.rawBytes + " > " + limit + " Byte");
  process.exitCode = 1;
}
