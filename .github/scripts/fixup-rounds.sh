#!/usr/bin/env bash
# Fixup-Runden-Deckel (Issue #993): Wie viele Review→Fixup-Runden hat dieser PR
# schon hinter sich — und ist der Deckel erreicht?
#
# WARUM: Der bisherige Bremser (Stop-Guard „> 10 PR-Commits") misst Commits, nicht
# Schleifen-Runden — #932 lief 10 Review- + 4 Fixup-Läufe (34,5 Mio Token), ohne
# dass eine Bremse feuerte. Runden sind die Grösse, die die Kosten tatsächlich
# skaliert (Review+Fixup = 97 % des bewerteten Verbrauchs), und sie ist ohne LLM
# deterministisch zählbar: Jede Fixup-Runde beginnt damit, dass der Review-Workflow
# `ai:needs-fixup` SETZT — also zählen wir die labeled-Events dieses Labels in der
# PR-Timeline (Issues-/Timeline-API). Das eigene Trigger-Event dieses Laufes ist
# dabei bereits enthalten (es passiert vor dem Start-Konsum), d. h. count == N
# bedeutet: DIES ist Runde N. Ein transienter Crash-Re-Arm (04 setzt
# ai:needs-fixup erneut) zählt konservativ als zusätzliche Runde — fail-closed.
#
# WARUM EIGENES SCRIPT: Der Workflow liest nur count=/max=/stop= als key=value —
# die Zähl- und Schwellenlogik ist damit via node:test abgedeckt
# (fixup-rounds.test.ts, Teil von `pnpm test:scripts`), wie fixup-verdict.sh.
#
# .costs/<n>.json ist hier bewusst NICHT die Quelle: Einträge werden erst nach
# Merge versiegelt und existieren während des PR-Lebens nicht im Checkout —
# Laufzeit zählt die Timeline, .costs dient nur der Retro-Auswertung (AK4).
#
# Usage:
#   fixup-rounds.sh count --repo <owner/repo> --pr <nr> [--max <runden>]
#
# Ausgabe (stdout, key=value):
#   count=<n>   — labeled-Events für ai:needs-fixup in der PR-Timeline
#   max=<m>     — wirksamer Deckel (Default 3)
#   stop=true   — count >= max+1: Dies ist die (max+1). Runde → an den Menschen
#
# Fail-closed: Timeline nicht lesbar oder kein erwartetes JSON-Array → Exit 1
# (der Workflow stoppt dann ebenfalls — wie der bestehende Stop-Guard bei
# gh-API-Ausfall; ein Zählfehler darf nie eine weitere Runde freigeben).

set -uo pipefail

CMD="${1:-}"
[ $# -gt 0 ] && shift

REPO=""
PR=""
MAX="3"

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --pr) PR="$2"; shift 2 ;;
    --max) MAX="$2"; shift 2 ;;
    *) shift ;;
  esac
done

die_usage() {
  echo "Usage: fixup-rounds.sh count --repo <owner/repo> --pr <nr> [--max <runden>]" >&2
  [ -n "$1" ] && echo "$1" >&2
  exit 2
}

case "$CMD" in
  count)
    [ -n "$REPO" ] && [ -n "$PR" ] || die_usage "count: --repo/--pr required"
    case "$MAX" in ''|*[!0-9]*|0) die_usage "count: --max muss eine ganze Zahl > 0 sein (ist: '$MAX')" ;; esac

    if ! TIMELINE="$(gh api --paginate "repos/${REPO}/issues/${PR}/timeline?per_page=100" 2>/dev/null)"; then
      echo "fixup-rounds: Timeline nicht lesbar (gh api repos/${REPO}/issues/${PR}/timeline) — fail-closed." >&2
      exit 1
    fi
    # --paginate hängt die Seiten als konkatenierte JSON-Arrays aneinander;
    # jq -s macht daraus [[…],[…]] → .[][] flacht auf. Alles, was kein
    # labeled-Event für ai:needs-fixup ist (unlabeled, andere Labels, Kommentare),
    # fällt heraus.
    if ! COUNT="$(printf '%s\n' "$TIMELINE" | jq -s '[ .[][] | select(.event == "labeled" and .label.name == "ai:needs-fixup") ] | length' 2>/dev/null)" \
      || ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
      echo "fixup-rounds: Timeline-Antwort ist kein erwartetes JSON-Array — fail-closed." >&2
      exit 1
    fi

    echo "count=${COUNT}"
    echo "max=${MAX}"
    # Deckel: Bei Start der (max+1). Runde stoppen — Standard 3 heißt,
    # die Runden 1–3 laufen, die 4. geht an den Menschen.
    if [ "$COUNT" -gt "$MAX" ]; then
      echo "stop=true"
    else
      echo "stop=false"
    fi
    ;;
  *)
    die_usage "unbekannter Befehl: ${CMD:-<leer>}"
    ;;
esac
