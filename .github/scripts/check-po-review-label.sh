#!/usr/bin/env bash
# Prüft, ob das PO-Review-Label ai:needs-po-review gesetzt ist.
#
# WARUM: Nach der Triage-Analyse (Phase 1) wird das Label ai:needs-po-review gesetzt,
# anstatt direkt in UX, Spec oder Implementierung zu gehen. Dieses Skript prüft, ob
# das Label noch vorhanden ist (der PO könnte es bereits entfernt und durch das
# Phasen-Label ersetzt haben).
#
# Usage:
#   bash check-po-review-label.sh --repo <owner/repo> --ticket <N>
#
# Ausgabe (stdout, key=value — die Action reicht sie nach GITHUB_OUTPUT durch):
#   proceed=true|false
#   reason=<Klartext, nur bei proceed=false>

set -uo pipefail

REPO=""
TICKET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --ticket) TICKET="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ -n "$REPO" ] || { echo "check-po-review-label: --repo required" >&2; exit 2; }
[ -n "$TICKET" ] || { echo "check-po-review-label: --ticket required" >&2; exit 2; }

# Label-Check: ai:needs-po-review muss vorhanden sein, sonst hat der PO
# bereits das nächste Phasen-Label gesetzt (der normale Weg).
DATA="$(gh issue view "$TICKET" --repo "$REPO" --json state,labels 2>/dev/null)"
if [ -z "$DATA" ]; then
  echo "proceed=false"
  echo "reason=API-Abfrage fehlgeschlagen"
  exit 0
fi

# Issue muss noch offen sein
STATE="$(printf '%s' "$DATA" | jq -r '.state' | tr '[:upper:]' '[:lower:]')"
[ "$STATE" = "open" ] || { echo "proceed=false"; echo "reason=Issue #${TICKET} ist nicht mehr offen (state=${STATE})"; exit 0; }

# Prüfen, ob ai:needs-po-review vorhanden ist
HAS_PO_REVIEW="$(printf '%s' "$DATA" | jq -r 'any(.labels[]; .name == "ai:needs-po-review")')"
if [ "$HAS_PO_REVIEW" != "true" ]; then
  echo "proceed=false"
  echo "reason=Label 'ai:needs-po-review' fehlt — der PO hat bereits ein Phasen-Label gesetzt"
  exit 0
fi

echo "proceed=true"
