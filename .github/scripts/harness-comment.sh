#!/usr/bin/env bash
# Harness-Kommentar lesen — der EINE Marker-Kommentar pro Issue (ADR 0009).
#
# ZWECK: Der Issue-Validator (00-issue-quality-check.yml) feuert auf JEDES Body-Edit
# und wurde rot, sobald Phasen ihre Ausgaben in die Beschreibung schrieben. Seit
# ADR 0009 bleibt der Issue-Body ab der Validierung unberuehrt: Alle Phasen legen
# ihre Ausgaben (KI-ANALYSE-Block + ai-phase-routing-Tabelle, KI-UX-Block, …) in
# GENAU EINEN Marker-Kommentar — erste Zeile exakt `<!-- ai-harness -->` — und
# aktualisieren ihn in Place (Upsert-Muster wie der ai-quality-Kommentar).
#
# Dieses Skript ist die Workflow-Seite (Runner-Bash, volles Shell-Tooling).
# Agenten-Seiten (restricted Tier, nur Bash(gh *)) steht die Mechanik inline im
# Prompt (gh issue view --json comments + gh api graphql updateIssueComment).
#
# Selektion: erste Zeile des Kommentar-Bodys == Marker (startswith, wie
# post-quality-feedback.sh). Oeffnender Kommentar-Index (per_page=100, aufsteigend)
# — der Harness-Kommentar entsteht bei der ersten Analyse und liegt damit frueh
# im Thread; jenseits von 100 Kommentaren greift der Fallback (fail-open leer).
#
# Usage:
#   bash harness-comment.sh --repo <owner/repo> --issue <N> [--id]
#
# Ausgabe (stdout): Body des Harness-Kommentars (Default) bzw. seine REST-ID (--id);
#   LEER, wenn er nicht existiert — auch bei API-Fehlern (fail-open, nie exit != 0
#   fuer "nicht da"; nur Argumentfehler exiten hart mit 2).
set -uo pipefail

REPO=""
ISSUE=""
MODE="body"
while [[ $# -gt 0 ]]; do
  case "$1" in
    # Wert-Flags mit $#-Guard: Ohne Wert wuerde $2 unter set -u mit Exit 1
    # crashen — nur Argumentfehler exiten laut Kopf hart, und zwar mit 2.
    --repo)  [[ $# -ge 2 ]] || { echo "harness-comment: --repo braucht einen Wert" >&2; exit 2; }
             REPO="$2";  shift 2 ;;
    --issue) [[ $# -ge 2 ]] || { echo "harness-comment: --issue braucht einen Wert" >&2; exit 2; }
             ISSUE="$2"; shift 2 ;;
    --id)    MODE="id";  shift ;;
    *) shift ;;
  esac
done
[[ -n "$REPO" && -n "$ISSUE" ]] || { echo "harness-comment: --repo und --issue sind Pflicht" >&2; exit 2; }

MARKER='<!-- ai-harness -->'
FIELD="body"
[ "$MODE" = "id" ] && FIELD="id"

# gh OHNE --jq (rohes JSON), Filterung lokal per jq — dieselbe Stub-Testbarkeit
# wie check-phase-label.sh; ein --jq im gh-Aufruf wuerde einen gh-PATH-Stub auf
# die Emulation der jq-Semantik zwingen. "first" nimmt den aeltesten passenden
# Kommentar (head -1 kaeme nicht in Frage: Der Body ist mehrzeilig, head wuerde
# ihn auf die Marker-Zeile verstuemmeln).
JSON="$(gh api "repos/$REPO/issues/$ISSUE/comments?per_page=100" 2>/dev/null)" || true
printf '%s' "${JSON:-[]}" \
  | jq -r --arg m "$MARKER" "([.[] | select(.body | startswith(\$m))] | first | .$FIELD) // empty" 2>/dev/null \
  || true
