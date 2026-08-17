#!/usr/bin/env bash
# Schreibt die mechanischen Felder von .claude/stand.json fort.
#
# EIN Skript, zwei Aufrufer: tor.sh (Ende der Runde) und rettung.sh (bevor der
# Kontext komprimiert wird). Der Bauauftrag sah dafuer zwei getrennte Skripte
# vor — sie taeten dasselbe. Weniger ist das Ziel.
#
# Es schreibt nur, was eine Maschine wissen kann: Datum, Zweig, letztes
# Pruefergebnis. Die Urteilsfelder — offene_prs, merge_reihenfolge,
# wartet_auf_mensch, naechster_zug — fasst es NIE an. Die gehoeren dem Agenten;
# ein Skript, das sie ueberschreibt, loescht die Uebergabe, statt sie zu bauen.
#
# Aufruf: stand-schreiben.sh [bestanden] [gefallen]
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

STAND=".claude/stand.json"
[ -f "$STAND" ] || exit 0

BESTANDEN="${1:-}"
GEFALLEN="${2:-}"
ZWEIG=$(git branch --show-current 2>/dev/null || echo "unbekannt")
HEUTE=$(date +%Y-%m-%d)

NEU=$(jq \
  --arg datum "$HEUTE" \
  --arg zweig "$ZWEIG" \
  --arg b "$BESTANDEN" \
  --arg g "$GEFALLEN" '
  .aktualisiert = $datum
  | .branch = $zweig
  | if $b != "" then .letzter_pruefstand = {datum: $datum, bestanden: ($b|tonumber), gefallen: ($g|tonumber)} else . end
' "$STAND" 2>/dev/null) || exit 0

# Nur schreiben, wenn dabei gueltiges JSON herauskam. Ein halb geschriebener
# Stand ist schlimmer als ein alter.
[ -n "$NEU" ] && echo "$NEU" | jq empty 2>/dev/null && echo "$NEU" > "$STAND"
exit 0
