#!/usr/bin/env node
/**
 * Gegenstück zum Steuerpult: unterschreibt Befehle und schickt sie an den Server.
 *
 *   STEUER_URL=https://api.pawn.vision STEUER_ID=sitzung-2026-11-23 \
 *   STEUER_PRIVAT=~/.pawn/steuer-privat.pem node steuer-client.mjs befehl "docker ps"
 *
 *   node steuer-client.mjs lage
 *   node steuer-client.mjs befehl-datei skript.sh [timeout_s]
 *   node steuer-client.mjs paket paket.json
 *
 * Einen neuen Schlüssel erzeugen (öffentlicher Teil kommt nach infra/hetzner/zugang/<id>.pub):
 *   node steuer-client.mjs schluessel <id> [tage]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";

const [, , aktion, ...rest] = process.argv;
const URL_BASIS = (process.env.STEUER_URL || "https://api.pawn.vision").replace(/\/$/, "");
const ID = process.env.STEUER_ID || "";
const PRIVAT = (process.env.STEUER_PRIVAT || "~/.pawn/steuer-privat.pem").replace(/^~/, os.homedir());

function unterschreiben(methode, pfad, body) {
  const zeit = String(Date.now());
  const nonce = crypto.randomBytes(18).toString("base64url");
  const hash = crypto.createHash("sha256").update(body).digest("hex");
  const key = crypto.createPrivateKey(fs.readFileSync(PRIVAT));
  const sig = crypto.sign(null, Buffer.from(`${methode}\n${pfad}\n${zeit}\n${nonce}\n${hash}`), key).toString("base64");
  return { "x-pawn-schluessel": ID, "x-pawn-zeit": zeit, "x-pawn-nonce": nonce, "x-pawn-signatur": sig };
}

async function senden(pfad, daten) {
  const body = Buffer.from(JSON.stringify(daten));
  const r = await fetch(URL_BASIS + pfad, { method: "POST", headers: { "content-type": "application/json", ...unterschreiben("POST", pfad, body) }, body });
  const text = await r.text();
  try { return { status: r.status, ...JSON.parse(text) }; } catch { return { status: r.status, roh: text.slice(0, 2000) }; }
}

if (aktion === "schluessel") {
  const [id, tage = "7"] = rest;
  if (!id) throw new Error("id fehlt");
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  fs.mkdirSync(PRIVAT.replace(/\/[^/]+$/, ""), { recursive: true, mode: 0o700 });
  fs.writeFileSync(PRIVAT, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  const bis = new Date(Date.now() + Number(tage) * 864e5).toISOString();
  process.stdout.write(`# gueltig-bis: ${bis}\n# wer: ${id}\n${publicKey.export({ type: "spki", format: "pem" })}`);
} else if (aktion === "lage") {
  const r = await fetch(URL_BASIS + "/_steuer/lage");
  console.log(JSON.stringify(await r.json(), null, 2));
} else if (aktion === "befehl" || aktion === "befehl-datei") {
  const cmd = aktion === "befehl" ? rest[0] : fs.readFileSync(rest[0], "utf8");
  const timeout_s = Number(aktion === "befehl" ? rest[1] || 120 : rest[1] || 600);
  const r = await senden("/_steuer/befehl", { cmd, timeout_s });
  if (r.out) process.stdout.write(r.out);
  if (r.err) process.stderr.write(r.err);
  if (r.grund || r.roh || r.fehler) console.error(`[steuer] ${r.status} ${r.grund || r.fehler || r.roh}`);
  process.exitCode = r.code ?? (r.ok ? 0 : 1);
} else if (aktion === "paket") {
  // Nimmt die ganze Antwort der Brücke ({namen, paket}) oder nur das Paket.
  const roh = JSON.parse(fs.readFileSync(rest[0], "utf8"));
  const paket = roh.paket || roh;
  console.log(JSON.stringify(await senden("/_steuer/paket", { paket }), null, 2));
} else {
  console.error("aktion: lage | befehl <cmd> [timeout] | befehl-datei <datei> [timeout] | paket <datei> | schluessel <id> [tage]");
  process.exitCode = 2;
}
