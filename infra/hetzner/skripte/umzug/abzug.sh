#!/usr/bin/env bash
# Umzug · Schritt 2 — die alte Datenbank vollständig abziehen (nur lesend).
#
# Rollen, Schema, Daten (inkl. Konten, Datei-Verzeichnis, Takt-Aufträge) und
# die Migrations-Historie — mit den pg_dump-Aufrufen des offiziellen
# Supabase-Umzugs (siehe innen-abzug.sh).
#
#   ALT_DB_URL=postgresql://…   optional; sonst wird die Verbindung gesucht
#   bash abzug.sh  →  /opt/pawn/umzug/<zeit>/  (+ Verweis /opt/pawn/umzug/letzter)
set -euo pipefail
source /etc/pawn/umzug.env
REF="${ALT_REF:-rnakubexbqfgfciynqpt}"
BILD="supabase/postgres:17.6.1.136"
HIER="$(cd "$(dirname "$0")" && pwd)"
Z=/opt/pawn/umzug/$(date +%Y%m%d-%H%M%S)
mkdir -p "$Z" && chmod 700 "$Z"

lauf() { docker run --rm --network host -e PGPASSWORD="$UMZUG_PASSWORT" -e PGSSLMODE="${PGSSLMODE:-require}" -e PGCONNECT_TIMEOUT=8 \
  -v "$Z:/u" -v "$HIER:/skripte:ro" "$BILD" "$@"; }

# Verbindung finden: erst direkt (IPv6), dann über den Pooler der Region.
if [ -n "${ALT_DB_URL:-}" ]; then
  KANDIDATEN=("$ALT_DB_URL")
else
  KANDIDATEN=("postgresql://${UMZUG_ROLLE}@db.$REF.supabase.co:5432/postgres")
  for region in eu-central-1 eu-west-1 eu-west-2 eu-west-3 eu-north-1 us-east-1 us-east-2 us-west-1 us-west-2 ap-southeast-1 ap-northeast-1 ca-central-1 sa-east-1; do
    for n in 0 1; do KANDIDATEN+=("postgresql://${UMZUG_ROLLE}.$REF@aws-$n-$region.pooler.supabase.com:5432/postgres"); done
  done
fi
URL=""
for k in "${KANDIDATEN[@]}"; do
  if lauf psql "$k" -tAc 'select 1' >/dev/null 2>&1; then URL="$k"; break; fi
done
[ -n "$URL" ] || { echo "Keine Verbindung zur alten Datenbank. Ist die Rolle angelegt und das Projekt wach?"; exit 1; }
echo "verbunden über: ${URL#*@}"
echo "$URL" > "$Z/.quelle" && chmod 600 "$Z/.quelle"

lauf bash /skripte/innen-abzug.sh "$URL"
chmod 600 "$Z"/*.sql "$Z"/*.txt 2>/dev/null || true
ln -sfn "$Z" /opt/pawn/umzug/letzter
ls -la "$Z"
echo "abzug fertig: $Z"
