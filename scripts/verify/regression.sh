#!/usr/bin/env bash
# Prueft jede Zusage aus .claude/regressionen.json gegen den echten Code.
#
# Die Kontrollen selbst stehen in regressionen.mjs daneben — JavaScript, weil
# TSX-Dateien zu lesen sind und bash daran zerbricht. Dieses Skript ist nur die
# Klinke, damit alle Pruefungen unter einem Dach liegen.
#
# Jede dieser sechs Kontrollen wurde einzeln rot vorgefuehrt. Wer eine neue
# Zusage eintraegt, fuehrt sie ebenso rot vor — sonst ist sie eine Karteileiche.
set -uo pipefail
cd "$(dirname "$0")/../.."
exec node scripts/verify/regressionen.mjs
