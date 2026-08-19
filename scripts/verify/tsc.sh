#!/usr/bin/env bash
# Typpruefung.
#
# Warum ueberhaupt: `npm run build` prueft KEINE Typen — Vite wirft sie mit SWC
# weg — und die CI faehrt nur den Pruefstand. Ein Typfehler kaeme also durch Bau
# UND CI und fiele erst live auf. Beleg: b540aba „Fixiert Build-Error & Deploy".
#
# Nebenwirkung, die zaehlt: src/lib/i18n.tsx deklariert
# `const en: Record<keyof typeof de, string>`. Ein deutscher Schluessel ohne
# englische Entsprechung ist damit ein TYPFEHLER — aber nur, wenn jemand tsc
# laufen laesst. Genau das tut dieses Skript.
#
# `--incremental`: der erste Lauf braucht ~29 s, jeder weitere ~3 s. Ohne das
# waere der PostToolUse-Hook unbenutzbar. Der Zwischenstand liegt unter
# node_modules/, also ausserhalb des Repos.
set -uo pipefail
cd "$(dirname "$0")/../.."

CACHE="node_modules/.cache/pawn-turm"
mkdir -p "$CACHE"

AUSGABE=$(npx tsc --noEmit -p tsconfig.app.json \
  --incremental --tsBuildInfoFile "$CACHE/tsc.tsbuildinfo" 2>&1)
ENDE=$?

if [ $ENDE -eq 0 ]; then
  echo "TSC: 1/1 · FEHLER: keine"
  exit 0
fi

echo "$AUSGABE" | head -40
ANZAHL=$(echo "$AUSGABE" | grep -c "error TS" || true)
echo "TSC: 0/1 · FEHLER: ${ANZAHL} Typfehler"
exit 1
