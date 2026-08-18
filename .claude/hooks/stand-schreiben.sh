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

# WICHTIG: geschrieben wird `letzter_verify`, NICHT `letzter_pruefstand`.
#
# Belegt am 2026-08-18: die erste Fassung schrieb die Zahlen von
# `verify.sh schnell` in das Feld `letzter_pruefstand`. Damit ueberschrieb sie
# das Ergebnis der GitHub-Action — aus "1115 bestanden, 16 gefallen" wurde
# "3 bestanden, 0 gefallen", und briefing.sh las das bei jedem Sitzungsstart
# als "Letzter Pruefstand" vor. Zwei verschiedene Messungen teilten sich ein
# Feld, und die kleinere gewann.
#
# Das ist schlimmer als eine fehlende Zahl: eine Bruecke, die eine falsche Zahl
# vorliest, lehrt die naechste Schicht, ihr nicht zu glauben.
#
#   letzter_verify     - was DIESE Maschine messen kann (Typen, Tests,
#                        Regressionen). Schreibt dieses Skript.
#   letzter_pruefstand - was die GitHub-Action gegen die echte Vorschau misst.
#                        Ruehrt dieses Skript NIE an.
NEU=$(jq \
  --arg datum "$HEUTE" \
  --arg zweig "$ZWEIG" \
  --arg b "$BESTANDEN" \
  --arg g "$GEFALLEN" '
  .aktualisiert = $datum
  | .branch = $zweig
  | if $b != "" then .letzter_verify = {datum: $datum, bestanden: ($b|tonumber), gefallen: ($g|tonumber)} else . end
' "$STAND" 2>/dev/null) || exit 0

# Nur schreiben, wenn dabei gueltiges JSON herauskam. Ein halb geschriebener
# Stand ist schlimmer als ein alter.
[ -n "$NEU" ] && echo "$NEU" | jq empty 2>/dev/null && echo "$NEU" > "$STAND"
exit 0
