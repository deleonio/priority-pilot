#!/usr/bin/env bash
# Phasen-Routing aus der ai-phase-routing-Tabelle lesen (ADR 0004).
#
# QUELLE (ADR 0009): Die Triage schreibt die Routing-Tabelle in den Harness-Kommentar
# (Marker <!-- ai-harness -->, erste Zeile) — den EINEN Marker-Kommentar, in dem alle
# Phasen ihre Ausgaben ablegen; der Issue-Body bleibt ab der Validierung unberuehrt.
# Stabil umschlossen von ai-phase-routing:START/END-Markern:
#
#   <!-- ai-phase-routing:START -->
#   | Phase | Run | Modell | Effort |
#   | --- | --- | --- | --- |
#   | ux | ja | haiku | low |
#   | spec | nein | - | - |
#   | impl | ja | haiku | medium |
#   | review | ja | sonnet | high |
#   <!-- ai-phase-routing:END -->
#
# Sie ist die EINE, analysgetriebene Steuerung für Modell+Effort JE Phase (ADR-0004,
# konsequent zu Ende gedacht): Die Analyse sieht das Ticket und stuft jede Phase ein,
# statt einer globalen Aufwandsklasse. Die Run-Spalte (ja/nein) dokumentiert dieselbe
# Entscheidung, die auch die Label-Kette trifft (ai:needs-ux-ui, Spec-Skip nach ADR-0004)
# — Labels bleiben der Trigger, die Tabelle die sichtbare Quelle.
#
# VORRANG: Tabelle > bestehende Mechanik (ai:model:*-Label, Workflow-Defaults).
# Fehlt die Tabelle (alle Tickets vor diesem Umbau) oder ist eine Zeile ungueltig,
# liefert das Skript LEER zurueck (source=none) und der Aufrufer nutzt seine bisherige
# Logik unverändert — bewusst FAIL-OPEN: Ein Tippfehler des LLM darf die Pipeline nicht
# parken; die Validierungsregeln stehen im Triage-Prompt, die Defaults sind bewaehrt.
#
# Warum Markdown-Tabelle im Body statt Label: Ein Label traegt EINE Aufwandsklasse fuer
# alle Phasen; vier Phasen-spezifische Label-Systeme wuerden explodieren. Die Tabelle ist
# fuer Menschen sichtbar und per Body-Edit manuell ueberschreibbar — derselbe Override-
# Weg, den das ai:model:*-Label heute bietet.
#
# Usage:
#   bash resolve-phase-routing.sh --repo <owner/repo> --ticket <N> --kind <issue|pr> --phase <ux|spec|impl|review>
#
# --kind pr: Die Tabelle wird am verknuepften Issue gesucht (closingIssuesReferences,
# erste Issue - dieselbe Quelle wie resolve-model-label.sh): Fixup/Review laufen auf
# PRs, die Tabelle lebt aber am Issue(-Kommentar), weil die Triage sie dorthin schreibt.
# --issue N bleibt als Abkuerzung fuer --ticket N --kind issue.
#
# GitHub-Outputs:
#   run    – ja|nein (aus der Tabelle; leer, wenn keine Tabelle)
#   model  – haiku|sonnet|opus (leer bei run=nein oder fehlender Tabelle)
#   effort – low|medium|high (leer bei run=nein oder fehlender Tabelle)
#   source – table|none (fuer Notices/Debugging)
set -euo pipefail

REPO=""
TICKET=""
KIND="issue"
PHASE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)   REPO="$2";   shift 2 ;;
    --ticket) TICKET="$2"; shift 2 ;;
    --kind)   KIND="$2";   shift 2 ;;
    --issue)  TICKET="$2"; KIND="issue"; shift 2 ;;
    --phase)  PHASE="$2";  shift 2 ;;
    *) echo "resolve-phase-routing: unbekanntes Argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$REPO" && -n "$TICKET" && -n "$PHASE" ]] || {
  echo "resolve-phase-routing: --repo, --ticket und --phase sind Pflicht" >&2; exit 2
}
case "$KIND" in
  issue|pr) ;;
  *) echo "resolve-phase-routing: --kind muss issue|pr sein (got: $KIND)" >&2; exit 2 ;;
esac
case "$PHASE" in
  ux|spec|impl|review) ;;
  *) echo "resolve-phase-routing: --phase muss ux|spec|impl|review sein (got: $PHASE)" >&2; exit 2 ;;
esac

emit() { # emit <run> <model> <effort> <source>
  echo "run=$1"    >> "$GITHUB_OUTPUT"
  echo "model=$2"  >> "$GITHUB_OUTPUT"
  echo "effort=$3" >> "$GITHUB_OUTPUT"
  echo "source=$4" >> "$GITHUB_OUTPUT"
}

# Bei --kind pr: Tabelle lebt am closing-Issue (Triage schreibt sie in den Issue-Body).
# Keine Issue verknuepft -> keine Tabelle -> Fail-Open auf die Aufrufer-Defaults.
ISSUE_NR="$TICKET"
if [ "$KIND" = "pr" ]; then
  ISSUE_NR="$(gh pr view "$TICKET" --repo "$REPO" --json closingIssuesReferences \
    --jq '[.closingIssuesReferences[].number][0] // ""' 2>/dev/null || true)"
  if [ -z "$ISSUE_NR" ]; then
    echo "::notice title=Routing-Tabelle::PR ohne verknuepfte Issue - keine ai-phase-routing-Tabelle, bisherige Modellwahl-Logik gilt."
    emit "" "" "" none
    exit 0
  fi
fi

# Quelle 1 (ADR 0009): Harness-Kommentar. Quelle 2 (Legacy-Fallback): Issue-Body —
# Tickets vor der Umstellung tragen die Tabelle noch dort; sie bleiben lauffaehig,
# bis eine Re-Triage sie in den Kommentar migriert. Keine der beiden Quellen lesbar
# -> keine Tabelle -> Fail-Open auf die Aufrufer-Defaults.
COMMENT_BODY="$(bash "$(dirname "$0")/harness-comment.sh" --repo "$REPO" --issue "$ISSUE_NR" 2>/dev/null || true)"
if [ -n "$COMMENT_BODY" ]; then
  BODY="$COMMENT_BODY"
else
  ISSUE_JSON="$(gh issue view "$ISSUE_NR" --repo "$REPO" --json body 2>/dev/null)" || {
    echo "resolve-phase-routing: Issue nicht lesbar — Tabelle uebersprungen, Aufrufer-Defaults gelten" >&2
    emit "" "" "" none
    exit 0
  }
  BODY="$(printf '%s' "$ISSUE_JSON" | jq -r '.body // ""')"
fi

# Tabellen-Segment zwischen den Markern; sed -n mit /START/,/END/-Bereich.
# /END/!? verhindert, dass die START-Zeile selbst als Bereichsende gezaehlt wird.
SEGMENT="$(printf '%s' "$BODY" | sed -n '/ai-phase-routing:START/,/ai-phase-routing:END/p')"

# Zeile der Phase extrahieren und FELDER sofort loesen — gsub auf einem Feld
# (awk) baut $0 mit OFS neu auf, die Pipes wuerden verloren gehen; deshalb keine
# Zwischenspeicherung der Zeile, sondern Ein-Durchlauf-Extraktion.
# Felder bei "| ux | ja | haiku | low |": $2=Phase $3=Run $4=Modell $5=Effort.
PARSED="$(printf '%s' "$SEGMENT" | awk -F'|' -v ph="$PHASE" '
  /^\|/ {
    c = $2; gsub(/[ \t]/, "", c)
    if (c == ph) {
      run = $3; model = $4; effort = $5
      gsub(/[ \t]/, "", run); gsub(/[ \t]/, "", model); gsub(/[ \t]/, "", effort)
      printf "%s\n%s\n%s\n", run, model, effort
      exit
    }
  }
')"
RUN="$(printf '%s' "$PARSED" | sed -n 1p)"
MODEL="$(printf '%s' "$PARSED" | sed -n 2p)"
EFFORT="$(printf '%s' "$PARSED" | sed -n 3p)"

# Zeile gefunden? (PARSED hat drei Zeilen wenn ja; leere Phase-Zeile sonst)
if [[ -z "$PARSED" ]]; then
  echo "::notice title=Routing-Tabelle::Keine '$PHASE'-Zeile in ai-phase-routing — bisherige Modellwahl-Logik gilt."
  emit "" "" "" none
  exit 0
fi

# Validierung — ungültige Werte: ganze Zeile verwerfen (fail-open auf Aufrufer-Defaults),
# damit ein halb geglueckter LLM-Schreibvorgang keine halbe Steuerung erzeugt.
if [[ "$RUN" != "ja" && "$RUN" != "nein" ]] \
   || { [[ "$RUN" == "ja" ]] && { [[ "$MODEL" != "haiku" && "$MODEL" != "sonnet" && "$MODEL" != "opus" ]] \
      || [[ "$EFFORT" != "low" && "$EFFORT" != "medium" && "$EFFORT" != "high" ]]; }; }; then
  echo "::warning title=Routing-Tabelle ungueltig::'$PHASE'-Zeile hat ungueltige Werte (run='$RUN' model='$MODEL' effort='$EFFORT') — bisherige Modellwahl-Logik gilt."
  emit "" "" "" none
  exit 0
fi

if [[ "$RUN" == "nein" ]]; then
  emit nein "" "" table
else
  emit ja "$MODEL" "$EFFORT" table
fi
