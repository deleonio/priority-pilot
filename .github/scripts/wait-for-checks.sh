#!/usr/bin/env bash
# Wartet, bis die CI-Checks eines PR FERTIG sind — bevor das Review überhaupt anläuft.
#
# WARUM (Beobachtung aus dem Harness, Kosten): Review (05) und CI (Verify) starten beide am
# selben Push und liefen bisher parallel. War das Review zuerst fertig und setzte
# `ai:needs-fixup`, startete die Nacharbeit SOFORT — mit dem Wissensstand „CI-Ergebnis
# unbekannt". Fiel die CI danach rot aus, kannte der laufende Fixup diese Fehler nicht und
# behob sie nicht; das Gate setzte anschließend erneut `ai:needs-fixup` → mindestens EIN
# zusätzlicher Fixup- UND ein zusätzlicher Review-Lauf pro PR. Wartet das Review dagegen auf
# den Abschluss aller Checks, sieht es rote Jobs als Findings und bündelt sie mit seinen
# eigenen in EINE Fixup-Runde.
#
# Bash statt .ts: reine gh-/jq-Wrapper-Logik wie check-phase-label.sh — ausgelagert aus dem
# Workflow, damit sie testbar bleibt (ADR 0001: Workflows selbst bleiben ungetestet):
#   bash .github/scripts/wait-for-checks.sh --repo o/r --pr 42
#
# ALLOWLIST: Gewartet wird auf GENAU den Workflow, auf den auch das Gate keyt (`Verify`,
# Default). Das ist dieselbe Menge, die später über rot/grün entscheidet — fremde Checks
# (Renovate & Co.) gaten nicht und dürfen das Review nicht aufhalten. Die eigenen
# `05 Review`-Checks sind damit automatisch ausgeschlossen (sonst: Selbst-Deadlock).
#
# FAIL-OPEN: Jeder unklare Zustand (Checks tauchen nie auf, Zeitbudget erschöpft, API stumm)
# endet mit exit 0 und einem Status, der das Review trotzdem laufen lässt. Ein verschlucktes
# Review wäre teurer als ein Review ohne CI-Wissen — das ist exakt der Zustand von vorher.
#
# Ausgabe (stdout, key=value — direkt nach $GITHUB_OUTPUT anhängbar, immer einzeilig):
#   status=green|red|timeout|absent   green = alle fertig, keiner rot
#                                     red = mind. ein Check rot (Namen in `red`)
#                                     timeout = nach --timeout-seconds noch pending
#                                     absent = binnen --appear-seconds kein Check sichtbar
#   red=<Job-Namen, kommasepariert>   nur bei status=red
#   pending=<Job-Namen>               nur bei status=timeout
#   waited=<Sekunden>
#
# Usage:
#   bash wait-for-checks.sh --repo <owner/repo> --pr <N> [--workflow <name>]
#                           [--timeout-seconds <n>] [--appear-seconds <n>] [--interval <n>]
set -uo pipefail

REPO=""
PR=""
WORKFLOW="Verify"
TIMEOUT_SECONDS=1200 # 20 min: deckt den langsamsten beobachteten CI-Lauf (E2E-Shards) ab
APPEAR_SECONDS=300   # 5 min: so lange darf GitHub brauchen, bis der Check am neuen Head hängt
INTERVAL=20

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="${2:-}"; shift 2 ;;
    --pr) PR="${2:-}"; shift 2 ;;
    --workflow) WORKFLOW="${2:-}"; shift 2 ;;
    --timeout-seconds) TIMEOUT_SECONDS="${2:-}"; shift 2 ;;
    --appear-seconds) APPEAR_SECONDS="${2:-}"; shift 2 ;;
    --interval) INTERVAL="${2:-}"; shift 2 ;;
    *) echo "Unbekanntes Argument: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$REPO" ] || [ -z "$PR" ]; then
  echo "Usage: wait-for-checks.sh --repo <owner/repo> --pr <N>" >&2
  exit 2
fi

# Ein Erscheinungs-Fenster größer als das Gesamtbudget wäre widersprüchlich (der Timeout
# griffe, bevor „absent" je erreicht wird) — auf das Budget kappen.
if [ "$APPEAR_SECONDS" -gt "$TIMEOUT_SECONDS" ]; then
  APPEAR_SECONDS="$TIMEOUT_SECONDS"
fi

start="$(date +%s)"
status=""
red=""
pending_names=""
elapsed=0

while :; do
  # `gh pr checks` beendet sich mit != 0, sobald Checks rot (1) oder pending (8) sind, gibt das
  # JSON aber trotzdem aus — Exit-Code schlucken, Ausgabe behalten (Muster aus merge-pr.yml).
  raw="$(gh pr checks "$PR" --repo "$REPO" --json name,bucket,workflow 2>/dev/null)" || true
  [ -z "$raw" ] && raw='[]'
  allow="$(printf '%s' "$raw" | jq -c --arg wf "$WORKFLOW" '[.[] | select(.workflow == $wf)]' 2>/dev/null)" || allow='[]'
  [ -z "$allow" ] && allow='[]'

  count="$(printf '%s' "$allow" | jq 'length' 2>/dev/null || echo 0)"
  elapsed=$(( $(date +%s) - start ))

  if [ "$count" -gt 0 ]; then
    if [ "$(printf '%s' "$allow" | jq -r 'any(.[]; .bucket == "pending")')" != "true" ]; then
      if [ "$(printf '%s' "$allow" | jq -r 'any(.[]; .bucket == "fail")')" = "true" ]; then
        status="red"
        red="$(printf '%s' "$allow" | jq -r '[.[] | select(.bucket == "fail") | .name] | join(", ")')"
      else
        # pass/skipping/cancel: fertig und nicht rot. Ein abgebrochener Lauf (cancel) ist KEIN
        # Fehlschlag — er entsteht regulär, wenn ein neuer Push den Vorlauf verdrängt.
        status="green"
      fi
      break
    fi
    pending_names="$(printf '%s' "$allow" | jq -r '[.[] | select(.bucket == "pending") | .name] | join(", ")')"
  elif [ "$elapsed" -ge "$APPEAR_SECONDS" ]; then
    # Kein Check des Allowlist-Workflows sichtbar. Regulär bei Draft-PRs (CI läuft dort nicht)
    # oder wenn der Lauf nie startete — nicht weiter warten, das Review entscheidet selbst.
    status="absent"
    break
  fi

  if [ "$elapsed" -ge "$TIMEOUT_SECONDS" ]; then
    status="timeout"
    break
  fi
  sleep "$INTERVAL"
done

# Einzeilig halten: Job-Namen kommen aus der API und dürfen den key=value-Kontrakt von
# $GITHUB_OUTPUT nicht mit Zeilenumbrüchen sprengen.
printf 'status=%s\n' "$status"
printf 'red=%s\n' "$(printf '%s' "$red" | tr '\n' ' ')"
printf 'pending=%s\n' "$(printf '%s' "$pending_names" | tr '\n' ' ')"
printf 'waited=%s\n' "$elapsed"
