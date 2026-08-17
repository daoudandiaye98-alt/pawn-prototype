#!/usr/bin/env bash
# Stop — das Tor.
#
# Gesetz 7: kein „fertig" ohne Ausgabe eines Befehls, der es zeigt.
# Gesetz 6: eine Sitzung, die den Stand nicht fortschreibt, ist nicht fertig.
#
# Das Tor schliesst in genau zwei Faellen:
#   1. Code wurde geaendert und verify.sh schnell ist rot.
#   2. Code wurde geaendert, aber die Urteilsfelder in stand.json sind
#      unveraendert — dann gab es keine Uebergabe.
#
# SCHLEIFENSCHUTZ — Pflicht, sonst baut man eine Endlosschleife.
# Das stdin-JSON traegt `stop_hook_active`. Die Doku (hooks.md, Abschnitt Stop):
#   „The `stop_hook_active` field is `true` when Claude Code is already
#    continuing as a result of a stop hook. Check this value … to avoid blocking
#    on a condition that will never resolve. Claude Code overrides the hook and
#    ends the turn after 8 consecutive blocks."
# Zwei Blockaden hintereinander sind damit unmoeglich: die zweite sieht das Feld
# auf true und laesst sofort durch. Der Deckel von 8 ist der zweite Boden.
#
# ACHTUNG, nachgelesen statt geraten: zwei verbreitete Feldnamen —
# `continued_by_hook` und `continueLoop` — existieren NICHT. Beide wurden mir von
# KI-Quellen genannt, beide standen nicht in der Doku.
#
# Bei unveraenderten Dateien laeuft gar nichts. Sonst kostete jede
# Gespraechsrunde 9 Sekunden, und das Tor waere nach zwei Tagen abgeschaltet.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

EINGABE=$(cat)

# ── Schleifenschutz. Steht zuerst, damit er nichts anderes ueberholen kann.
AKTIV=$(echo "$EINGABE" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")
if [ "$AKTIV" = "true" ]; then
  .claude/hooks/stand-schreiben.sh
  exit 0
fi

GEAENDERT=$(git status --porcelain -- src supabase tools scripts .claude 2>/dev/null | head -50)
if [ -z "$GEAENDERT" ]; then
  .claude/hooks/stand-schreiben.sh
  exit 0
fi

# ── 1. Ist die Wahrheit gruen?
AUSGABE=$(scripts/verify/verify.sh schnell 2>&1)
ENDE=$?
ZEILE=$(echo "$AUSGABE" | grep '^VERIFY:' | tail -1)
BESTANDEN=$(echo "$ZEILE" | sed -n 's/^VERIFY: \([0-9]*\)\/.*/\1/p')
GESAMT=$(echo "$ZEILE" | sed -n 's/^VERIFY: [0-9]*\/\([0-9]*\).*/\1/p')
GEFALLEN=$(( ${GESAMT:-0} - ${BESTANDEN:-0} ))

.claude/hooks/stand-schreiben.sh "${BESTANDEN:-0}" "$GEFALLEN"

if [ $ENDE -ne 0 ]; then
  echo "TOR: die Runde endet nicht bei rotem Stand." >&2
  echo "" >&2
  echo "$AUSGABE" | grep -vE '^──|^$' | tail -30 >&2
  echo "" >&2
  echo "Repariere das, oder sag Daouda ausdruecklich, was rot bleibt und warum." >&2
  echo "Eine Fertigmeldung ueber rotem Stand ist ein Bruch von Gesetz 7." >&2
  exit 2
fi

# ── 2. Gab es eine Uebergabe?
# Verglichen werden nur die Urteilsfelder. aktualisiert/branch/letzter_pruefstand
# schreibt stand-schreiben.sh selbst — die zaehlen nicht als Uebergabe.
URTEIL='{prs: .offene_prs, reihenfolge: .merge_reihenfolge, mensch: .wartet_auf_mensch, zug: .naechster_zug}'
JETZT=$(jq -cS "$URTEIL" .claude/stand.json 2>/dev/null || echo "")
VORHER=$(git show HEAD:.claude/stand.json 2>/dev/null | jq -cS "$URTEIL" 2>/dev/null || echo "")

if [ -n "$VORHER" ] && [ "$JETZT" = "$VORHER" ]; then
  echo "TOR: der Stand wurde nicht fortgeschrieben." >&2
  echo "" >&2
  echo "Diese Sitzung hat Code geaendert, aber .claude/stand.json traegt noch das" >&2
  echo "Urteil der vorigen Schicht: gleiche offenen PRs, gleiche Merge-Reihenfolge," >&2
  echo "gleicher naechster Zug." >&2
  echo "" >&2
  echo "Gesetz 6: jede Sitzung faengt bei null an. Die naechste Schicht sieht nur," >&2
  echo "was in dieser Datei steht. Trag ein, was du geaendert hast und was als" >&2
  echo "naechstes zu tun ist — dann endet die Runde." >&2
  exit 2
fi

echo "TOR: $ZEILE · Stand fortgeschrieben."
exit 0
