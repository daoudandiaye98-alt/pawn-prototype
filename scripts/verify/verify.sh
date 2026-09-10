#!/usr/bin/env bash
# Die eine Wahrheit.
#
#   verify.sh schnell   Sekunden. Typen, Tests, Regressionen. Fuer den Hook.
#   verify.sh voll      Minuten. Zusaetzlich Bau und Augen. Fuer die Routinen.
#
# Endet IMMER mit einem Code ungleich 0, sobald eine Pruefung gefallen ist.
# Letzte Zeile immer maschinenlesbar:
#   VERIFY: <bestanden>/<gesamt> · FEHLER: <kurzliste>
#
# Der erste `schnell`-Lauf nach `npm ci` dauert ~35 s, weil tsc seinen
# Zwischenstand erst anlegt. Jeder weitere liegt bei ~9 s.
set -uo pipefail
cd "$(dirname "$0")/../.."

MODUS="${1:-schnell}"
case "$MODUS" in
  schnell) PRUEFUNGEN=(tsc tests heft regression) ;;
  voll)    PRUEFUNGEN=(tsc tests heft regression build sicht) ;;
  *) echo "Aufruf: verify.sh [schnell|voll]" >&2; exit 64 ;;
esac

BESTANDEN=0
GEFALLEN=()

fuehre() {
  local name="$1"; shift
  echo "── ${name} ──────────────────────────────────────────"
  if "$@"; then
    BESTANDEN=$((BESTANDEN + 1))
  else
    GEFALLEN+=("$name")
  fi
  echo
}

tests() {
  local ausgabe ende
  ausgabe=$(npm test 2>&1); ende=$?
  if [ $ende -eq 0 ]; then
    echo "  $(echo "$ausgabe" | grep -E '^\s+Tests\s+' | tail -1 | xargs)"
    echo "TESTS: 1/1 · FEHLER: keine"
    return 0
  fi
  echo "$ausgabe" | grep -E "FAIL|✗|×|AssertionError" | head -20
  echo "TESTS: 0/1 · FEHLER: Vitest rot"
  return 1
}

# Die 27 Tests des Hefts laufen unter node:test, nicht unter Vitest — sie kommen
# unveraendert aus dem Prototyp und sollen es bleiben, damit ein Abgleich mit ihm
# eine Sache von `diff` bleibt. Zwei Laeufer, ein Tor.
heft() {
  local ausgabe ende
  ausgabe=$(npm run test:heft 2>&1); ende=$?
  if [ $ende -eq 0 ]; then
    echo "  $(echo "$ausgabe" | grep -E '^# pass' | tail -1 | xargs) von $(echo "$ausgabe" | grep -E '^# tests' | tail -1 | sed 's/# tests //')"
    echo "HEFT: 1/1 · FEHLER: keine"
    return 0
  fi
  echo "$ausgabe" | grep -E "not ok|AssertionError|error:" | head -20
  echo "HEFT: 0/1 · FEHLER: Heft-Tests rot"
  return 1
}

for p in "${PRUEFUNGEN[@]}"; do
  case "$p" in
    tsc)        fuehre tsc        scripts/verify/tsc.sh ;;
    tests)      fuehre tests      tests ;;
    heft)       fuehre heft       heft ;;
    regression) fuehre regression scripts/verify/regression.sh ;;
    build)      fuehre build      scripts/verify/build.sh ;;
    sicht)      fuehre sicht      scripts/verify/sicht.sh ;;
  esac
done

GESAMT=${#PRUEFUNGEN[@]}
LISTE=$(IFS=,; echo "${GEFALLEN[*]:-}")
echo "VERIFY: ${BESTANDEN}/${GESAMT} · FEHLER: ${LISTE:-keine}"
[ ${#GEFALLEN[@]} -eq 0 ] || exit 1
exit 0
