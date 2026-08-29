#!/usr/bin/env bash
# Mentor-Gate: Läuft vor der Blockade-Phase ein Mentor-Lauf (ADR 0008)?
#
# WARUM: Ein schwaches Modell in der Review→Fixup-Schleife wiederholt denselben Versuch,
# bis der Rundendeckel es an den Menschen übergibt (#932: 10 Review- + 4 Fixup-Läufe,
# 34,5 Mio Token). Ein einmaliger, teurer Rat ist billiger als eine weitere Runde — aber
# der Auslöser muss DETERMINISTISCH außerhalb des blockierten Modells liegen: ein
# „ruf bei Blockade selbst an"-Instrukt würde genau von dem Modell ignoriert, das
# blockiert ist. Deshalb entscheidet die Pipeline an Signalen, die sie ohnehin zählt.
#
# Reine Entscheidungstabelle über Inputs — bewusst KEIN gh, kein Netz: Die Signale
# liefert der Aufrufer (fixup-rounds.sh im Stop-Guard, resolve-escalation.sh im
# precheck), dieses Skript macht daraus run=true|false. Damit ist es trivial testbar
# (mentor-gate.test.ts, `pnpm test:scripts`).
#
# Auslöser (ADR 0008, je genau einmal pro Job):
#   fixup     — rounds >= 2: ab der zweiten Review→Fixup-Runde. Runde 1 darf noch
#               ohne Rat laufen (normale Nacharbeit), ab Runde 2 liegt ein Muster vor.
#   implement — escalated=true: Wiederholungslauf nach Soft-Abort (ai:continued).
#
# Usage:
#   bash mentor-gate.sh check --mode <fixup|implement> [--rounds <n>] [--escalated true|false]
#
# Ausgabe (stdout, key=value):
#   run=true|false
#   reason=<einzeiliger Klartext>
set -uo pipefail

CMD="${1:-}"
[ $# -gt 0 ] && shift

MODE=""
ROUNDS=""
ESCALATED="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)     MODE="$2";     shift 2 ;;
    --rounds)   ROUNDS="$2";   shift 2 ;;
    --escalated) ESCALATED="$2"; shift 2 ;;
    *) echo "mentor-gate: unbekanntes Argument: $1" >&2; exit 2 ;;
  esac
done

case "$CMD" in
  check) ;;
  *) echo "mentor-gate: Unbekannter Sub-Befehl: '${CMD}' (erwartet: check)" >&2; exit 2 ;;
esac

emit() {
  echo "run=$1"
  # reason nur einzeilig (gleiche Leine wie fixup-rounds.sh — kein Injection-Pfad in Outputs).
  printf 'reason=%s\n' "$(printf '%s' "$2" | tr -d '\n\r')"
  exit 0
}

case "$MODE" in
  fixup)
    # Runden kommen vom Stop-Guard (fixup-rounds.sh). Ungültig/leer = 0 behandeln:
    # fail-open — ohne Zählung läuft die Phase normal, genau wie ohne Mentor.
    if ! [[ "${ROUNDS:-}" =~ ^[0-9]+$ ]]; then
      emit "false" "Runden nicht zählbar ('${ROUNDS:-leer}') — kein Mentor, Phase läuft ohne Rat (fail-open)."
    fi
    if [ "$ROUNDS" -ge 2 ]; then
      emit "true" "Fixup-Runde ${ROUNDS} — ab der zweiten Runde läuft der Mentor-Vorlauf (ADR 0008)."
    fi
    emit "false" "Fixup-Runde ${ROUNDS} — noch kein Muster, kein Mentor."
    ;;
  implement)
    if [ "$ESCALATED" = "true" ]; then
      emit "true" "Wiederholungslauf nach Soft-Abort (ai:continued) — Mentor-Vorlauf läuft (ADR 0008)."
    fi
    emit "false" "Erstlauf ohne Eskalation — kein Mentor."
    ;;
  *)
    echo "mentor-gate: --mode muss 'fixup' oder 'implement' sein (war: '${MODE}')" >&2; exit 2 ;;
esac
