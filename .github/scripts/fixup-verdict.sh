#!/usr/bin/env bash
# Entscheidungs-Tabelle für den Fixup-Abschluss (Issue #961): Welches Ziel-Label
# verdient der PR, wenn Claude Verdict, HEAD-Fortschritt und Übergabe-Historie liefert?
#
# WARUM: Der No-Progress-Zweig (B3) in 04-claude-implement.yml parkte JEDEN Lauf
# ohne Commit terminal beim Menschen — auch den legitimen "alles bereits gefixt"
# (PR #944: beide Findings in der Vor-Runde gelöst; PR #1650: flaky E2E-Shard per
# Rerun grün, kein Commit nötig). Gleichzeitig darf ein solches already-done nicht
# zum Review<->Fixup-Ping-Pong werden: Pro HEAD darf already-done genau EINMAL an
# den Review zurück. Meldet der Review danach auf demselben HEAD erneut Findings
# und der Fixup wieder already-done, parkt der PR beim Menschen.
#
# Früher entschied ein Review-Delta (Sammelkommentar seit Laufbeginn geändert).
# Das trug nie: Der Review schreibt seinen Kommentar VOR dem Fixup-Start, die
# Baseline war im Normalablauf also immer schon der Endstand (PR #1650).
#
# WARUM EIGENES SCRIPT: Der Workflow liest nur target=/reason= als key=value —
# die Logik selbst ist damit via node:test abgedeckt (fixup-verdict.test.ts,
# Teil von `pnpm test:scripts`), wie transient-api-error.sh für den Crash-Pfad.
#
# Usage:
#   fixup-verdict.sh evaluate --verdict <v> --head-progress <true|false> \
#       [--handed-over <true|false>]
#   --handed-over: Für den aktuellen HEAD wurde already-done schon einmal an den
#                  Review übergeben (Marker <!-- ai-already-done head=<sha> -->).
#
# Ausgabe (stdout, key=value):
#   target=ai:needs-review | ai:needs-human
#   reason=needs-human-verdict | head-progress | already-done | already-done-repeat | no-progress
#
# Reihenfolge (bewusst, jede Zeile greift vor den folgenden):
#   1. needs-human  — einzig verbindliches Verdict, terminal, unabhängig von allem (B2).
#   2. head-progress — HEAD-Bewegung bleibt Ground Truth für echten Fortschritt.
#   3. already-done, erste Übergabe für diesen HEAD → erneuter Review bestätigt
#                      oder widerspricht.
#   4. already-done, schon übergeben — Ping-Pong-Schutz → Mensch (AK3).
#   5. sonst (kein Verdict)        — Loop-Schutz unangetastet → Mensch (AK4).

set -uo pipefail

CMD="${1:-}"
[ $# -gt 0 ] && shift

VERDICT=""
HEAD_PROGRESS="false"
HANDED_OVER=""

while [ $# -gt 0 ]; do
  case "$1" in
    --verdict) VERDICT="$2"; shift 2 ;;
    --head-progress) HEAD_PROGRESS="$2"; shift 2 ;;
    --handed-over) HANDED_OVER="$2"; shift 2 ;;
    *) shift ;;
  esac
done

case "$CMD" in
  evaluate)
    if [ "$VERDICT" = "needs-human" ]; then
      echo "target=ai:needs-human"
      echo "reason=needs-human-verdict"
      exit 0
    fi
    if [ "$HEAD_PROGRESS" = "true" ]; then
      echo "target=ai:needs-review"
      echo "reason=head-progress"
      exit 0
    fi
    if [ "$VERDICT" = "already-done" ]; then
      # Nur ein explizites "false" gibt frei: Leer/unlesbar = Safe-Default parken,
      # Fail-open würde genau das Ping-Pong erlauben, das der Schutz verhindern soll.
      if [ "$HANDED_OVER" = "false" ]; then
        echo "target=ai:needs-review"
        echo "reason=already-done"
      else
        echo "target=ai:needs-human"
        echo "reason=already-done-repeat"
      fi
      exit 0
    fi
    echo "target=ai:needs-human"
    echo "reason=no-progress"
    ;;
  *)
    echo "Usage: fixup-verdict.sh evaluate --verdict <v> --head-progress <true|false> [--handed-over <true|false>]" >&2
    [ -n "$CMD" ] && echo "unbekannter Befehl: $CMD" >&2
    exit 2
    ;;
esac
