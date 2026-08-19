#!/usr/bin/env bash
# Der echte Produktionsbau.
#
# Er prueft keine Typen (das tut tsc.sh), aber er faengt alles, was erst beim
# Buendeln auffaellt: fehlende Importe, kaputte Asset-Pfade, ein Modul, das im
# Browser nicht existiert. Beleg: b540aba.
#
# Das Ergebnis in dist/ ist zugleich das, was sicht.sh in den Browser stellt —
# deshalb laeuft build.sh im vollen Lauf immer VOR sicht.sh.
set -uo pipefail
cd "$(dirname "$0")/../.."

AUSGABE=$(npm run build 2>&1)
ENDE=$?

if [ $ENDE -ne 0 ]; then
  echo "$AUSGABE" | tail -30
  echo "BUILD: 0/1 · FEHLER: Bau gescheitert"
  exit 1
fi

if [ ! -f dist/index.html ]; then
  echo "BUILD: 0/1 · FEHLER: Bau meldete Erfolg, aber dist/index.html fehlt"
  exit 1
fi

GROESSE=$(du -sh dist 2>/dev/null | cut -f1)
echo "  dist/ gebaut · ${GROESSE}"
echo "BUILD: 1/1 · FEHLER: keine"
exit 0
