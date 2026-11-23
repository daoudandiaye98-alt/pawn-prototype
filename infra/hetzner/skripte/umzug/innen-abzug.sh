#!/usr/bin/env bash
# Läuft IM Postgres-Container (supabase/postgres:17.6.1.136), gestartet von abzug.sh.
# Die pg_dump-Aufrufe entsprechen `supabase db dump --dry-run` (CLI 2.123),
# ohne `--role postgres` (wir lesen mit der befristeten Rolle pawn_umzug).
#   $1 = Verbindungs-URL (Passwort kommt über PGPASSWORD)
set -euo pipefail
URL="$1"
U=/u

AUS='information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault'
AUS_DATEN='information_schema|pg_*|graphql|graphql_public|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault|etl|extensions|pgbouncer|realtime|supabase_migrations|_analytics|_realtime|_supavisor|net'
RESERVIERT='anon|authenticated|authenticator|cli_login_.*|dashboard_user|pgbouncer|postgres|service_role|supabase_.*|pgsodium_keyholder|pgsodium_keyiduser|pgsodium_keymaker|pgtle_admin|pawn_umzug'

psql "$URL" -tAc "select 'alt: ' || version()"

echo "· Rollen"
pg_dumpall -d "$URL" --roles-only --quote-all-identifier --no-role-passwords --no-comments 2>/dev/null \
  | grep -vE "\"($RESERVIERT)\"" \
  | grep -vE '^(\\(un)?restrict|SET |--)' > $U/rollen.sql || true

echo "· Schema"
pg_dump "$URL" --schema-only --quote-all-identifier --exclude-schema "$AUS" \
| sed -E 's/^\\(un)?restrict .*$/-- &/' \
| sed -E 's/^CREATE SCHEMA "/CREATE SCHEMA IF NOT EXISTS "/' \
| sed -E 's/^CREATE TABLE "/CREATE TABLE IF NOT EXISTS "/' \
| sed -E 's/^CREATE SEQUENCE "/CREATE SEQUENCE IF NOT EXISTS "/' \
| sed -E 's/^CREATE VIEW "/CREATE OR REPLACE VIEW "/' \
| sed -E 's/^CREATE FUNCTION "/CREATE OR REPLACE FUNCTION "/' \
| sed -E 's/^CREATE TRIGGER "/CREATE OR REPLACE TRIGGER "/' \
| sed -E 's/^CREATE PUBLICATION "supabase_realtime/-- &/' \
| sed -E 's/^CREATE EVENT TRIGGER /-- &/' \
| sed -E 's/^         WHEN TAG IN /-- &/' \
| sed -E 's/^   EXECUTE FUNCTION /-- &/' \
| sed -E 's/^ALTER EVENT TRIGGER /-- &/' \
| sed -E 's/^ALTER PUBLICATION "supabase_realtime_/-- &/' \
| sed -E 's/^ALTER FOREIGN DATA WRAPPER (.+) OWNER TO /-- &/' \
| sed -E 's/^ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"/-- &/' \
| sed -E 's/^GRANT ALL ON FOREIGN DATA WRAPPER (.+) TO "postgres" WITH GRANT OPTION/-- &/' \
| sed -E "s/^GRANT (.+) ON (.+) \"($AUS)\"/-- &/" \
| sed -E "s/^REVOKE (.+) ON (.+) \"($AUS)\"/-- &/" \
| sed -E 's/^(CREATE EXTENSION IF NOT EXISTS "pg_tle").+/\1;/' \
| sed -E 's/^(CREATE EXTENSION IF NOT EXISTS "pgsodium").+/\1;/' \
| sed -E 's/^(CREATE EXTENSION IF NOT EXISTS "pgmq").+/\1;/' \
| sed -E 's/^COMMENT ON EXTENSION (.+)/-- &/' \
| sed -E 's/^CREATE POLICY "cron_job_/-- &/' \
| sed -E 's/^ALTER TABLE "cron"/-- &/' \
| sed -E 's/^SET transaction_timeout = 0;/-- &/' \
| sed -E '/^--/d' > $U/schema.sql

echo "· Daten"
{
  echo "SET session_replication_role = replica;"
  pg_dump "$URL" --data-only --quote-all-identifier \
    --exclude-schema "$AUS_DATEN" \
    --exclude-table "auth.schema_migrations" --exclude-table "storage.migrations" --exclude-table "supabase_functions.migrations" \
    --schema '*' \
  | sed -E 's/^\\(un)?restrict .*$/-- &/'
  echo "RESET ALL;"
} > $U/daten.sql

echo "· Migrations-Historie"
{ echo 'CREATE SCHEMA IF NOT EXISTS "supabase_migrations";'
pg_dump "$URL" --quote-all-identifier --no-owner --no-privileges --table 'supabase_migrations.schema_migrations' 2>/dev/null \
| sed -E 's/^\\(un)?restrict .*$/-- &/' \
| sed -E 's/^CREATE SCHEMA "/CREATE SCHEMA IF NOT EXISTS "/' \
| sed -E 's/^CREATE TABLE "/CREATE TABLE IF NOT EXISTS "/'; } > $U/historie.sql || echo "  (keine Historie lesbar)"

echo "· Takt-Aufträge (pg_dump nimmt sie nicht mit — sie gehören zur Erweiterung pg_cron)"
psql "$URL" -tA -c "select format('select cron.schedule(%L, %L, %L); update cron.job set username = %L, active = false where jobname = %L;',
    coalesce(jobname, 'pawn-takt-' || jobid), schedule, command, username, coalesce(jobname, 'pawn-takt-' || jobid))
  from cron.job order by jobid" > $U/cron.sql

echo "· Datei-Eimer, Vault-Namen (zur Ansicht)"
psql "$URL" -tA -F '|' -c "select jobid, jobname, schedule, active, left(regexp_replace(command, '\s+', ' ', 'g'), 400) from cron.job order by jobid" > $U/cron-uebersicht.txt 2>&1 || true
psql "$URL" -tA -F '|' -c "select b.id, b.public, count(o.id), coalesce(sum((o.metadata->>'size')::bigint),0) from storage.buckets b left join storage.objects o on o.bucket_id=b.id group by 1,2 order by 1" > $U/eimer.txt 2>&1 || true
psql "$URL" -tAc "select coalesce(string_agg(name, ','), '') from vault.secrets" > $U/vault-namen.txt 2>&1 || echo "(vault nicht lesbar)" > $U/vault-namen.txt

echo "· Rechte (Tabellen, Spalten, Funktionen) für den Vergleich"
psql "$URL" -tA -F '|' > $U/rechte-alt.txt <<'SQL'
select 'tabelle', c.relname, '', coalesce(regexp_replace(c.relacl::text, '/[a-z_]+', '', 'g'), '')
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','v','m','S','p')
union all
select 'spalte', a.attrelid::regclass::text, a.attname, regexp_replace(a.attacl::text, '/[a-z_]+', '', 'g')
  from pg_attribute a join pg_class c on c.oid = a.attrelid
  where c.relnamespace = 'public'::regnamespace and a.attacl is not null and not a.attisdropped
union all
select 'funktion', p.proname, pg_get_function_identity_arguments(p.oid), coalesce(regexp_replace(p.proacl::text, '/[a-z_]+', '', 'g'), 'STANDARD')
  from pg_proc p where p.pronamespace = 'public'::regnamespace
union all
select 'rls', c.relname, '', c.relrowsecurity::text || '/' || c.relforcerowsecurity::text
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
union all
select 'policy', tablename, policyname, cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '')
  from pg_policies where schemaname = 'public'
order by 1, 2, 3;
SQL

echo "· Genaue Zählung je Tabelle"
psql "$URL" -tA -F '|' > $U/zaehlung-alt.txt <<'SQL'
select format('%I.%I', schemaname, relname) as t,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', schemaname, relname), false, true, '')))[1]::text::bigint
from pg_stat_user_tables
where schemaname in ('public','auth','storage')
order by 1;
SQL
echo "fertig"
