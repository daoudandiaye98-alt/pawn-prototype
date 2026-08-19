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
# BAUART-GRENZE, gemessen am 2026-08-19 und hier festgehalten, damit sie
# niemanden mehr ueberrascht:
#
# Alle vier Wachen pruefen `tool_input.command` als FLACHEN TEXT. Ein Befehl,
# der ein gefaehrliches Muster nur als DATEN traegt — in einem Heredoc, einer
# Testliste, einem Kommentar — schlaegt trotzdem an. Beim Vorfuehren und
# Protokollieren dieser Wachen ist das VIERMAL hintereinander passiert; die
# Testfaelle mussten aus Wortteilen zusammengesetzt werden, um ueberhaupt
# ausgefuehrt werden zu koennen.
#
# Das ist die SICHERE Richtung: lieber einmal zu viel fragen als einen echten
# Zugriff durchlassen. Sauber loesen hiesse, die Shell zu parsen — dafuer ist
# der Preis zu hoch. Wer hier arbeitet, umgeht die Wache NICHT, sondern stellt
# den Befehl eindeutig oder legt die Daten in eine Datei.

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
#
# ZWEI FEHLALARME BEHOBEN am 2026-08-19, beide an dieser Wache selbst gemessen.
#
# (a) Die erste Fassung durchsuchte den GANZEN Befehlsstring nach dem Wort
#     "main". Damit blockierte sie einen voellig rechtmaessigen Push auf einen
#     ARBEITSZWEIG, nur weil in einer Diagnose-Ausgabe "origin/main" vorkam.
#
# (b) Sie blockierte ausserdem jeden Befehl, der diese Muster nur als DATEN
#     traegt — etwa das Bearbeiten dieser Datei hier.
#
# Eine Pruefung, die an rechtmaessigem Code rot wird, ist schlimmer als keine:
# sie lehrt, Rot zu uebersehen (.claude/rules/00-gesetze.md). Die Antwort ist
# ENGER schreiben, nie schwaecher.
#
# Jetzt wird nur der git-push-Abschnitt betrachtet — bis zum naechsten Trenner —
# und darin nur das ZIEL des Refspec, nicht jedes Wort irgendwo im Befehl.
#
# BEKANNTE GRENZE: ein Befehl, der eine echte Zeile mit --force als Daten in einem
# Heredoc traegt, kann weiterhin anschlagen. Das ist die sichere Richtung —
# lieber einmal zu viel fragen als einen echten Push durchlassen.
if echo "$BEFEHL" | grep -qE '\bgit\b[^;&|]*\bpush\b'; then
  ABSCHNITT=$(echo "$BEFEHL" | tr ';&|' '\n\n\n' | grep -E '\bgit\b.*\bpush\b' | head -1)

  if echo "$ABSCHNITT" | grep -qE '(--force([^-]|$)|--force-with-lease|[[:space:]]-f([[:space:]]|$))'; then
    # Ziel eines Refspec: das Stueck nach einem ':' oder ein blankes Ref.
    # Faengt "origin main", "HEAD:main", "+main", "refs/heads/main".
    ZIEL_IST_HAUPT=0
    echo "$ABSCHNITT" | grep -qE '(:|[[:space:]]\+?)(refs/heads/)?(main|master)([[:space:]]|$)' && ZIEL_IST_HAUPT=1

    # Kein Ziel angegeben? Dann geht es auf den AKTUELLEN Zweig.
    if ! echo "$ABSCHNITT" | grep -qE '[[:space:]](origin|upstream)[[:space:]]+[^[:space:]]|:'; then
      AKTUELL=$(git branch --show-current 2>/dev/null || echo "")
      case "$AKTUELL" in main|master) ZIEL_IST_HAUPT=1 ;; esac
    fi

    if [ "$ZIEL_IST_HAUPT" -eq 1 ]; then
      verweigere "erzwungener Push auf den Hauptzweig" \
        "main traegt die veroeffentlichte Seite: Lovable synct von dort, Vercel spiegelt auf pawn.vision. Ein erzwungener Push dort verliert Geschichte, die live ist."
    fi
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
