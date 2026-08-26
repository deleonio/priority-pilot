#!/usr/bin/env bash
# Einmaliger Backfill des Bild-Sweeps (Issue #1021, Datenschutz) für den kompletten
# historischen Altbestand: pr-image-strip.sh lief bisher nur automatisch bei einem
# PR-MERGE bzw. einzeln per workflow_dispatch-Catch-up (s. 06-claude-pr-documenter.yml).
# PRs/Issues von VOR Einführung des Sweeps blieben unbereinigt.
#
# Zieht ihn hier einmalig über den gesamten Altbestand nach:
#   1) alle gemergten PRs — deckt PR-Body, PR-Kommentare (Konversation + Inline-Review)
#      und Bodies/Kommentare ALLER Closing-Issues dieses PRs ab (pr-image-strip.sh im
#      --pr-Modus, unverändert).
#   2) alle geschlossenen Issues direkt — deckt zusätzlich Issues ab, die NICHT als
#      Closing-Issue eines gemergten PRs verlinkt sind (pr-image-strip.sh im --issue-Modus).
#
# Überschneidung zwischen (1) und (2) ist gewollt und harmlos: ein Issue, das bereits
# über (1) bereinigt wurde, ist beim Durchlauf in (2) ein No-op (PATCH nur bei
# tatsächlicher Änderung, s. strip-images.mjs changed=0/1 — Idempotenz-Grundlage).
#
# Best-effort wie der Basis-Sweep: ein fehlgeschlagener Einzel-Sweep (transienter
# API-Fehler) bricht den Backfill nicht ab, sondern zählt in der Zusammenfassung.
#
# Lokal testbar (kein Schreiben): --dry-run als zweites Argument.
set -uo pipefail

REPO="${1:?usage: image-strip-backfill.sh <owner/repo> [--dry-run]}"
DRY_RUN_FLAG=""
[ "${2:-}" = "--dry-run" ] && DRY_RUN_FLAG="--dry-run"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v node >/dev/null 2>&1 || {
  echo "::error title=node fehlt::Backfill abgebrochen — pr-image-strip.sh braucht Node."
  exit 1
}

pr_total=0
pr_failed=0
echo "::group::1) Gemergte PRs (Body, Kommentare, Closing-Issues)"
while IFS= read -r pr; do
  [ -n "$pr" ] || continue
  pr_total=$((pr_total + 1))
  echo "--- PR #$pr ---"
  bash "$SCRIPT_DIR/pr-image-strip.sh" --repo "$REPO" --pr "$pr" $DRY_RUN_FLAG \
    || { echo "::warning title=Sweep fehlgeschlagen::PR #$pr — Best-effort, Backfill läuft weiter."; pr_failed=$((pr_failed + 1)); }
done < <(gh api "repos/$REPO/pulls?state=closed&per_page=100" --paginate \
  --jq '.[] | select(.merged_at != null) | .number' 2>/dev/null || true)
echo "::endgroup::"

issue_total=0
issue_failed=0
echo "::group::2) Alle geschlossenen Issues direkt (Body + Kommentare, auch ohne PR-Link)"
while IFS= read -r issue; do
  [ -n "$issue" ] || continue
  issue_total=$((issue_total + 1))
  echo "--- Issue #$issue ---"
  bash "$SCRIPT_DIR/pr-image-strip.sh" --repo "$REPO" --issue "$issue" $DRY_RUN_FLAG \
    || { echo "::warning title=Sweep fehlgeschlagen::Issue #$issue — Best-effort, Backfill läuft weiter."; issue_failed=$((issue_failed + 1)); }
done < <(gh api "repos/$REPO/issues?state=closed&per_page=100" --paginate \
  --jq '.[] | select(.pull_request == null) | .number' 2>/dev/null || true)
echo "::endgroup::"

echo ""
echo "=== Backfill abgeschlossen ==="
echo "PRs geprüft: $pr_total (Fehlschläge: $pr_failed)"
echo "Issues geprüft: $issue_total (Fehlschläge: $issue_failed)"
