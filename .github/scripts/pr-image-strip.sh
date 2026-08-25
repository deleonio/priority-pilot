#!/usr/bin/env bash
# Bild-Entfernungs-Sweep des PR-Documenters (Issue #1021, Datenschutz): entfernt
# Bild-Referenzen aus PR-Body, allen PR-Kommentaren sowie Bodies und Kommentaren
# ALLER Closing-Issues des PRs — ersetzt durch Platzhalter statt Löschung (Nach-
# vollziehbarkeit; PATCH statt Delete).
#
# Getrennt von pr-doc-render.sh, weil der Sweep auch im Bot-/Ignore-Shortcut laufen
# muss (Datenschutz gilt unabhängig davon, ob eine Doku gerendert wird) und im
# Fallback-Pfad (fehlendes doc.json). Der Render-Schritt ruft dieses Skript am
# Ende seines Normalpfads auf — NACH dem Body-Splice, damit auch der frisch ge-
# schriebene Body und der neue ai-documenter-Kommentar erfasst werden.
#
# Alles best-effort mit ::warning, niemals Exit 1: ein fehlgeschlagener Sweep darf
# die ai:documented-Invariante nicht blockieren (ein roter Job nach gesetztem Label
# wäre nicht re-runbar). Idempotent: nur PATCH/EDIT, wenn strip-images.mjs etwas
# geändert hat — ein zweiter Lauf (workflow_dispatch-Catch-up) schreibt nichts.
#
# Lokal testbar (kein Schreiben): --dry-run

set -uo pipefail

REPO=""
PR=""
DRY_RUN="false"
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --pr) PR="$2"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift ;;
    *) shift ;;
  esac
done
[ -n "$REPO" ] || { echo "pr-image-strip: --repo required" >&2; exit 2; }
[ -n "$PR" ] || { echo "pr-image-strip: --pr required" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ohne Node läuft strip-images.mjs nicht — offen melden statt still zu no-open (der
# Sweep wäre sonst ein Schein-Erfolg für ein Datenschutz-Ziel).
command -v node >/dev/null 2>&1 || {
  echo "::warning title=node fehlt::Bild-Entfernung übersprungen — strip-images.mjs braucht Node."
  exit 0
}

# gh-Auflufe mit Kurz-Retry wie in pr-doc-render.sh: transiente API-Löcher dürfen
# keinen halben Sweep hinterlassen.
gh_retry() {
  local n=1
  until "$@"; do
    if [ "$n" -ge 3 ]; then return 1; fi
    sleep "$n"
    n=$((n + 1))
  done
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Stripped eine Datei in-place; setzt STRIPPED="1" wenn sich der Inhalt geändert hat.
strip_file() {
  local out
  out="$(node "$SCRIPT_DIR/strip-images.mjs" --in-place "$1" 2>/dev/null || echo changed=0)"
  if [ "$out" = "changed=1" ]; then STRIPPED="1"; else STRIPPED="0"; fi
}

# Ein Objekt (PR oder Issue) über dessen Kommentare iterieren und bereinigen.
# $1 = Nummer des Issues/PR (GitHub-API: PRs sind Issues).
strip_comments() {
  local num="$1" kind="$2" id body
  while IFS= read -r id; do
    [ -n "$id" ] || continue
    body="$(gh_retry gh api "repos/$REPO/issues/comments/$id" --jq '.body // ""' 2>/dev/null || true)"
    [ -n "$body" ] || continue
    printf '%s\n' "$body" > "$WORK/target.md"
    strip_file "$WORK/target.md"
    if [ "$STRIPPED" = "1" ]; then
      if [ "$DRY_RUN" = "true" ]; then
        echo "[dry-run] ${kind}-Kommentar #$id: Bild-Referenzen würden entfernt."
      elif gh_retry gh api --method PATCH "repos/$REPO/issues/comments/$id" -F "body=@$WORK/target.md"; then
        echo "🧼 ${kind}-Kommentar #$id: Bild-Referenzen entfernt."
      else
        echo "::warning title=Bild-Entfernung fehlgeschlagen::$kind-Kommentar #$id — Best-effort."
      fi
    fi
  done < <(gh_retry gh api "repos/$REPO/issues/$num/comments?per_page=100" --paginate \
    --jq '.[].id' 2>/dev/null || true)
}

# --- 1) PR-Body ---------------------------------------------------------------
printf '%s' "$(gh_retry gh pr view "$PR" --repo "$REPO" --json body --jq '.body // ""' 2>/dev/null || true)" \
  > "$WORK/target.md"
strip_file "$WORK/target.md"
if [ "$STRIPPED" = "1" ]; then
  if [ "$DRY_RUN" = "true" ]; then
    echo "[dry-run] PR-Body #$PR: Bild-Referenzen würden entfernt."
  elif gh_retry gh pr edit "$PR" --repo "$REPO" --body-file "$WORK/target.md"; then
    echo "🧼 PR-Body #$PR: Bild-Referenzen entfernt."
  else
    echo "::warning title=Bild-Entfernung fehlgeschlagen::PR-Body #$PR — Best-effort."
  fi
fi

# --- 2) PR-Kommentare (PRs sind Issues → derselbe Endpoint) -------------------
strip_comments "$PR" "PR"

# --- 3) Closing-Issues: Bodies + Kommentare -----------------------------------
while IFS= read -r issue; do
  [ -n "$issue" ] || continue
  printf '%s' "$(gh_retry gh api "repos/$REPO/issues/$issue" --jq '.body // ""' 2>/dev/null || true)" \
    > "$WORK/target.md"
  strip_file "$WORK/target.md"
  if [ "$STRIPPED" = "1" ]; then
    if [ "$DRY_RUN" = "true" ]; then
      echo "[dry-run] Issue-Body #$issue: Bild-Referenzen würden entfernt."
    elif gh_retry gh api --method PATCH "repos/$REPO/issues/$issue" -F "body=@$WORK/target.md"; then
      echo "🧼 Issue-Body #$issue: Bild-Referenzen entfernt."
    else
      echo "::warning title=Bild-Entfernung fehlgeschlagen::Issue-Body #$issue — Best-effort."
    fi
  fi
  strip_comments "$issue" "Issue"
done < <(gh_retry gh pr view "$PR" --repo "$REPO" --json closingIssuesReferences \
  --jq '.closingIssuesReferences[].number' 2>/dev/null || true)

echo "🧼 Bild-Sweep abgeschlossen (PR #$PR)."
