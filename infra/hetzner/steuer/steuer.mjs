#!/usr/bin/env node
/**
 * PAWN · Steuerpult — die Fernbedienung des eigenen Servers.
 *
 * Warum es das gibt: Auf dem Server soll niemand ein Terminal brauchen — weder
 * Daouda noch ein Agent. Gesteuert wird über HTTPS, und nur mit einer
 * Unterschrift, deren öffentlicher Schlüssel im Repo (infra/hetzner/zugang/)
 * oder in /etc/pawn/zugang liegt. Kein Passwort, kein Geheimnis im Repo:
 * Wer ins Repo pushen darf, darf steuern — sonst niemand.
 *
 * Wege (Caddy reicht sie von api.<domain> hierher durch):
 *   GET  /_steuer/lage          öffentlich: läuft alles? (keine Geheimnisse)
 *   POST /_steuer/befehl        unterschrieben: {cmd, timeout_s?, cwd?} → bash
 *   POST /_steuer/paket         unterschrieben: RSA-verpacktes Schlüsselpaket
 *   GET  /_tresor?t=…           Einmal-Link: Formular für Schlüssel (für Daouda)
 *   POST /_tresor               Einmal-Link: Schlüssel speichern
 *
 * Unterschrift (Ed25519) über:  METHODE \n PFAD \n ZEIT \n NONCE \n SHA256(body)
 * Kopfzeilen: x-pawn-schluessel, x-pawn-zeit (ms), x-pawn-nonce, x-pawn-signatur (base64)
 */
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const PORT = Number(process.env.STEUER_PORT || 7070);
const HOST = process.env.STEUER_HOST || "0.0.0.0";
const ZUGANG = (process.env.STEUER_ZUGANG || "/etc/pawn/zugang:/opt/pawn/repo/infra/hetzner/zugang").split(":");
const GEHEIM = process.env.PAWN_GEHEIM || "/etc/pawn";
const STACK = process.env.PAWN_STACK || "/opt/pawn/stack";
const PROTOKOLL = process.env.STEUER_PROTOKOLL || "/var/log/pawn-steuer.log";
const MAX_AUSGABE = 400_000;
const ZEITFENSTER_MS = 120_000;

// ── Hilfen ────────────────────────────────────────────────────────────────
const sha256hex = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const jetzt = () => new Date().toISOString();
function protokoll(zeile) {
  try { fs.appendFileSync(PROTOKOLL, `${jetzt()} ${zeile}\n`); } catch { /* still */ }
}
function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}
function lesen(req, grenze = 25 * 1024 * 1024) {
  return new Promise((ok, fehler) => {
    const teile = []; let groesse = 0;
    req.on("data", (c) => { groesse += c.length; if (groesse > grenze) { fehler(new Error("zu gross")); req.destroy(); } else teile.push(c); });
    req.on("end", () => ok(Buffer.concat(teile)));
    req.on("error", fehler);
  });
}

// ── Zugang: öffentliche Schlüssel mit Ablaufdatum ────────────────────────
// Datei <id>.pub:  optionale Kopfzeilen "# gueltig-bis: <ISO>" und danach ein PEM (SPKI, Ed25519).
function schluesselLaden() {
  const karte = new Map();
  for (const ordner of ZUGANG) {
    let dateien = [];
    try { dateien = fs.readdirSync(ordner).filter((d) => d.endsWith(".pub")); } catch { continue; }
    for (const d of dateien) {
      try {
        const text = fs.readFileSync(path.join(ordner, d), "utf8");
        const bis = (text.match(/gueltig-bis:\s*(\S+)/) || [])[1];
        if (bis && Date.parse(bis) < Date.now()) continue;
        const pem = text.slice(text.indexOf("-----BEGIN"));
        const key = crypto.createPublicKey(pem);
        if (key.asymmetricKeyType !== "ed25519") continue;
        karte.set(d.replace(/\.pub$/, ""), key);
      } catch { /* kaputte Datei überspringen */ }
    }
  }
  return karte;
}

const gesehen = new Map(); // nonce → ablauf
function nonceFrisch(nonce) {
  const t = Date.now();
  for (const [n, ab] of gesehen) if (ab < t) gesehen.delete(n);
  if (!nonce || nonce.length < 16 || gesehen.has(nonce)) return false;
  gesehen.set(nonce, t + ZEITFENSTER_MS * 2);
  return true;
}

function pruefeUnterschrift(req, body) {
  const id = String(req.headers["x-pawn-schluessel"] || "");
  const zeit = String(req.headers["x-pawn-zeit"] || "");
  const nonce = String(req.headers["x-pawn-nonce"] || "");
  const sig = String(req.headers["x-pawn-signatur"] || "");
  if (!id || !zeit || !nonce || !sig) return { ok: false, grund: "unterschrift fehlt" };
  if (Math.abs(Date.now() - Number(zeit)) > ZEITFENSTER_MS) return { ok: false, grund: "zeit ausserhalb des fensters" };
  const key = schluesselLaden().get(id);
  if (!key) return { ok: false, grund: "schluessel unbekannt oder abgelaufen" };
  const pfad = new URL(req.url, "http://x").pathname;
  const nachricht = Buffer.from(`${req.method}\n${pfad}\n${zeit}\n${nonce}\n${sha256hex(body)}`);
  let gueltig = false;
  try { gueltig = crypto.verify(null, nachricht, key, Buffer.from(sig, "base64")); } catch { gueltig = false; }
  if (!gueltig) return { ok: false, grund: "unterschrift ungueltig" };
  if (!nonceFrisch(nonce)) return { ok: false, grund: "nonce schon benutzt" };
  return { ok: true, id };
}

// ── Befehle ──────────────────────────────────────────────────────────────
function ausfuehren(cmd, timeoutS = 120, cwd = "/opt/pawn") {
  return new Promise((ok) => {
    const start = Date.now();
    let out = "", err = "";
    const kind = spawn("bash", ["-lc", cmd], { cwd: fs.existsSync(cwd) ? cwd : "/", env: { ...process.env, HOME: "/root" } });
    const stopp = setTimeout(() => { err += `\n[steuer] abgebrochen nach ${timeoutS}s`; kind.kill("SIGKILL"); }, Math.max(1, Math.min(timeoutS, 3600)) * 1000);
    kind.stdout.on("data", (c) => { if (out.length < MAX_AUSGABE) out += c; });
    kind.stderr.on("data", (c) => { if (err.length < MAX_AUSGABE) err += c; });
    kind.on("close", (code) => { clearTimeout(stopp); ok({ code, out: out.slice(0, MAX_AUSGABE), err: err.slice(0, MAX_AUSGABE), ms: Date.now() - start }); });
  });
}

// ── Lage (öffentlich, ohne Geheimnisse) ─────────────────────────────────
async function lage() {
  const r = await ausfuehren(
    "docker ps --format '{{.Names}}|{{.Status}}' 2>/dev/null; echo '---'; cat /opt/pawn/stand/bereitgestellt 2>/dev/null; echo '---'; " +
    "df -h / | tail -1 | awk '{print $5}'; free -m | awk '/Mem:/{print $3\"/\"$2}'; uptime -p",
    20,
  );
  const [dockerTeil = "", stand = "", sys = ""] = r.out.split("---\n");
  const dienste = {};
  for (const zeile of dockerTeil.trim().split("\n").filter(Boolean)) {
    const [name, status] = zeile.split("|");
    dienste[name] = status;
  }
  const [platte, speicher, laufzeit] = sys.trim().split("\n");
  const anonDatei = path.join(GEHEIM, "oeffentlich.json");
  let oeffentlich = {};
  try { oeffentlich = JSON.parse(fs.readFileSync(anonDatei, "utf8")); } catch { /* noch nicht da */ }
  return { ok: true, zeit: jetzt(), dienste, bereitgestellt: stand.trim() || null, platte, speicher_mb: speicher, laufzeit, oeffentlich };
}

// ── Tresor: Schlüssel, die nur Daouda (oder der Umzug) setzt ─────────────
const TRESOR_FELDER = [
  ["Bezahlen", [["STRIPE_SECRET_KEY", "Stripe Secret Key (sk_live_…)"], ["STRIPE_WEBHOOK_SECRET", "Stripe Webhook-Signatur (whsec_…)"], ["STRIPE_CONNECT_WEBHOOK_SECRET", "Stripe Connect Webhook-Signatur (whsec_…)"]]],
  ["Denken", [["OPENAI_API_KEY", "OpenAI API Key"], ["ANTHROPIC_API_KEY", "Anthropic API Key"]]],
  ["Bilder & Video", [["FAL_KEY", "fal.ai Key"]]],
  ["Post", [["RESEND_API_KEY", "Resend API Key"], ["RESEND_WEBHOOK_SECRET", "Resend Webhook-Signatur"]]],
  ["Recherche", [["APIFY_TOKEN", "Apify Token"]]],
  ["Anmeldung mit Google", [["GOOGLE_CLIENT_ID", "Google OAuth Client-ID"], ["GOOGLE_SECRET", "Google OAuth Client-Secret"]]],
  ["Kanäle", [["META_ACCESS_TOKEN", "Meta Access Token"], ["IG_BUSINESS_ID", "Instagram Business-ID"], ["TIKTOK_CLIENT_KEY", "TikTok Client Key"], ["TIKTOK_CLIENT_SECRET", "TikTok Client Secret"], ["YOUTUBE_ACCESS_TOKEN", "YouTube Access Token"]]],
  ["Intern", [["JARVIS_CRON_SECRET", "Jarvis Takt-Geheimnis"], ["GITHUB_TOKEN", "GitHub Token"], ["LOVABLE_API_KEY", "Lovable AI-Gateway (nur falls weiter gewünscht)"]]],
];
const ERLAUBT = new Set(TRESOR_FELDER.flatMap(([, f]) => f.map(([n]) => n)));
const AUTH_NAMEN = new Set(["GOOGLE_CLIENT_ID", "GOOGLE_SECRET"]);
const FUNKTIONEN_ENV = path.join(GEHEIM, "funktionen.env");

function envLesen(datei) {
  const karte = new Map();
  try {
    for (const zeile of fs.readFileSync(datei, "utf8").split("\n")) {
      const m = zeile.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) karte.set(m[1], m[2].replace(/^"(.*)"$/, "$1"));
    }
  } catch { /* leer */ }
  return karte;
}
function envSchreiben(datei, karte) {
  const zeilen = [...karte.entries()].map(([k, v]) => `${k}=${String(v).replace(/[\r\n]/g, "")}`);
  fs.writeFileSync(datei + ".neu", zeilen.join("\n") + "\n", { mode: 0o600 });
  fs.renameSync(datei + ".neu", datei);
}

async function schluesselUebernehmen(werte) {
  const fn = envLesen(FUNKTIONEN_ENV);
  const stackEnvDatei = path.join(STACK, ".env");
  const stack = envLesen(stackEnvDatei);
  let funktionenGeaendert = false, authGeaendert = false;
  const gesetzt = [];
  for (const [name, wert] of Object.entries(werte)) {
    if (!ERLAUBT.has(name) || typeof wert !== "string") continue;
    const w = wert.trim();
    if (!w) continue;
    if (AUTH_NAMEN.has(name)) { stack.set(name, w); authGeaendert = true; }
    else { fn.set(name, w); funktionenGeaendert = true; }
    if (name === "RESEND_API_KEY") { stack.set("SMTP_PASS", w); authGeaendert = true; }
    gesetzt.push(name);
  }
  if (stack.get("GOOGLE_CLIENT_ID") && stack.get("GOOGLE_SECRET")) stack.set("GOOGLE_ENABLED", "true");
  if (funktionenGeaendert) envSchreiben(FUNKTIONEN_ENV, fn);
  if (authGeaendert) envSchreiben(stackEnvDatei, stack);
  const neu = [];
  if (funktionenGeaendert) neu.push("functions");
  if (authGeaendert) neu.push("auth");
  if (neu.length) await ausfuehren(`cd ${STACK} && ./pawn-compose up -d --force-recreate ${neu.join(" ")}`, 300);
  protokoll(`tresor: gesetzt ${gesetzt.join(",")}`);
  return gesetzt;
}

// Einmal-Links: /etc/pawn/tresor-links.json = [{hash, bis, benutzt}]
function linkGueltig(token) {
  if (!token || token.length < 24) return false;
  const datei = path.join(GEHEIM, "tresor-links.json");
  let links = [];
  try { links = JSON.parse(fs.readFileSync(datei, "utf8")); } catch { return false; }
  const h = sha256hex(token);
  return links.some((l) => l.hash === h && Date.parse(l.bis) > Date.now());
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function tresorSeite(token, meldung = "") {
  const fn = envLesen(FUNKTIONEN_ENV);
  const stack = envLesen(path.join(STACK, ".env"));
  const hat = (n) => (AUTH_NAMEN.has(n) ? stack.get(n) : fn.get(n)) ? true : false;
  const gruppen = TRESOR_FELDER.map(([titel, felder]) => `
    <section><h2>${esc(titel)}</h2>${felder.map(([n, label]) => `
      <label><span>${esc(label)} <em>${hat(n) ? "gesetzt" : "fehlt"}</em></span>
      <input name="${n}" type="password" autocomplete="off" placeholder="${hat(n) ? "leer lassen = bleibt" : "einfügen"}"></label>`).join("")}
    </section>`).join("");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>PAWN · Tresor</title><style>
*{box-sizing:border-box}body{margin:0;background:#000;color:#fff;font:16px/1.5 Inter,system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:48px 20px 80px}h1{font:600 44px/1.05 "Playfair Display",Georgia,serif;margin:0 0 8px}
p.leit{color:#fff;opacity:.85;margin:0 0 32px}section{border:1.5px solid #fff;padding:20px;margin:0 0 20px;background:#000}
h2{font:600 20px/1.2 "Playfair Display",Georgia,serif;margin:0 0 12px}label{display:block;margin:0 0 14px}
label span{display:block;font-size:13px;letter-spacing:.04em;margin:0 0 6px}em{font-style:normal;border:1px solid #fff;padding:0 6px;margin-left:6px;font-size:11px;text-transform:uppercase}
input{width:100%;padding:12px;border:1.5px solid #fff;background:#fff;color:#000;font:15px ui-monospace,monospace;border-radius:0}
button{width:100%;padding:16px;background:#fff;color:#000;border:1.5px solid #fff;font:600 16px Inter,sans-serif;box-shadow:6px 6px 0 #fff3;cursor:pointer;border-radius:0}
button:hover{background:#000;color:#fff}.meldung{border:1.5px solid #fff;padding:14px;margin:0 0 24px}
</style></head><body><main><h1>Der Tresor</h1>
<p class="leit">Hier liegen die Schlüssel, mit denen PAWN arbeitet. Sie bleiben auf unserem eigenen Server und werden nie angezeigt — nur, ob sie gesetzt sind.</p>
${meldung ? `<div class="meldung">${esc(meldung)}</div>` : ""}
<form method="post" action="/_tresor"><input type="hidden" name="t" value="${esc(token)}">${gruppen}
<button type="submit">Schlüssel sichern</button></form></main></body></html>`;
}

// RSA-Paket aus dem alten Backend: {schluessel_b64 (RSA-OAEP-256 verpackter AES-Schlüssel), iv_b64, daten_b64 (AES-256-GCM, Tag am Ende)}
function paketOeffnen(paket) {
  const privat = crypto.createPrivateKey(fs.readFileSync(path.join(GEHEIM, "tresor-privat.pem")));
  const aes = crypto.privateDecrypt({ key: privat, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(paket.schluessel_b64, "base64"));
  const daten = Buffer.from(paket.daten_b64, "base64");
  const tag = daten.subarray(daten.length - 16);
  const inhalt = daten.subarray(0, daten.length - 16);
  const d = crypto.createDecipheriv("aes-256-gcm", aes, Buffer.from(paket.iv_b64, "base64"));
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(inhalt), d.final()]).toString("utf8"));
}

// ── Server ────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "GET" && url.pathname === "/_steuer/lage") return json(res, 200, await lage());

    if (req.method === "POST" && (url.pathname === "/_steuer/befehl" || url.pathname === "/_steuer/paket")) {
      const body = await lesen(req);
      const p = pruefeUnterschrift(req, body);
      if (!p.ok) { protokoll(`abgelehnt ${url.pathname}: ${p.grund}`); return json(res, 401, { ok: false, grund: p.grund }); }
      const daten = JSON.parse(body.toString("utf8") || "{}");
      if (url.pathname === "/_steuer/befehl") {
        protokoll(`befehl[${p.id}] ${String(daten.cmd).slice(0, 300).replace(/\n/g, " ⏎ ")}`);
        const r = await ausfuehren(String(daten.cmd || "true"), Number(daten.timeout_s || 120), daten.cwd || "/opt/pawn");
        return json(res, 200, { ok: r.code === 0, ...r });
      }
      const werte = paketOeffnen(daten.paket || daten);
      const gesetzt = await schluesselUebernehmen(werte);
      return json(res, 200, { ok: true, gesetzt });
    }

    if (url.pathname === "/_tresor") {
      if (req.method === "GET") {
        const t = url.searchParams.get("t") || "";
        if (!linkGueltig(t)) { res.writeHead(403, { "content-type": "text/plain; charset=utf-8" }); return res.end("Dieser Link ist abgelaufen."); }
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" });
        return res.end(tresorSeite(t));
      }
      if (req.method === "POST") {
        const form = new URLSearchParams((await lesen(req, 200_000)).toString("utf8"));
        const t = form.get("t") || "";
        if (!linkGueltig(t)) { res.writeHead(403, { "content-type": "text/plain; charset=utf-8" }); return res.end("Dieser Link ist abgelaufen."); }
        const werte = {};
        for (const [k, v] of form) if (k !== "t" && v.trim()) werte[k] = v;
        const gesetzt = await schluesselUebernehmen(werte);
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        return res.end(tresorSeite(t, gesetzt.length ? `Gesichert: ${gesetzt.join(", ")}. PAWN arbeitet ab jetzt damit.` : "Nichts Neues eingetragen."));
      }
    }
    json(res, 404, { ok: false });
  } catch (e) {
    protokoll(`fehler ${url.pathname}: ${e?.message}`);
    json(res, 500, { ok: false, fehler: String(e?.message || e) });
  }
});

server.listen(PORT, HOST, () => protokoll(`steuer laeuft auf ${HOST}:${PORT}`));
