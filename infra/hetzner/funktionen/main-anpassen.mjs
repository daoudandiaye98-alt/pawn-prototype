#!/usr/bin/env node
/**
 * Passt den offiziellen Edge-Runtime-Verteiler (volumes/functions/main/index.ts)
 * an PAWN an — mit genau einer Änderung:
 *
 *   Die offizielle Fassung kennt nur „alle Funktionen prüfen die Anmeldung"
 *   oder „keine". PAWN braucht beides: Webhooks (Stripe, Resend) und die
 *   öffentlichen Formulare laufen ohne Anmeldung, alles andere mit.
 *   Die Liste kommt aus supabase/config.toml (verify_jwt = false) über die
 *   Umgebung FUNCTIONS_NO_VERIFY.
 *
 * Bricht laut ab, wenn die Stelle im offiziellen Code nicht mehr passt —
 * lieber ein roter Lauf als eine Funktion, die still ohne Prüfung läuft.
 */
import fs from "node:fs";

const datei = process.argv[2];
let code = fs.readFileSync(datei, "utf8");
const MARKE = "// PAWN: Funktionen ohne Anmeldung";
if (code.includes(MARKE)) process.exit(0);

const anker = "if (req.method !== 'OPTIONS' && VERIFY_JWT) {";
if (!code.includes(anker)) {
  console.error(`main-anpassen: Anker nicht gefunden in ${datei} — offizielle Fassung hat sich geändert.`);
  process.exit(1);
}
const vorspann = `${MARKE} (aus supabase/config.toml, verify_jwt = false)
const PAWN_OHNE_ANMELDUNG = new Set((Deno.env.get('FUNCTIONS_NO_VERIFY') ?? '').split(',').map((s) => s.trim()).filter(Boolean))
function pawnBrauchtAnmeldung(req: Request): boolean {
  const name = new URL(req.url).pathname.split('/')[1] ?? ''
  return !PAWN_OHNE_ANMELDUNG.has(name)
}
`;
code = code.replace("const MAX_WORKER_RETRIES", `${vorspann}\nconst MAX_WORKER_RETRIES`);
code = code.replace(anker, "if (req.method !== 'OPTIONS' && VERIFY_JWT && pawnBrauchtAnmeldung(req)) {");
fs.writeFileSync(datei, code);
console.log("main-anpassen: Verteiler angepasst");
