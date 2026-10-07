#!/usr/bin/env bash
# Ergänzt "Closes #<N>" im PR-Body, falls der Agent das Closing-Keyword weggelassen hat.
# Ohne Keyword schliesst der Merge das Issue nicht (#2163, Beobachtung #2014/PR #2161).
# Bash (kein .ts): reiner gh-Wrapper, wie pr-for-issue.sh.
#
# Usage: bash pr-ensure-closes.sh --repo <owner/repo> --pr <PR> --issue <N>

set -uo pipefail

REPO=""; PR=""; ISSUE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)  REPO="$2";  shift 2 ;;
    --pr)    PR="$2";    shift 2 ;;
    --issue) ISSUE="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ -n "$REPO" ] && [ -n "$PR" ] && [ -n "$ISSUE" ] || { echo "pr-ensure-closes: --repo, --pr, --issue required" >&2; exit 2; }

BODY="$(gh pr view "$PR" --repo "$REPO" --json body --jq '.body // ""' 2>/dev/null || true)"
# Dasselbe Muster wie pr-for-issue.sh; MIT Raute, nur so belegt GitHub die Referenz.
if printf '%s' "$BODY" | grep -Eiq "(clos(e|es|ed)|fix(es|ed)?|resolv(e|es|ed))[[:space:]]*:?[[:space:]]*#${ISSUE}([^0-9]|$)"; then
  exit 0
fi
printf '%s\n\nCloses #%s\n' "$BODY" "$ISSUE" | gh pr edit "$PR" --repo "$REPO" --body-file - >/dev/null \
  && echo "::notice::PR #$PR: 'Closes #$ISSUE' ergänzt (Agent hatte das Keyword weggelassen)."
exit 0
