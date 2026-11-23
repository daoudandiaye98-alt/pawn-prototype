#!/usr/bin/env node
/**
 * Umzug · Schritt 1 — ein befristeter Lese-Zugang zur alten Datenbank.
 *
 * Erzeugt auf dem Server ein langes Zufallspasswort und gibt NUR den
 * SCRAM-Verifier aus (gesalzener, iterierter Hash — daraus lässt sich das
 * Passwort nicht zurückrechnen). Mit dem Verifier legt man in der alten
 * Datenbank die Rolle an; das Passwort selbst verlässt diesen Server nie.
 *
 *   node zugang-erzeugen.mjs  → druckt das CREATE ROLE für die alte Datenbank
 */
import crypto from "node:crypto";
import fs from "node:fs";

const DATEI = "/etc/pawn/umzug.env";
let bisher = "";
try { bisher = fs.readFileSync(DATEI, "utf8"); } catch { /* neu */ }
let passwort = (bisher.match(/^UMZUG_PASSWORT=(.+)$/m) || [])[1];
if (!passwort) {
  passwort = crypto.randomBytes(32).toString("base64url");
  // Andere Zeilen bleiben stehen — etwa ALT_SCHLUESSEL, falls die Brücke zuerst lief.
  const rest = bisher.split("\n").filter((z) => z && !/^UMZUG_(ROLLE|PASSWORT)=/.test(z));
  fs.writeFileSync(DATEI, [`UMZUG_ROLLE=pawn_umzug`, `UMZUG_PASSWORT=${passwort}`, ...rest].join("\n") + "\n", { mode: 0o600 });
}

const salz = crypto.randomBytes(16);
const runden = 4096;
const gesalzen = crypto.pbkdf2Sync(passwort.normalize("NFKC"), salz, runden, 32, "sha256");
const hmac = (k, t) => crypto.createHmac("sha256", k).update(t).digest();
const clientKey = hmac(gesalzen, "Client Key");
const storedKey = crypto.createHash("sha256").update(clientKey).digest();
const serverKey = hmac(gesalzen, "Server Key");
const verifier = `SCRAM-SHA-256$${runden}:${salz.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;

const bis = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
console.log(`-- In der ALTEN Datenbank ausführen (befristet bis ${bis}):
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'pawn_umzug') then
    execute format('alter role pawn_umzug with login bypassrls password %L valid until %L', '${verifier}', '${bis}');
  else
    execute format('create role pawn_umzug with login bypassrls password %L valid until %L', '${verifier}', '${bis}');
  end if;
end $$;
grant pg_read_all_data to pawn_umzug;`);
