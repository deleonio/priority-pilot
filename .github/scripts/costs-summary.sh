#!/usr/bin/env bash
# Kosten-Basis fuer den Prompt-Audit (.github/prompts/prompt-audit.md, ORDER Schritt 1).
# Aggregiert .costs/*.json pro Phase zu einer Markdown-Tabelle inkl. Schleifen-Raten,
# fertig fuer die Report-Sektion KOSTEN-BASIS — der Audit-Agent rechnet nichts selbst
# (ein jq-Einzeiler im Prompt war eine Klammerungs-Falle, s. Audit 2026-08-29).
#
# TURNS sind die Abrechnungsgroesse der Abos (Claude, z.ai rechnen je Prompt/Turn ab),
# darum stehen Turns gesamt, Turns ∅ und Turns/Ticket gleichberechtigt neben $ (#1198).
# Laeufe ohne `turns`-Feld (vor #984) zaehlen in Runs/$ mit, bleiben aber aus allen
# Turn-Mittelwerten heraus — als 0 gemittelt haetten sie den Turn-Aufwand systematisch
# untertrieben. Eine Fussnote nennt ihre Zahl, Phasen ganz ohne Turn-Daten zeigen «—».
#
# Aufruf: bash .github/scripts/costs-summary.sh [verzeichnis]   (Default: .costs, aus dem
# Repo-Root wie der Audit-Agent; das Argument nutzt nur der Test mit Fixtures)
set -euo pipefail

cd "$(dirname "$0")/../.."

dir="${1:-.costs}"

jq -rs '
  def money: ((. * 100) | round / 100);
  def avg($sum; $n): if $n > 0 then (($sum / $n) | round | tostring) else "—" end;
  [ .[][] | select(type == "object" and has("phase")) ] as $all
  | [ $all[] | select(.turns != null) ] as $withTurns
  | ([$all[].issueId] | unique | length) as $tickets
  | ([$all[].cost] | add) as $totalCost
  | ([$withTurns[].turns] | add // 0) as $totalTurns
  | ([$withTurns[].issueId] | unique | length) as $turnTickets
  | ($all | length) as $totalRuns
  | ($withTurns | length) as $turnRuns
  | [ $all | group_by(.phase)
      | .[]
      | ([.[] | select(.turns != null)] | map(.turns)) as $t
      | { phase: .[0].phase,
          runs: length,
          tickets: ([.[].issueId] | unique | length),
          cost: (map(.cost) | add),
          turns: (if ($t | length) > 0 then ($t | add | tostring) else "—" end) }
      | . + { avgRun: (.cost / .runs), avgTurns: avg($t | add; $t | length) }
    ] | sort_by(-.cost) as $p
  | ([$p[] | select(.phase == "implement") | .runs] | add // 0) as $impl
  | ([$p[] | select(.phase == "fixup") | .runs] | add // 0) as $fix
  | ([$p[] | select(.phase == "review") | .runs] | add // 0) as $rev
  | $p
  | .[],
    "| **Gesamt** | \($totalRuns) | \($tickets) | \($totalCost | money) | \(($totalCost / $totalRuns) | money) | \(if $turnRuns > 0 then $totalTurns else "—" end) | \(avg($totalTurns; $turnRuns)) |",
    "",
    "Schleifen-Raten (der Hebel, nicht die Phase-Totals): Fixup\u00f7Implement = \($fix)\u00f7\($impl) · Review\u00f7Implement = \($rev)\u00f7\($impl) · $/Ticket = \((($totalCost / $tickets) * 100 | round) / 100) · Turns/Ticket = \(avg($totalTurns; $turnTickets))",
    (if $totalRuns > $turnRuns
     then "Hinweis: \($totalRuns - $turnRuns) von \($totalRuns) Läufen ohne turns-Feld (vor #984) — aus allen Turn-Mittelwerten ausgeschlossen, nicht als 0 gezählt."
     else empty
     end)
  | if type == "object"
    then "| \(.phase) | \(.runs) | \(.tickets) | \(.cost | money) | \(.avgRun | money) | \(.turns) | \(.avgTurns) |"
    else .
    end
' "$dir"/*.json | {
  echo "| Phase | Runs | Tickets | \$ gesamt | \$/Run | Turns gesamt | Turns ∅ |"
  echo "| ----- | ---- | ------- | --------- | ----- | ------------ | ------- |"
  cat
}
