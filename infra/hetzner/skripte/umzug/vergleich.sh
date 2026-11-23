#!/usr/bin/env bash
# Umzug · Schritt 5 — Beweis statt Behauptung: Zeilen je Tabelle alt gegen neu.
set -euo pipefail
Z="${1:-/opt/pawn/umzug/letzter}"
[ -s "$Z/zaehlung-alt.txt" ] || { echo "keine Zählung im Abzug ($Z)"; exit 1; }
docker exec -i supabase-db psql -U supabase_admin -d postgres -tA -F '|' > "$Z/zaehlung-neu.txt" <<'SQL'
select format('%I.%I', schemaname, relname) as t,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', schemaname, relname), false, true, '')))[1]::text::bigint
from pg_stat_user_tables
where schemaname in ('public','auth','storage')
order by 1;
SQL
gleich=0; anders=0; fehlt=0
while IFS='|' read -r tabelle alt; do
  [ -z "$tabelle" ] && continue
  case "$tabelle" in auth.schema_migrations|storage.migrations) continue ;; esac  # gehören dem neuen System
  neu=$(grep -F "$tabelle|" "$Z/zaehlung-neu.txt" | head -1 | cut -d'|' -f2)
  if [ -z "$neu" ]; then fehlt=$((fehlt+1)); echo "FEHLT  $tabelle (alt $alt)";
  elif [ "$neu" = "$alt" ]; then gleich=$((gleich+1));
  else anders=$((anders+1)); echo "ANDERS $tabelle alt=$alt neu=$neu"; fi
done < "$Z/zaehlung-alt.txt"
echo "VERGLEICH ZEILEN: $gleich gleich · $anders anders · $fehlt fehlen"

# Rechte: dieselbe Abfrage wie im Abzug, gegen die neue Datenbank — Zeile für Zeile.
rechte_ok=1
if [ -s "$Z/rechte-alt.txt" ]; then
  sed -n '/^psql "\$URL" -tA -F .|. > \$U\/rechte-alt.txt <<.SQL.$/,/^SQL$/p' "$(dirname "$0")/innen-abzug.sh" | sed '1d;$d' \
    | docker exec -i supabase-db psql -U supabase_admin -d postgres -tA -F '|' > "$Z/rechte-neu.txt"
  if diff <(sort "$Z/rechte-alt.txt") <(sort "$Z/rechte-neu.txt") > "$Z/rechte-diff.txt"; then
    echo "VERGLEICH RECHTE: identisch ($(wc -l < "$Z/rechte-alt.txt") Einträge)"
  else
    rechte_ok=0
    echo "VERGLEICH RECHTE: ABWEICHUNG — < alt, > neu:"; head -40 "$Z/rechte-diff.txt"
  fi
fi
[ "$anders" = 0 ] && [ "$fehlt" = 0 ] && [ "$rechte_ok" = 1 ]
