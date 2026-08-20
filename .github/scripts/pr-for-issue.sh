#!/usr/bin/env bash
# Liefert offene PRs zu einem Issue — robust gegen fehlendes "#" im Closing-Keyword.
#
# GitHub belegt closingIssuesReferences NUR, wenn der PR-Body ein Closing-Keyword
# MIT "#" enthält ("Closes #123"). Schreibt der Agent "Closes 123" (ohne "#"),
# bleibt die Referenz leer — und Spec/Implement finden ihren eigenen PR nicht mehr
# (PR #585: Spec-Crash "VERDICT ready, aber kein Spec-PR mit Tests").
#
# Strategie: primär closingIssuesReferences; fällt die leer aus, wird im PR-Body nach
# einem CLOSING-KEYWORD samt Nummer gesucht ("Closes 123", Raute optional).
#
# ⚠️ NICHT nach der blossen Nummer suchen. Der frühere Fallback nutzte
# `gh pr list --search "NNN in:body"` — eine Volltextsuche, die jeden offenen PR traf,
# dessen Body die Zahl irgendwo enthält. Sie unterscheidet „schliesst 912" nicht von
# „erwähnt 912". Die Spec-Phase räumt mit diesem Ergebnis „verwaiste Drafts" ab und
# schloss dadurch fremde Draft-PRs, die das Issue nur beschrieben (PR #921/#924 am
# 2026-08-20). Der Fallback verlangt jetzt dasselbe Keyword wie GitHub selbst.
#
# Bash (kein .ts): reine jq-/gh-Wrapper-Logik, inline aus Workflow-Run-Blöcken.
#   pnpm dlx tsx für 3 Zeilen jq-Wrapper wäre Over-Engineering.
#
# Usage:
#   bash pr-for-issue.sh --repo <owner/repo> --issue <N> \
#                        [--draft yes|no|any] [--out first|all|count]
#   --draft yes = nur Drafts, no = nur Nicht-Drafts, any = beides (Default: any)
#   --out   first = erste Nummer (Default), all = alle Nummern (zeilenweise),
#                  count = Anzahl

set -uo pipefail

DRAFT="any"
OUT="first"
REPO=""
ISSUE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)  REPO="$2";  shift 2 ;;
    --issue) ISSUE="$2"; shift 2 ;;
    --draft) DRAFT="$2"; shift 2 ;;
    --out)   OUT="$2";   shift 2 ;;
    *) shift ;;
  esac
done
[ -n "$REPO" ]  || { echo "pr-for-issue: --repo required" >&2; exit 2; }
[ -n "$ISSUE" ] || { echo "pr-for-issue: --issue required" >&2; exit 2; }

# Draft-Filter (jq-Fragment)
case "$DRAFT" in
  yes) DSEL='select(.isDraft == true)' ;;
  no)  DSEL='select(.isDraft == false)' ;;
  any) DSEL='.' ;;
  *)   echo "pr-for-issue: ungültiges --draft '$DRAFT'" >&2; exit 2 ;;
esac

# Ausgabe-Form (DSEL wird unten eingefügt)
case "$OUT" in
  first) FMT='[.[] | DSEL | .number] | (first // empty)' ;;
  all)   FMT='[.[] | DSEL | .number] | .[]' ;;
  count) FMT='[.[] | DSEL] | length' ;;
  *)     echo "pr-for-issue: ungültiges --out '$OUT'" >&2; exit 2 ;;
esac
FMT="${FMT/DSEL/$DSEL}"

# EINE Abfrage für beide Pfade (Body wird mitgeholt). Vorher lief der Fallback über
# `gh pr list --search "NNN in:body"` — eine VOLLTEXTSUCHE, die jeden offenen PR traf,
# dessen Body die Zahl irgendwo enthält. Sie kann „dieser PR schließt 912" nicht von
# „dieser PR erwähnt 912" unterscheiden. Folge: Die Spec-Phase räumt „verwaiste Drafts"
# ab und schloss dabei fremde Draft-PRs, die das Issue nur beschrieben (PR #921 und #924
# am 2026-08-20, eine Sekunde auseinander, mitsamt Review-Stand). Nebenbei entfällt die
# Abhängigkeit vom Suchindex, der dem Ist-Zustand um Sekunden hinterherhängt.
ALL="$(gh pr list --repo "$REPO" --state open --limit 100 \
  --json number,isDraft,body,closingIssuesReferences 2>/dev/null || echo '[]')"
[ -n "$ALL" ] || ALL='[]'

pick() {
  # $1 = jq-Selektor über die PR-Liste
  printf '%s' "$ALL" | jq -r --arg n "$ISSUE" "[.[] | $1] | ${FMT}" 2>/dev/null || true
}

# 1) Primärpfad: closingIssuesReferences (von GitHub gepflegt, immer eindeutig).
res="$(pick "select((.closingIssuesReferences // []) | any(.number == (\$n | tonumber)))")"

# 2) Fallback: Closing-Keyword im Body. GitHub belegt closingIssuesReferences NUR bei
#    „Closes #123" MIT Raute; „Closes 123" bleibt unreferenziert (PR #585). Der Fallback
#    verlangt deshalb dasselbe Keyword wie GitHub, nur die Raute ist optional — eine
#    blosse Erwähnung der Nummer genügt NICHT.
#    Bei count ZUSÄTZLICH auf "0" triggern — `length` liefert nie leer, sondern "0",
#    sonst würde der Fallback im skip-guard (count) trotz fehlendem "#" nie greifen.
trigger=0
if [ "$OUT" = "count" ]; then
  { [ -z "$res" ] || [ "$res" = "null" ] || [ "$res" = "0" ]; } && trigger=1
else
  { [ -z "$res" ] || [ "$res" = "null" ]; } && trigger=1
fi
if [ "$trigger" = "1" ]; then
  # (?i) = Groß-/Kleinschreibung egal; (?![0-9]) verhindert, dass 912 auch 9123 trifft.
  res="$(pick 'select((.body // "") | test("(?i)(clos(e|es|ed)|fix(es|ed)?|resolv(e|es|ed))\\s*:?\\s*#?" + $n + "(?![0-9])"))')"
fi

# count → 0 statt leer (sonst crasht [ -gt 0 ] im Caller)
if [ "$OUT" = "count" ] && [ -z "$res" ]; then res="0"; fi

printf '%s' "$res"
