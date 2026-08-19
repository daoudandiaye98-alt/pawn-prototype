#!/usr/bin/env bash
# PreToolUse · Read|Edit|Write — die Geheimnisse.
#
# Belegter Anlass, heute nachgemessen: `.env` LIEGT im Git und steht NICHT in
# .gitignore. Heute enthaelt sie nur oeffentliche VITE_-Werte — aber die Regel
# „nie in .env committen" aus CLAUDE.md ist blosse Prosa. Ein einziger
# unachtsamer Schreibvorgang legt STRIPE_SECRET_KEY dauerhaft in die
# Git-Geschichte. Das laesst sich nicht zurueckholen.
#
# Gesetz 3: aus der Bitte wird ein Gesetz.
#
# Lesen wird ebenso blockiert wie Schreiben. Ein Geheimnis, das der Agent
# gelesen hat, steht in seinem Kontext — und damit im Transkript.
set -uo pipefail

EINGABE=$(cat)
PFAD=$(echo "$EINGABE" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null || echo "")
[ -z "$PFAD" ] && exit 0

BASIS=$(basename "$PFAD")

geschuetzt=0
case "$BASIS" in
  .env|.env.*|*.pem|*.key|*.p12|*.pfx|id_rsa|id_ed25519|credentials|.netrc|.pgpass) geschuetzt=1 ;;
esac
case "$PFAD" in
  *.aws/credentials*|*.ssh/id_*|*.config/gcloud/*|*service-account*.json) geschuetzt=1 ;;
esac
# .env.example ist Vorlage ohne Werte und ausdruecklich erlaubt.
case "$BASIS" in
  .env.example|.env.sample|.env.template) geschuetzt=0 ;;
esac

if [ "$geschuetzt" -eq 1 ]; then
  echo "GEHEIMNISSE: Zugriff auf ${PFAD} blockiert." >&2
  echo "" >&2
  echo "Die echten Geheimnisse von PAWN (STRIPE_SECRET_KEY, FAL_KEY, OPENAI_API_KEY," >&2
  echo "ANTHROPIC_API_KEY, STRIPE_WEBHOOK_SECRET) liegen ausschliesslich in" >&2
  echo "Lovable/Supabase. Sie gehoeren nie in eine Datei dieses Repos und nie in" >&2
  echo "deinen Kontext." >&2
  echo "" >&2
  echo "Brauchst du einen Wert, frag Daouda — er setzt ihn in Lovable." >&2
  exit 2
fi

exit 0
