#!/usr/bin/env bash
# Guete-Feedback an den Issue-Autor posten — Upsert EINES Markerkommentars.
#
# ZWECK: verify-issue-quality.sh liefert das Urteil, dieses Skript macht es
# sichtbar: GENAU EIN Kommentar (Marker <!-- ai-quality -->) wird angelegt und
# bei jeder neuen Pruefung aktualisiert — kein Kommentar-Spam pro Edit
# (denselben Upsert-Mechanismus wie der ai-review-Sammelkommentar).
# Zusaetzlich Label-Pflege: ticket:incomplete markiert nicht reife Tickets
# sichtbar in Listen, ok entfernt es wieder.
#
# Bewusst GITHUB_TOKEN-tauglich: Kommentar und Label muessen keine Workflows
# triggern — im Gegenteil (Token-Trigger-Falle). Der Autor editiert das Issue,
# der Vorab-Check (00) feuert erneut und aktualisiert denselben Kommentar.
#
# Usage:
#   bash post-quality-feedback.sh --repo <owner/repo> --issue <N> \
#        --ok true|false [--details-file <pfad>] [--hint "<zusaetzliche zeile>"]
#
# Keine GitHub-Outputs — reine Nebenwirkung (Kommentar + Label).
set -uo pipefail

REPO=""; ISSUE=""; OK=""; DETAILS_FILE=""; HINT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)         REPO="$2";         shift 2 ;;
    --issue)        ISSUE="$2";        shift 2 ;;
    --ok)           OK="$2";           shift 2 ;;
    --details-file) DETAILS_FILE="$2"; shift 2 ;;
    --hint)         HINT="$2";         shift 2 ;;
    *) shift ;;
  esac
done
[[ -n "$REPO" && -n "$ISSUE" && ( "$OK" = "true" || "$OK" = "false" ) ]] || {
  echo "post-quality-feedback: --repo, --issue, --ok true|false sind Pflicht" >&2; exit 2
}

LABEL="ticket:incomplete"
MARKER='<!-- ai-quality -->'

if [ "$OK" = "false" ]; then
  BODY="${MARKER}
## ⛔ Noch nicht analyse-reif

$( [ -n "$DETAILS_FILE" ] && cat "$DETAILS_FILE" )

Bitte das Issue bearbeiten (✏️) — dieser Kommentar aktualisiert sich bei der nächsten Prüfung automatisch.${HINT:+
$HINT}"

  gh label create "$LABEL" --color d73a4a \
    --description "Issue-Struktur unvollstaendig - siehe ai-quality-Kommentar" 2>/dev/null || true
  gh issue edit "$ISSUE" --repo "$REPO" --add-label "$LABEL" 2>/dev/null || true
else
  BODY="${MARKER}
✅ Struktur ist in Ordnung — bereit für die Analyse (Label \`ai:needs-analyse\` setzen)."
  gh issue edit "$ISSUE" --repo "$REPO" --remove-label "$LABEL" 2>/dev/null || true
fi

# Upsert: Marker-Kommentar suchen (id), PATCH falls vorhanden, sonst POST.
CID="$(MARKER="$MARKER" gh api "repos/$REPO/issues/$ISSUE/comments?per_page=100" \
  --jq '.[] | select(.body | startswith(env.MARKER)) | .id' 2>/dev/null | head -1 || true)"

if [ -n "$CID" ]; then
  gh api -X PATCH "repos/$REPO/issues/comments/$CID" -f body="$BODY" >/dev/null 2>&1 \
    || gh issue comment "$ISSUE" --repo "$REPO" --body "$BODY"
else
  gh issue comment "$ISSUE" --repo "$REPO" --body "$BODY"
fi
