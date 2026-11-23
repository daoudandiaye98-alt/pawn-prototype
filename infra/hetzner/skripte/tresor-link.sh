#!/usr/bin/env bash
# Erzeugt einen Einmal-Link zum Tresor (48 Stunden gültig). Gespeichert wird nur
# der Hash des Links — wer die Datei liest, kann damit nichts öffnen.
set -euo pipefail
DOMAIN=$(cat /etc/pawn/domain 2>/dev/null || echo pawn.vision)
TOKEN=$(openssl rand -base64 33 | tr '+/' '-_' | tr -d '=')
HASH=$(printf %s "$TOKEN" | sha256sum | cut -d' ' -f1)
BIS=$(date -u -d '+48 hours' +%Y-%m-%dT%H:%M:%SZ)
D=/etc/pawn/tresor-links.json
[ -f $D ] || echo '[]' > $D
jq --arg h "$HASH" --arg b "$BIS" '[.[] | select(.bis > (now | todate))] + [{hash:$h, bis:$b}]' $D > $D.neu && mv $D.neu $D
chmod 600 $D
echo "https://api.$DOMAIN/_tresor?t=$TOKEN"
