#!/usr/bin/env bash
# PostToolUse · Edit|Write — der Typfehler faellt sofort auf, nicht im PR.
#
# WICHTIG, weil der Bauauftrag es anders erwartet hat: PostToolUse kann NICHT
# blockieren. Die Doku ist eindeutig (hooks.md, Tabelle „Exit code 2 behavior
# per event"): `PostToolUse | No | Shows stderr to Claude; the tool already ran`.
#
# Dieser Hook ist also keine Sperre, sondern eine SOFORTIGE RUECKMELDUNG: der
# Typfehler steht direkt nach der Aenderung im Kontext, statt zwanzig Schritte
# spaeter im PR. Die Sperre ist tor.sh am Ende der Runde.
#
# Warum das noetig ist: `npm run build` prueft keine Typen, und die CI faehrt
# nur den Pruefstand. Beleg: b540aba „Fixiert Build-Error & Deploy".
#
# ~3 s warm (dank --incremental in tsc.sh). Ohne node_modules oder bei einer
# Datei ausserhalb von src/ passiert gar nichts.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

EINGABE=$(cat)
PFAD=$(echo "$EINGABE" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")

case "$PFAD" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
case "$PFAD" in
  */supabase/functions/*) exit 0 ;;   # Deno, nicht in tsconfig.app.json
  */tools/*) exit 0 ;;
esac
[ -d node_modules ] || exit 0

AUSGABE=$(scripts/verify/tsc.sh 2>&1)
if [ $? -eq 0 ]; then exit 0; fi

echo "TYPFEHLER nach der Aenderung an ${PFAD}:" >&2
echo "$AUSGABE" | grep "error TS" | head -15 >&2
echo "" >&2
echo "Repariere das jetzt, nicht spaeter. tor.sh laesst die Runde sonst nicht enden." >&2
exit 2
