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
let passwort;
try {
  passwort = (fs.readFileSync(DATEI, "utf8").match(/^UMZUG_PASSWORT=(.+)$/m) || [])[1];
} catch { /* neu */ }
if (!passwort) {
  passwort = crypto.randomBytes(32).toString("base64url");
  fs.writeFileSync(DATEI, `UMZUG_ROLLE=pawn_umzug\nUMZUG_PASSWORT=${passwort}\n`, { mode: 0o600 });
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
