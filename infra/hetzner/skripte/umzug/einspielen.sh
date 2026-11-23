#!/usr/bin/env bash
# Umzug · Schritt 3 — den Abzug in die eigene Datenbank einspielen.
#
# Alles in EINER Transaktion: Rollen, Schema, Daten, Historie, Nachlauf.
# Bricht irgendetwas, bleibt die Datenbank unberührt. Danach sind alle
# Takt-Aufträge AUS — angeschaltet wird erst nach dem Umschalten.
#
#   bash einspielen.sh [ordner]   (Standard: /opt/pawn/umzug/letzter)
set -euo pipefail
Z="${1:-/opt/pawn/umzug/letzter}"
HIER="$(cd "$(dirname "$0")" && pwd)"
STACK=/opt/pawn/stack
ANON_NEU=$(grep '^ANON_KEY=' $STACK/.env | cut -d= -f2-)
SERVICE_NEU=$(grep '^SERVICE_ROLE_KEY=' $STACK/.env | cut -d= -f2-)
API_NEU=$(jq -r .api_url /etc/pawn/oeffentlich.json)
ALT_URL="https://${ALT_REF:-rnakubexbqfgfciynqpt}.supabase.co"

for f in schema.sql daten.sql; do [ -s "$Z/$f" ] || { echo "fehlt: $Z/$f"; exit 1; }; done

VORHANDEN=$(docker exec supabase-db psql -U supabase_admin -d postgres -tAc "select count(*) from pg_tables where schemaname='public'")
if [ "$VORHANDEN" != "0" ] && [ "${NEU_AUFSETZEN:-0}" != "1" ]; then
  echo "In der neuen Datenbank liegen schon $VORHANDEN Tabellen in public."
  echo "Für einen frischen Durchgang: bash $HIER/frisch.sh (setzt die Datenbank zurück) und dann erneut."
  exit 1
fi

# Nachlauf mit den echten Werten füllen (alte Adresse → neue, Takt aus).
sed -e "s#__ALT_URL__#$ALT_URL#g" -e "s#__API_NEU__#$API_NEU#g" -e "s#__ANON_NEU__#$ANON_NEU#g" \
    "$HIER/nachlauf.sql" > "$Z/nachlauf.sql"

{
  echo '\set ON_ERROR_STOP on'
  [ -s "$Z/rollen.sql" ] && cat "$Z/rollen.sql"
  # Die neue Datenbank gibt neuen Tabellen in public automatisch Rechte für anon,
  # authenticated und service_role. Der Abzug kennt diese Automatik nicht — ohne
  # Gegenmaßnahme bekäme anon z. B. die Stripe-Spalten von designers zurück, die
  # im alten System gesperrt waren (gemessen im Probelauf am 23.11.2026).
  # Darum: Automatik für die Dauer des Schemas aus, danach exakt wieder an.
  echo "alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated, service_role, postgres;"
  echo "alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated, service_role, postgres;"
  echo "alter default privileges for role supabase_admin in schema public revoke all on functions from anon, authenticated, service_role, postgres;"
  cat "$Z/schema.sql"
  echo "alter default privileges for role supabase_admin in schema public grant all on tables to anon, authenticated, service_role, postgres;"
  echo "alter default privileges for role supabase_admin in schema public grant all on sequences to anon, authenticated, service_role, postgres;"
  echo "alter default privileges for role supabase_admin in schema public grant all on functions to anon, authenticated, service_role, postgres;"
  cat "$Z/daten.sql"
  [ -s "$Z/historie.sql" ] && cat "$Z/historie.sql"
  [ -s "$Z/cron.sql" ] && cat "$Z/cron.sql"
  cat "$Z/nachlauf.sql"
} | docker exec -i supabase-db psql -U supabase_admin -d postgres --single-transaction -v ON_ERROR_STOP=1 -q 2>&1 | tail -25

echo "eingespielt aus $Z"
# PostgREST kennt das neue Schema erst nach einem Neuladen.
docker exec supabase-db psql -U supabase_admin -d postgres -tAc "notify pgrst, 'reload schema'" >/dev/null
pawn-compose restart rest storage realtime >/dev/null 2>&1 || true
echo "fertig"
