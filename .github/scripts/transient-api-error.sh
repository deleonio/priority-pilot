#!/usr/bin/env bash
# Klassifiziert einen Claude-Crash anhand des Logs: transient (Provider-Fehler, die ein
# erneuter Lauf heilen kann) oder echter Blocker — plus der Exactly-once-Marker-Check
# für den automatischen Re-Arm (Issue #960).
#
# WARUM: Der Crash-Pfad (B1) in 04-claude-implement.yml parkte JEDEN Abbruch terminal beim
# Menschen — auch klar maschinen-entscheidbar transiente Ursachen (API 500 #957, 429,
# 402 Credits, 1313 Fair Usage, Network error). Der Mensch bekam eine Checkliste, deren
# einziger Schritt „transient? → ai:needs-fixup neu setzen" war. Das kann der Workflow
# selbst — aber GENAU EINMAL: Ein zweiter transienter Crash in Folge ist menschlich zu
# prüfen (keine Retry-Schleife, Kontingent statt Loop).
#
# WARUM 1310 NICHT TRANSIENT IST: "Weekly/Monthly Limit Exhausted" (1310) resetet erst
# Tage später — ein sofortiger Re-Arm würde garantiert wieder crashen (Begründung im
# Kopfkommentar von phase-crash-park.sh). Nur 1313 (Fair Usage) zählt dazu.
#
# WARUM DIE MUSTER ANGEKERT SIND: Ein bloses `429`/`402` matcht auch Zeilen wie
# `[1310][Weekly/Monthly Limit Exhausted] (429)` — ein harter Blocker würde so als
# transient durchgehen und einen sinnlosen Re-Arm auslösen. Deshalb `API Error: <code>`.
#
# Usage:
#   transient-api-error.sh detect [--log <datei>]        # Default /tmp/claude-output.log
#   transient-api-error.sh marker --repo <owner/repo> --pr <N>
#
# Ausgabe (stdout, key=value):
#   detect: transient=true|false  cause=<Trefferzeile, eingzeilig gekappt>
#           Fehlendes/leeres Log -> transient=false (Safe-Default = parken).
#   marker: marker=present|absent  prev_run=<url>  prev_cause=<text>
#           "present" = letzter PR-Kommentar enthaelt den Marker <!-- ai-transient-rearm -->
#           (nicht "irgendein Kommentar" — sonst wuerde ein erfolgreicher Folgelauf den
#           Re-Arm dauerhaft blockieren). Lesefehler -> present (Safe-Default = parken:
#           Exactly-once geht vor Fail-open).

set -uo pipefail

LOG_FILE="/tmp/claude-output.log"
REPO=""
PR=""
CMD="${1:-}"
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --log) LOG_FILE="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --pr) PR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Transiente Provider-Muster. 1310/Limit Exhausted bewusst NICHT dabei (s.o.).
PATTERN='API Error: 500|API Error: 429|API Error: 402|\[1313\]|Fair Usage Policy|Network error'

case "$CMD" in
  detect)
    if [ ! -s "$LOG_FILE" ]; then
      # Kein/leeres Log = keine Aussage moeglich -> parken, nicht raten.
      echo "transient=false"
      echo "cause=(Log fehlt oder ist leer — keine Klassifikation moeglich)"
      exit 0
    fi
    # grep-Exit-Code ist hier die Antwort (1 = kein Treffer), kein Fehler: -e abschalten.
    CAUSE="$(grep -E "$PATTERN" "$LOG_FILE" | head -1 | tr -d '\n\r' | cut -c1-400 || true)"
    if [ -n "$CAUSE" ]; then
      echo "transient=true"
      printf 'cause=%s\n' "$CAUSE"
    else
      echo "transient=false"
      echo "cause=(kein transientes Muster im Log)"
    fi
    exit 0
    ;;
  marker)
    [ -n "$REPO" ] || { echo "marker: --repo required" >&2; exit 2; }
    [ -n "$PR" ] || { echo "marker: --pr required" >&2; exit 2; }
    MARKER='<!-- ai-transient-rearm -->'
    # Letzter PR-Kommentar — gleiches jq wie der post-Dedupe in needs-human-explain.sh.
    if ! LAST="$(gh pr view "$PR" --repo "$REPO" --json comments --jq '[.comments[]] | last | .body // ""' 2>/dev/null)"; then
      # Lesefehler: Exactly-once nicht garantierbar -> Safe-Default = parken.
      echo "marker=present"
      echo "prev_run="
      echo "prev_cause=(letzter PR-Kommentar nicht lesbar)"
      exit 0
    fi
    if ! printf '%s' "$LAST" | grep -qF "$MARKER"; then
      echo "marker=absent"
      exit 0
    fi
    # Fuer den Park-Kommentar bei wiederholtem Crash: Run-Link + Ursache aus dem
    # Re-Arm-Kommentar herausziehen (falls das Format driftet, bleibt das Feld leer —
    # der Kommentar nennt dann eben nur den aktuellen Lauf).
    PREV_RUN="$(printf '%s' "$LAST" | grep -oE 'https://[^ )]+/actions/runs/[0-9]+' | head -1 | tr -d '\n\r' || true)"
    PREV_CAUSE="$(printf '%s' "$LAST" | sed -n 's/.*\*\*Ursache:\*\* *`\{0,1\}\([^`]*\)`\{0,1\}.*/\1/p' | head -1 | tr -d '\n\r' | cut -c1-400)"
    echo "marker=present"
    printf 'prev_run=%s\n' "$PREV_RUN"
    printf 'prev_cause=%s\n' "$PREV_CAUSE"
    exit 0
    ;;
  *)
    echo "Usage: transient-api-error.sh detect [--log <datei>] | marker --repo <o/r> --pr <N>" >&2
    exit 2
    ;;
esac
