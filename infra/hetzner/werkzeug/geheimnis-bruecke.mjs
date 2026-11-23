#!/usr/bin/env node
/**
 * Baut die einmalige Geheimnis-Brücke für das ALTE Backend.
 *
 * Die Schlüssel der KI-Funktionen (Stripe, OpenAI, fal …) liegen nur im alten
 * Backend und sind dort nicht lesbar. Diese Edge Function wird dort einmal
 * ausgeliefert, liest die bekannten Schlüssel aus ihrer Umgebung und gibt sie
 * NUR verschlüsselt heraus — verpackt mit dem öffentlichen Schlüssel des neuen
 * Servers. Öffnen kann das Paket allein der neue Server. Wer es unterwegs
 * sieht (auch der Agent), sieht nur Rauschen. Danach wird die Function gelöscht.
 *
 * Im selben Paket reist der Dienst-Schlüssel des ALTEN Projekts mit, als
 * ALT_SCHLUESSEL. Ohne ihn bleiben die privaten Eimer (Einladungen, Mediathek,
 * Geschmacks-Uploads …) verschlossen. Der Server legt ihn nur in
 * /etc/pawn/umzug.env ab, nie bei den Funktionen, und er wird nach dem
 * Umschalten gelöscht. So muss kein privater Eimer öffentlich werden.
 *
 *   node geheimnis-bruecke.mjs <tresor-oeffentlich.pem> > index.ts
 *   → druckt den Function-Code; der Einmal-Code steht in ~/.pawn/bruecke-code
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";

const pem = fs.readFileSync(process.argv[2], "utf8").trim();
const code = crypto.randomBytes(24).toString("base64url");
fs.mkdirSync(`${os.homedir()}/.pawn`, { recursive: true, mode: 0o700 });
fs.writeFileSync(`${os.homedir()}/.pawn/bruecke-code`, code + "\n", { mode: 0o600 });
const hash = crypto.createHash("sha256").update(code).digest("hex");

const NAMEN = ["ANTHROPIC_API_KEY", "APIFY_TOKEN", "FAL_KEY", "GITHUB_TOKEN", "IG_BUSINESS_ID", "JARVIS_CRON_SECRET",
  "LOVABLE_API_KEY", "META_ACCESS_TOKEN", "OPENAI_API_KEY", "RESEND_API_KEY", "RESEND_WEBHOOK_SECRET",
  "STRIPE_CONNECT_WEBHOOK_SECRET", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET", "YOUTUBE_ACCESS_TOKEN"];
// Nur für den Umzug selbst: Zielname → Name in der alten Umgebung.
const UMZUG = { ALT_SCHLUESSEL: "SUPABASE_SERVICE_ROLE_KEY" };

process.stdout.write(`// geheimnis-umzug — EINMALIGE Brücke beim Umzug auf den eigenen Server (pawn.vision).
// Gibt die Schlüssel der Funktionen NUR verschlüsselt heraus (RSA-OAEP-256 + AES-256-GCM)
// mit dem öffentlichen Schlüssel des neuen Servers. Nur dieser kann das Paket öffnen.
// Aufruf nur mit dem Einmal-Code (hier steht allein sein SHA-256). Nach dem Umzug löschen.
const ZIEL_PEM = \`${pem}\`;
const CODE_SHA256 = "${hash}";
const NAMEN = ${JSON.stringify(NAMEN)};
const UMZUG: Record<string, string> = ${JSON.stringify(UMZUG)};

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const b64 = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("nein", { status: 405 });
  const code = req.headers.get("x-umzug-code") ?? "";
  if (hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))) !== CODE_SHA256) return new Response("nein", { status: 403 });
  const werte: Record<string, string> = {};
  for (const n of NAMEN) { const v = Deno.env.get(n); if (v) werte[n] = v; }
  for (const [ziel, quelle] of Object.entries(UMZUG)) { const v = Deno.env.get(quelle); if (v) werte[ziel] = v; }
  const der = Uint8Array.from(atob(ZIEL_PEM.replace(/-----[^-]+-----|\\s/g, "")), (c) => c.charCodeAt(0));
  const pub = await crypto.subtle.importKey("spki", der, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const aes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const roh = new Uint8Array(await crypto.subtle.exportKey("raw", aes));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const daten = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(werte))));
  const schluessel = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, roh));
  return Response.json({ namen: Object.keys(werte), paket: { schluessel_b64: b64(schluessel), iv_b64: b64(iv), daten_b64: b64(daten) } });
});
`);
