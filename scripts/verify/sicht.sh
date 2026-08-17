#!/usr/bin/env bash
# Gesetz 4 — gib dem Agenten Augen.
#
# Stellt den gebauten Stand in einen echten Browser und legt Aufnahmen ab.
# Vier Seiten (Halle, Boutique, Werk, Haus) auf vier Breiten (390, 768, 1280,
# 1920) landen als PNG unter .claude/sicht/<datum>/.
#
# WARUM KEIN PLAYWRIGHT-MCP: tools/pruefstand/ faehrt Playwright bereits selbst
# und schreibt bereits Aufnahmen (Kontrolle 3.7). Ein MCP-Server haette dessen
# Werkzeugbeschreibungen in JEDE Sitzung gelegt und ein laufendes Werkzeug
# verdoppelt. Weniger ist das Ziel — dieses Skript ruft, was schon da ist.
#
# WICHTIG: Aufnahmen zu erzeugen ist die halbe Sache. Der Agent muss sie
# ANSEHEN, bevor er behauptet, etwas sehe gut aus. Die Pfade werden deshalb am
# Ende einzeln ausgegeben.
#
# Belegte Fehler dahinter: 414a31a (acht gefallene Gates bei Trefferflaechen),
# b517fa1 (19 Stellen ohne sichtbaren Tastatur-Rahmen) — beides nur am Bild zu
# sehen, nie im Quelltext.
set -uo pipefail
cd "$(dirname "$0")/../.."

SEITEN="${SICHT_SEITEN:-halle,boutique,werk,haus}"
BREITEN="${SICHT_BREITEN:-390,768,1280,1920}"
PORT="${SICHT_PORT:-4173}"
DATUM=$(date +%Y-%m-%d)
ZIEL=".claude/sicht/${DATUM}"

# Chromium: erst die gesetzte Variable, dann die Container-Ablage, dann
# Playwrights eigener Fund. Ohne Browser gibt es keine Augen — dann sagen wir
# das, statt einen leeren Ordner als Erfolg zu verkaufen.
if [ -z "${PRUEFSTAND_CHROMIUM:-}" ]; then
  FUND=$(find /opt/pw-browsers -maxdepth 4 -type f -name chrome 2>/dev/null | head -1)
  [ -n "$FUND" ] && export PRUEFSTAND_CHROMIUM="$FUND"
fi

if [ ! -f dist/index.html ]; then
  echo "  kein dist/ — erst scripts/verify/build.sh"
  echo "SICHT: 0/1 · FEHLER: nichts zu zeigen, dist fehlt"
  exit 1
fi

# Vorschau-Server im Hintergrund. `trap` raeumt ihn in jedem Fall weg, auch
# wenn der Pruefstand abstuerzt — sonst bleibt der Port belegt und der naechste
# Lauf misst den alten Stand.
# `--host 127.0.0.1` ist Pflicht, nicht Geschmack: ohne das bindet Vite auf ::
# und stirbt in Umgebungen ohne IPv6 mit EAFNOSUPPORT. Gemessen in genau diesem
# Container.
npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/tmp/sicht-preview.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 && break
  sleep 1
done
if ! curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  tail -10 /tmp/sicht-preview.log
  echo "SICHT: 0/1 · FEHLER: Vorschau-Server auf Port ${PORT} kam nicht hoch"
  exit 1
fi

rm -rf tools/pruefstand/artefakte
npx tsx tools/pruefstand/lauf.ts --ziel lokal --seiten "$SEITEN" --breiten "$BREITEN" \
  >/tmp/sicht-lauf.log 2>&1
LAUF=$?

mkdir -p "$ZIEL"
ANZAHL=0
if compgen -G "tools/pruefstand/artefakte/*.png" >/dev/null; then
  cp tools/pruefstand/artefakte/*.png "$ZIEL/" 2>/dev/null || true
  ANZAHL=$(ls -1 "$ZIEL"/*.png 2>/dev/null | wc -l | tr -d ' ')
fi
[ -f tools/pruefstand/artefakte/bericht.json ] && cp tools/pruefstand/artefakte/bericht.json "$ZIEL/"

if [ "$ANZAHL" -eq 0 ]; then
  tail -20 /tmp/sicht-lauf.log
  echo "SICHT: 0/1 · FEHLER: keine einzige Aufnahme entstanden (Pruefstand Exit ${LAUF})"
  exit 1
fi

echo "  ${ANZAHL} Aufnahmen in ${ZIEL}/ — ANSEHEN, nicht nur zaehlen:"
ls -1 "$ZIEL"/*.png | sed 's|^|    |'
echo "SICHT: 1/1 · FEHLER: keine"
exit 0
