#!/usr/bin/env bash
# Kosten-Basis fuer den Prompt-Audit (.github/prompts/prompt-audit.md, ORDER Schritt 1).
# Aggregiert .costs/*.json pro Phase zu einer Markdown-Tabelle inkl. Schleifen-Raten,
# fertig fuer die Report-Sektion KOSTEN-BASIS — der Audit-Agent rechnet nichts selbst
# (ein jq-Einzeiler im Prompt war eine Klammerungs-Falle, s. Audit 2026-08-29).
# Aufruf: bash .github/scripts/costs-summary.sh  (aus dem Repo-Root, wie der Audit-Agent)
set -euo pipefail

cd "$(dirname "$0")/../.."

jq -rs '
  def money: ((. * 100) | round / 100);
  [ .[][] | select(type == "object" and has("phase")) ] as $all
  | ([$all[].issueId] | unique | length) as $tickets
  | ([$all[].cost] | add) as $totalCost
  | ([$all[] | .turns // 0] | add) as $totalTurns
  | [$all | length] | add as $totalRuns
  | [ $all | group_by(.phase)
      | .[]
      | { phase: .[0].phase,
          runs: length,
          tickets: ([.[].issueId] | unique | length),
          cost: (map(.cost) | add),
          turns: (map(.turns // 0) | add) }
      | . + { avgRun: (.cost / .runs), avgTurns: ((.turns / .runs) | round) }
    ] | sort_by(-.cost) as $p
  | ([$p[] | select(.phase == "implement") | .runs] | add // 0) as $impl
  | ([$p[] | select(.phase == "fixup") | .runs] | add // 0) as $fix
  | ([$p[] | select(.phase == "review") | .runs] | add // 0) as $rev
  | $p
  | .[],
    "| **Gesamt** | \($totalRuns) | \($tickets) | \($totalCost | money) | \(($totalCost / $totalRuns) | money) | \(($totalTurns / $totalRuns) | round) |",
    "",
    "Schleifen-Raten (der Hebel, nicht die Phase-Totals): Fixup\u00f7Implement = \($fix)\u00f7\($impl) · Review\u00f7Implement = \($rev)\u00f7\($impl) · $/Ticket = \((($totalCost / $tickets) * 100 | round) / 100)"
  | if type == "object"
    then "| \(.phase) | \(.runs) | \(.tickets) | \(.cost | money) | \(.avgRun | money) | \(.avgTurns) |"
    else .
    end
' .costs/*.json | {
  echo "| Phase | Runs | Tickets | \$ gesamt | \$/Run | Turns ∅ |"
  echo "| ----- | ---- | ------- | --------- | ----- | ------- |"
  cat
}
