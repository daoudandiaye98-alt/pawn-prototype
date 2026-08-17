#!/usr/bin/env bash
# PreCompact — die Rettung.
#
# Wird der Kontext komprimiert, ueberlebt nur eine Zusammenfassung. Was in
# .claude/stand.json steht, ueberlebt vollstaendig — es ist eine Datei, kein
# Gedaechtnis (Gesetz 6). Dieser Hook sichert den mechanischen Teil, BEVOR
# komprimiert wird, und erinnert an den Rest.
#
# PreCompact KANN blockieren (Exit 2 verhindert die Komprimierung). Das waere
# hier falsch: eine verhinderte Komprimierung fuehrt zu einem vollen
# Kontextfenster, nicht zu besserer Arbeit. Deshalb immer Exit 0.
#
# Es ruft dasselbe Schreibskript wie tor.sh. Ein eigener Rettungs-Mechanismus
# waere ein zweiter Weg zum selben Ziel — und damit ein zweiter Weg, der
# auseinanderlaufen kann.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

EINGABE=$(cat)
GRUND=$(echo "$EINGABE" | jq -r '.trigger // "unbekannt"' 2>/dev/null || echo "unbekannt")

.claude/hooks/stand-schreiben.sh
mkdir -p .claude
echo "$(date -Iseconds) rettung.sh trigger=${GRUND}" >> .claude/hook-lauf.log

OFFEN=$(git status --porcelain -- src supabase tools scripts 2>/dev/null | wc -l | tr -d ' ')
echo "RETTUNG: Stand gesichert vor der Komprimierung (${GRUND}). ${OFFEN} geaenderte Dateien offen."
echo "Nach der Komprimierung zuerst .claude/stand.json lesen — dort steht, wo wir stehen."
exit 0
