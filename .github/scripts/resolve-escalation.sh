#!/usr/bin/env bash
# Eskalation bei Wiederholungen: Modell und Effort hochstufen.
#
# Die Pipeline setzt bei einem Soft-Abort das Label 'ai:continued' und re-triggert
# mit demselben Label (ai:needs-impl wird entfernt und erneut gesetzt). Dieser
# Checker prüft, ob ai:continued existiert, und stuft Modell+Effort hoch — die
# Idee: Ein Ticket, das schon mal gecrasht ist, braucht mehr Power beim zweiten
# Versuch, nicht denselben Versuch nochmal.
#
# STEIGERUNG:
#   Modell: haiku → sonnet → opus (ab opus unverändert — Allowlist-Ende)
#   Effort:  low → medium → high → xhigh → max
#
# Usage (Pipeline):
#   bash resolve-escalation.sh \
#     --repo <owner/repo> \
#     --ticket <nr> \
#     --kind <issue|pr> \
#     [--current-model <alias>] \
#     [--current-effort <level>]
#
# GitHub-Outputs:
#   model       <alias>  — eskaliertes Modell (oder Original ohne ai:continued)
#   effort      <level>  — eskalierter Effort (oder Original ohne ai:continued)
#   escalated   true|false
set -euo pipefail

REPO=""
TICKET=""
KIND="issue"
CURRENT_MODEL=""
CURRENT_EFFORT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)          REPO="$2";          shift 2 ;;
    --ticket)        TICKET="$2";        shift 2 ;;
    --kind)          KIND="$2";          shift 2 ;;
    --current-model) CURRENT_MODEL="$2"; shift 2 ;;
    --current-effort) CURRENT_EFFORT="$2"; shift 2 ;;
    *) echo "resolve-escalation: unbekanntes Argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$REPO" && -n "$TICKET" && -n "$KIND" ]] || {
  echo "resolve-escalation: --repo, --ticket und --kind sind Pflicht" >&2
  exit 2
}

# ai:continued prüfen — Issue-Marker des Implement-Soft-Aborts. Der PR-Eingang
# (Fixup) hat keinen Soft-Abort und damit nie ai:continued: HAS_CONTINUED bleibt
# false, der gh-Call entfällt (Passthrough ohne API-Abhängigkeit).
HAS_CONTINUED="false"
if [ "$KIND" = "issue" ]; then
  HAS_CONTINUED="$(gh issue view "$TICKET" --repo "$REPO" --json labels \
    --jq 'any(.labels[]; .name == "ai:continued")' 2>/dev/null || echo false)"
fi

if [ "$HAS_CONTINUED" != "true" ]; then
  # Keine Wiederholung: Originalwerte durchreichen
  echo "model=${CURRENT_MODEL}"   >> "$GITHUB_OUTPUT"
  echo "effort=${CURRENT_EFFORT}" >> "$GITHUB_OUTPUT"
  echo "escalated=false"          >> "$GITHUB_OUTPUT"
  echo "::notice title=Eskalation::ai:continued nicht gesetzt — Originalwerte beibehalten."
  exit 0
fi

# Eskalationslogik
escalate_model() {
  case "$1" in
    haiku)   echo "sonnet" ;;
    sonnet)  echo "opus" ;;
    # opus/fable: höchste Stufen der Allowlist — das Modell bleibt, die Eskalation
    # trägt allein der Effort. (setup-claude lehnt zusammengesetzte Aliase wie
    # 'opus:high' hart ab: erlaubt sind nur fable | opus | sonnet | haiku.)
    *)       echo "$1" ;;
  esac
}

escalate_effort() {
  case "$1" in
    low)    echo "medium" ;;
    medium) echo "high" ;;
    high)   echo "xhigh" ;;
    xhigh)  echo "max" ;;
    *)      echo "$1" ;; # Fallback: Unbekannten Effort nicht ändern
  esac
}

NEW_MODEL="${CURRENT_MODEL}"
NEW_EFFORT="${CURRENT_EFFORT}"

# Nur hochstufen, wenn ein Originalwert da ist
if [ -n "$CURRENT_MODEL" ]; then
  NEW_MODEL="$(escalate_model "$CURRENT_MODEL")"
fi
if [ -n "$CURRENT_EFFORT" ]; then
  NEW_EFFORT="$(escalate_effort "$CURRENT_EFFORT")"
fi

echo "model=${NEW_MODEL}"   >> "$GITHUB_OUTPUT"
echo "effort=${NEW_EFFORT}" >> "$GITHUB_OUTPUT"
echo "escalated=true"       >> "$GITHUB_OUTPUT"

if [ "$NEW_MODEL" != "$CURRENT_MODEL" ] || [ "$NEW_EFFORT" != "$CURRENT_EFFORT" ]; then
  echo "::notice title=🔼 Eskalation::ai:continued gesetzt — Modell: ${CURRENT_MODEL:-leer} → ${NEW_MODEL}, Effort: ${CURRENT_EFFORT:-leer} → ${NEW_EFFORT}"
else
  echo "::notice title=🔼 Eskalation::ai:continued gesetzt, aber bereits Maximum erreicht."
fi
