#!/usr/bin/env bash
# SessionStart — die Bruecke.
#
# Gesetz 6: jede Sitzung faengt bei null an. Ohne Uebergabe arbeitet jede
# Schicht blind. Dieser Hook legt .claude/stand.json in den Kontext, bevor der
# erste Satz fällt.
#
# Warum das hier ueberhaupt geht: bei SessionStart wird einfacher Text von
# stdout als Kontext uebernommen, den Claude sehen und benutzen kann
# (code.claude.com/docs/en/hooks.md, „Exit code 0"). Bei fast allen anderen
# Ereignissen landet stdout nur im Debug-Log.
#
# SessionStart kann NICHT blockieren. Exit 2 zeigt hier nur stderr an. Deshalb
# endet dieses Skript immer mit 0 — ein fehlender Stand ist kein Grund, eine
# Sitzung zu verhindern, nur ein Grund, es zu sagen.
#
# Die Marke im Log beantwortet die offene Frage aus dem Bauauftrag: feuern
# committete Projekt-Hooks auch in einer Cloud-Routine? Nach dem ersten
# Routinelauf steht die Antwort in .claude/hook-lauf.log.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

EINGABE=$(cat)
QUELLE=$(echo "$EINGABE" | jq -r '.source // "unbekannt"' 2>/dev/null || echo "unbekannt")
mkdir -p .claude
echo "$(date -Iseconds) briefing.sh source=${QUELLE} cwd=$(pwd)" >> .claude/hook-lauf.log

if [ ! -f .claude/stand.json ]; then
  echo "WO WIR STEHEN: .claude/stand.json fehlt. Lege ihn an, bevor du die Runde beendest."
  exit 0
fi

echo "══ WO WIR STEHEN (aus .claude/stand.json) ══"
jq -r '
  "Stand vom \(.aktualisiert) · Zweig \(.branch)",
  "",
  "Offene PRs:",
  (if (.offene_prs | length) == 0 then "  keine"
   else (.offene_prs[] | "  #\(.nr) \(.titel)\n      Status: \(.status)\n      Blockiert durch: \(.blockiert_durch)")
   end),
  "",
  "Merge-Reihenfolge:",
  (if (.merge_reihenfolge | length) == 0 then "  offen" else (.merge_reihenfolge[] | "  · \(.)") end),
  "",
  "Wartet auf einen Menschen:",
  (if (.wartet_auf_mensch | length) == 0 then "  nichts" else (.wartet_auf_mensch[] | "  · \(.)") end),
  "",
  "Letzter verify.sh hier: \(.letzter_verify.datum // "nie") — \(.letzter_verify.bestanden // "?") von \(((.letzter_verify.bestanden // 0) + (.letzter_verify.gefallen // 0))) bestanden",
  "Letzter Pruefstand (GitHub-Action, echte Vorschau): \(.letzter_pruefstand.datum // "nie") — \(.letzter_pruefstand.bestanden // "?") bestanden, \(.letzter_pruefstand.gefallen // "?") gefallen",
  (if (.nicht_pruefbar // []) | length > 0 then "", "NICHT PRUEFBAR:", (.nicht_pruefbar[] | "  · \(.)") else empty end),
  "",
  "NAECHSTER ZUG: \(.naechster_zug)"
' .claude/stand.json 2>/dev/null || cat .claude/stand.json

echo ""
echo "Diese Sitzung ist erst fertig, wenn .claude/stand.json fortgeschrieben ist."
echo "══════════════════════════════════════════"
exit 0
