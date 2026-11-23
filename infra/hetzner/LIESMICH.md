# PAWN · Das eigene Zuhause (Hetzner)

PAWN läuft komplett auf einem eigenen Server bei Hetzner: Datenbank, Anmeldung,
Dateien, KI-Funktionen und das Frontend. Kein Lovable Cloud, kein Vercel mehr
nötig. Alles ist Open Source (das offizielle Supabase-Self-Hosting, Release
`self-hosted/v0.8.5`), der Server gehört uns, die Domain pawn.vision zeigt darauf.

```
pawn.vision ─┐                      ┌─ Frontend (das Heft, Studio, Cockpit) aus /opt/pawn/web
             ├─ Caddy (HTTPS) ──────┤
api.pawn.vision                     ├─ /auth /rest /storage /functions /realtime → Supabase-Gateway
studio.pawn.vision (Passwort)       ├─ /_steuer, /_tresor → Steuerpult
                                    └─ Studio (Datenbank im Browser)
```

## Wie Änderungen live gehen

**Push auf den Zweig, dem der Server folgt (`/etc/pawn/zweig`) → spätestens 2 Minuten
später ist es live.** Der Takt (`skripte/takt.sh`) holt den neuen Stand und
`skripte/bereitstellen.sh` bringt ihn aus: KI-Funktionen, Adressen aus `vercel.json`,
Frontend-Bau (nur wenn sich das Frontend geändert hat). Kein Terminal, kein Lovable-Deploy.

| Was du änderst | Was passiert |
|---|---|
| `src/`, `public/`, `index.html`, `package*.json` | Frontend wird auf dem Server neu gebaut |
| `supabase/functions/*` | Funktionen werden ersetzt, Edge Runtime startet neu |
| `supabase/config.toml` (`verify_jwt = false`) | Liste der Funktionen ohne Anmeldung |
| `vercel.json` | Umleitungen und bekannte Seiten in Caddy |
| `infra/hetzner/stack/docker-compose.pawn.yml` | Container werden angepasst |
| Datenbank (Migration) | über das Steuerpult einspielen (siehe unten) |

## Das Steuerpult — Fernbedienung ohne Terminal

`steuer/steuer.mjs` nimmt Befehle über HTTPS an — **nur mit Unterschrift**. Erlaubt
sind die öffentlichen Schlüssel in `infra/hetzner/zugang/*.pub` (mit Ablaufdatum)
und in `/etc/pawn/zugang`. Kein Passwort, kein Geheimnis im Repo: wer ins Repo
pushen darf, darf steuern.

```bash
# neuen Schlüssel für eine Sitzung (7 Tage), öffentlichen Teil ins Repo legen:
node werkzeug/steuer-client.mjs schluessel sitzung-2026-11-24 7 > zugang/sitzung-2026-11-24.pub
# Befehle:
STEUER_ID=sitzung-2026-11-24 node werkzeug/steuer-client.mjs befehl "pawn-compose ps"
node werkzeug/steuer-client.mjs lage      # öffentlich: läuft alles?
```

Jeder Befehl steht in `/var/log/pawn-steuer.log` auf dem Server.

## Der Tresor — Schlüssel ohne Terminal

Die Schlüssel der KI-Funktionen (Stripe, OpenAI, Anthropic, fal, Resend …) liegen
nur auf dem Server in `/etc/pawn/funktionen.env` (Rechte 600). Zwei Wege hinein:

1. **Einmal-Link für Daouda:** `https://api.pawn.vision/_tresor?t=…` — Formular,
   das nur zeigt, *ob* ein Schlüssel gesetzt ist, nie den Wert. Einen Link erzeugt
   das Steuerpult (`skripte/tresor-link.sh`).
2. **Umzug aus dem alten Backend:** `werkzeug/geheimnis-bruecke.mjs` baut eine
   Einmal-Function, die die alten Schlüssel nur verschlüsselt (mit dem öffentlichen
   Schlüssel dieses Servers) herausgibt. Nur dieser Server kann das Paket öffnen.
   Im selben Paket kommt der Dienst-Schlüssel des alten Projekts (`ALT_SCHLUESSEL`)
   für die privaten Eimer mit. Er landet nur in `/etc/pawn/umzug.env`, nie bei den
   Funktionen, und das Formular kann ihn nicht setzen.

## Der Umzug aus Lovable Cloud (einmalig)

Geprüft im Probelauf am 23.11.2026 gegen eine nachgebaute alte Datenbank:
42 von 42 Tabellen zeilengleich, Rechte (Tabellen, Spalten, Funktionen, RLS,
Policies) identisch, Anmeldung mit alten Passwörtern, Dateien samt Besitzern,
alte Adressen umgeschrieben, Takt-Aufträge aus.

1. `skripte/umzug/zugang-erzeugen.mjs` — befristete Leserolle; nur der Hash verlässt den Server
2. `skripte/umzug/abzug.sh` — Rollen, Schema, Daten, Historie, Takt-Aufträge, Rechte, Zählung
3. `skripte/umzug/einspielen.sh` — alles in EINER Transaktion; Takt-Aufträge danach AUS
4. `skripte/umzug/dateien.mjs` — Dateien holen, Besitzer zurück; private Eimer mit
   `ALT_SCHLUESSEL` aus der Brücke (ohne ihn warnt das Skript vorher)
5. `skripte/umzug/vergleich.sh` — Zeilen und Rechte alt gegen neu
6. Umschalten (DNS). Die Takt-Aufträge im alten System sind seit dem 23.11.2026
   pausiert (Liste: `takt-vor-dem-umzug.md`). Im neuen bleiben sie aus, bis Daouda
   sie nach der Überarbeitung einzeln wieder anschaltet.
7. Aufräumen: Rolle `pawn_umzug` in der alten Datenbank löschen, die Brücken-Function
   löschen, `/etc/pawn/umzug.env` löschen, den Hetzner-Token widerrufen.

`skripte/umzug/frisch.sh` setzt vor dem Umschalten alles zurück, um den Umzug zu
wiederholen. Nach dem Umschalten (`/etc/pawn/live`) ist es gesperrt.

## Sicherungen

Jede Nacht 3:30: komplette Datenbank (`pg_dump -Fc`) und alle Dateien nach
`/var/lib/pawn/sicherung`, sieben Tage. Empfohlen zusätzlich: Hetzner-Backups
(liegen nicht auf derselben Platte).

## Grenzen, ehrlich

- Ein Server, eine Kopie. Fällt er aus, steht PAWN, bis er wieder läuft oder aus
  einer Sicherung neu aufgesetzt ist (`cloud-init.yaml` + Sicherung = alles).
- Supabase-Updates kommen nicht von allein: neues Release in `einrichten.sh`
  (`SUPABASE_REF`) eintragen und bewusst ausrollen.
