#!/usr/bin/env bash
# PreToolUse · Bash — die Wache.
#
# Gesetz 3: was immer gelten muss, wird ein Hook. Vier Regeln standen bisher als
# Prosa in CLAUDE.md — Prosa ist eine Bitte. Hier werden sie Gesetz:
#
#   1. kein rekursives Loeschen ganzer Baeume
#   2. kein erzwungener Push auf den Hauptzweig
#   3. kein Zuruecksetzen der Datenbank
#   4. keine geloeschte Migration, kein geloeschtes vercel.json
#
# PAWN ist live und nimmt echte Stripe-Zahlungen. Jeder dieser Befehle ist
# unumkehrbar teuer.
#
# Exit 2 blockiert den Werkzeugaufruf; der Grund gehoert auf stderr und wird
# Claude gezeigt. Exit 1 wuerde NICHTS blockieren und nur protokolliert werden —
# das ist die haeufigste Falle bei Hooks. Hier steht deshalb ueberall 2.
set -uo pipefail

EINGABE=$(cat)
BEFEHL=$(echo "$EINGABE" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
[ -z "$BEFEHL" ] && exit 0

# Ein Zeilenumbruch oder ein `;` trennt Befehle — deshalb wird der ganze String
# geprueft, nicht nur sein Anfang. Ein `git push --force` hinter einem `&&`
# ist derselbe Push.
verweigere() {
  echo "WACHE: $1" >&2
  echo "" >&2
  echo "Befehl: ${BEFEHL:0:200}" >&2
  echo "" >&2
  echo "$2" >&2
  exit 2
}

# 1 — rekursives Loeschen
if echo "$BEFEHL" | grep -qE '\brm\b[^|;&]*-[a-zA-Z]*[rR][a-zA-Z]*f|\brm\b[^|;&]*-[a-zA-Z]*f[a-zA-Z]*[rR]'; then
  verweigere "rekursives, erzwungenes Loeschen" \
    "Loesche einzelne Dateien mit vollem Pfad, oder frag Daouda. Ein rm -rf im falschen Verzeichnis ist nicht ruecknehmbar."
fi

# 2 — erzwungener Push auf den Hauptzweig
if echo "$BEFEHL" | grep -qE '\bgit\b.*\bpush\b' && echo "$BEFEHL" | grep -qE '(--force|--force-with-lease|[[:space:]]-f\b)'; then
  if echo "$BEFEHL" | grep -qE '\b(main|master)\b'; then
    verweigere "erzwungener Push auf den Hauptzweig" \
      "main traegt die veroeffentlichte Seite: Lovable synct von dort, Vercel spiegelt auf pawn.vision. Ein erzwungener Push dort verliert Geschichte, die live ist."
  fi
fi

# 3 — Datenbank zuruecksetzen
if echo "$BEFEHL" | grep -qE '\bsupabase\b.*\b(db[[:space:]]+reset|reset)\b|\bDROP[[:space:]]+(TABLE|SCHEMA|DATABASE)\b|\bTRUNCATE\b'; then
  verweigere "Zugriff, der Produktionsdaten vernichtet" \
    "Die Datenbank ist die echte Produktionsdatenbank (Projekt rnakubexbqfgfciynqpt) mit echten Bestellungen. Schema-Aenderungen laufen als Migration ueber den Lovable-Agenten, nie von hier."
fi

# 4 — Migrationen und die SPA-Weiterleitung
if echo "$BEFEHL" | grep -qE '\b(rm|git[[:space:]]+rm|unlink|mv)\b[^|;&]*supabase/migrations'; then
  verweigere "eine Migration soll verschwinden" \
    "Migrationen sind die Geschichte der Datenbank. Eine geloeschte Migration laesst sich nicht rekonstruieren. Schreibe eine NEUE Migration, die zuruecknimmt, was die alte tat."
fi
if echo "$BEFEHL" | grep -qE '\b(rm|git[[:space:]]+rm|unlink|mv)\b[^|;&]*vercel\.json'; then
  verweigere "vercel.json soll verschwinden" \
    "Darin steht die SPA-Weiterleitung. Ohne sie antwortet jede Unterseite von pawn.vision mit 404."
fi

exit 0
