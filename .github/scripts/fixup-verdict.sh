#!/usr/bin/env bash
# Entscheidungs-Tabelle für den Fixup-Abschluss (Issue #961): Welches Ziel-Label
# verdient der PR, wenn Claude Verdict, HEAD-Fortschritt und Review-Delta liefert?
#
# WARUM: Der No-Progress-Zweig (B3) in 04-claude-implement.yml parkte JEDEN Lauf
# ohne Commit terminal beim Menschen — auch den legitimen "alles bereits gefixt"
# (PR #944: beide Findings in der Vor-Runde gelöst, Threads resolved, nichts zu
# tun, kein Commit). Gleichzeitig darf ein solches already-done nicht zum
# Review<->Fixup-Ping-Pong werden: Der Verzicht auf einen Commit ist nur
# glaubwürdig, wenn der Review seit Laufbeginn NEUE Findings geliefert hat
# (Sammelkommentar fortgeschrieben = id/updated_at geändert).
#
# WARUM EIGENES SCRIPT: Der Workflow liest nur target=/reason= als key=value —
# die Logik selbst ist damit via node:test abgedeckt (fixup-verdict.test.ts,
# Teil von `pnpm test:scripts`), wie transient-api-error.sh für den Crash-Pfad.
#
# Usage:
#   fixup-verdict.sh evaluate --verdict <v> --head-progress <true|false> \
#       [--review-id-before <id>] [--review-updated-before <iso>] \
#       [--review-id-after <id>] [--review-updated-after <iso>]
#
# Ausgabe (stdout, key=value):
#   target=ai:needs-review | ai:needs-human
#   reason=needs-human-verdict | head-progress | already-done | no-review-delta | no-progress
#
# Reihenfolge (bewusst, jede Zeile greift vor den folgenden):
#   1. needs-human  — einzig verbindliches Verdict, terminal, unabhängig von allem (B2).
#   2. head-progress — HEAD-Bewegung bleibt Ground Truth für echten Fortschritt
#                      (Nicht-Ziel des Issues: am Fortschritts-Kriterium nichts ändern).
#   3. already-done + Review-Delta — glaubwürdiges "nichts zu tun" → erneuter Review
#                      bestätigt oder widerspricht.
#   4. already-done ohne Delta     — Ping-Pong-Schutz → Mensch (AK3).
#   5. sonst (kein Verdict)        — Loop-Schutz unangetastet → Mensch (AK4).

set -uo pipefail

CMD="${1:-}"
[ $# -gt 0 ] && shift

VERDICT=""
HEAD_PROGRESS="false"
RB_ID=""
RB_UP=""
RA_ID=""
RA_UP=""

while [ $# -gt 0 ]; do
  case "$1" in
    --verdict) VERDICT="$2"; shift 2 ;;
    --head-progress) HEAD_PROGRESS="$2"; shift 2 ;;
    --review-id-before) RB_ID="$2"; shift 2 ;;
    --review-updated-before) RB_UP="$2"; shift 2 ;;
    --review-id-after) RA_ID="$2"; shift 2 ;;
    --review-updated-after) RA_UP="$2"; shift 2 ;;
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
    # Review-Delta: Der ai-review-Sammelkommentar wird über Runden FORTGESCHRIEBEN
    # (review.md: EINE Kommentar-ID, wechselndes updated_at) — Delta = id ODER
    # updated_at geändert seit Start-Konsum. Ein neu auftauchender Kommentar
    # (Baseline leer, jetzt vorhanden) zählt ebenso: neue Findings sind eingetroffen.
    # Nachher LEER bei gesetzter Baseline = Lesefehler/gelöscht -> KEIN Delta
    # (Safe-Default = parken; Fail-open würde genau das Ping-Pong erlauben, das
    # der Schutz verhindern soll).
    BEFORE="${RB_ID}:${RB_UP}"
    AFTER="${RA_ID}:${RA_UP}"
    DELTA="false"
    if [ -n "$RA_ID" ] && [ "$BEFORE" != "$AFTER" ]; then
      DELTA="true"
    fi
    if [ "$VERDICT" = "already-done" ]; then
      if [ "$DELTA" = "true" ]; then
        echo "target=ai:needs-review"
        echo "reason=already-done"
      else
        echo "target=ai:needs-human"
        echo "reason=no-review-delta"
      fi
      exit 0
    fi
    echo "target=ai:needs-human"
    echo "reason=no-progress"
    ;;
  *)
    echo "Usage: fixup-verdict.sh evaluate --verdict <v> --head-progress <true|false> [--review-id-before <id>] [--review-updated-before <iso>] [--review-id-after <id>] [--review-updated-after <iso>]" >&2
    [ -n "$CMD" ] && echo "unbekannter Befehl: $CMD" >&2
    exit 2
    ;;
esac
