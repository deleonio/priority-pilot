#!/usr/bin/env bash
# Bild-Entfernungs-Sweep des PR-Documenters (Issue #1021, Datenschutz): entfernt
# Bild-Referenzen aus PR-Body, allen PR-Kommentaren (Konversations- UND Inline-
# Review-Kommentare) sowie Bodies und Kommentaren ALLER Closing-Issues des PRs —
# ersetzt durch Platzhalter statt Löschung (Nachvollziehbarkeit; PATCH statt Delete).
#
# Limitation: Review-BODIES (die Zusammenfassung eines Reviews, ohne diff-bezogene
# Kommentare) sind per REST nicht editierbar — Bilder darin überleben den Sweep.
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
# --issue statt --pr: eigenständiger Modus für Issues OHNE verlinkten PR (Body +
# Kommentare des Issues selbst, keine PR-/Closing-Issue-Schritte). Genutzt vom
# historischen Backfill (image-strip-backfill.sh, Issue #1021 Nachzug), der damit
# auch manuell/ohne Merge geschlossene Issues erfasst, die kein --pr-Lauf sieht.
#
# Lokal testbar (kein Schreiben): --dry-run

set -uo pipefail

REPO=""
PR=""
ISSUE=""
DRY_RUN="false"
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --pr) PR="$2"; shift 2 ;;
    --issue) ISSUE="$2"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift ;;
    *) shift ;;
  esac
done
[ -n "$REPO" ] || { echo "pr-image-strip: --repo required" >&2; exit 2; }
[ -n "$PR" ] || [ -n "$ISSUE" ] || { echo "pr-image-strip: --pr or --issue required" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ohne Node läuft strip-images.mjs nicht — offen melden statt still zu no-open (der
# Sweep wäre sonst ein Schein-Erfolg für ein Datenschutz-Ziel).
command -v node >/dev/null 2>&1 || {
  echo "::warning title=node fehlt::Bild-Entfernung übersprungen — strip-images.mjs braucht Node."
  exit 0
}

# gh-Aufrufe mit Retry (exponentiell, 5 Versuche: 1/2/4/8s) — grosszuegiger als die
# 3-Versuche/linear-Variante in pr-doc-render.sh, weil der Backfill (image-strip-
# backfill.sh) denselben Aufruf einige hundert Mal in Folge macht und damit eher in
# GitHubs sekundäres Rate-Limit läuft als ein einzelner PR-Merge-Lauf (Review-Finding
# PR #1043 F5).
gh_retry() {
  local n=1
  until "$@"; do
    if [ "$n" -ge 5 ]; then return 1; fi
    sleep "$((2 ** (n - 1)))"
    n=$((n + 1))
  done
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Zaehlt tatsaechlich fehlgeschlagene PATCH/EDIT-Versuche (nicht: leere Listings oder
# bildfreie Objekte). Als "failures=<n>"-Zeile auf stdout ausgegeben — der Aufrufer
# (image-strip-backfill.sh) summiert das ueber alle PRs/Issues auf. Der Exit-Code
# selbst bleibt bewusst 0 (s. Kopf-Kommentar): ein fehlgeschlagenes Einzel-PATCH darf
# die ai:documented-Invariante im produktiven --pr-Pfad nicht blockieren (Review-Finding
# PR #1043 F2 — ohne dieses Signal war "Fehlschläge: 0" im Backfill strukturell blind).
FAILURES=0

# Stripped eine Datei in-place; setzt STRIPPED="1" wenn sich der Inhalt geändert hat.
strip_file() {
  local out
  out="$(node "$SCRIPT_DIR/strip-images.mjs" --in-place "$1" 2>/dev/null || echo changed=0)"
  if [ "$out" = "changed=1" ]; then STRIPPED="1"; else STRIPPED="0"; fi
}

# Bodies byte-identisch nach $WORK/target.md laden: direkter Redirect statt "$(…)"
# (Command-Substitution strippt ALLE trailing Newlines des Bodys). gh hängt an jede
# --jq-Ausgabe genau einen Newline an (Println) — genau den zu entfernen.
#
# WARUM NICHT `head -c -1`: Negative Counts sind GNU-only — macOS-BSD-head bricht mit
# "illegal byte count -- -1" ab (jeder fetch_body schlägt lokal fehl, gh_retry wertet
# das als API-Fehler und schläft pro Kommentar 1+2+4+8+16 s — lokal wirkt der Sweep wie
# eine Endlosschleife, in CI läuft er grün). Positiver Count via wc -c ist BSD+GNU
# gemeinsam und stript byte-identisch dasselbe: alles außer dem letzten Byte.
fetch_body() {
  "$@" > "$WORK/raw.md" 2>/dev/null || true
  local n
  n="$(wc -c < "$WORK/raw.md" | tr -d '[:space:]')"
  if [ "${n:-0}" -gt 0 ]; then
    head -c "$((n - 1))" "$WORK/raw.md" > "$WORK/target.md" || : > "$WORK/target.md"
  else
    : > "$WORK/target.md"
  fi
}

# Ein Objekt (PR oder Issue) über dessen Kommentare iterieren und bereinigen.
# $1 = Nummer des Issues/PR, $2 = Art (nur für Log-Meldungen), $3 = Quelle:
#   "issue" → Konversations-Kommentare via issues/$n/comments (PRs sind Issues)
#   "pull"  → Inline-Review-Kommentare via pulls/$n/comments (eigener Endpoint;
#             GET/PATCH der einzelnen Kommentare laufen über pulls/comments/$id)
strip_comments() {
  local num="$1" kind="$2" source="$3" id list comment_base
  if [ "$source" = "pull" ]; then
    list="repos/$REPO/pulls/$num/comments?per_page=100"
    comment_base="repos/$REPO/pulls/comments"
  else
    list="repos/$REPO/issues/$num/comments?per_page=100"
    comment_base="repos/$REPO/issues/comments"
  fi
  while IFS= read -r id; do
    [ -n "$id" ] || continue
    fetch_body gh_retry gh api "$comment_base/$id" --jq '.body // ""'
    [ -s "$WORK/target.md" ] || continue
    strip_file "$WORK/target.md"
    if [ "$STRIPPED" = "1" ]; then
      if [ "$DRY_RUN" = "true" ]; then
        echo "[dry-run] ${kind}-Kommentar #$id: Bild-Referenzen würden entfernt."
      elif gh_retry gh api --method PATCH "$comment_base/$id" -F "body=@$WORK/target.md"; then
        echo "🧼 ${kind}-Kommentar #$id: Bild-Referenzen entfernt."
      else
        echo "::warning title=Bild-Entfernung fehlgeschlagen::$kind-Kommentar #$id — Best-effort."
        FAILURES=$((FAILURES + 1))
      fi
    fi
  done < <(gh_retry gh api "$list" --paginate \
    --jq '.[].id' 2>/dev/null || true)
}

# Bereinigt Body + Konversations-Kommentare EINES Issues. Gemeinsamer Kern für Schritt 3
# (Closing-Issues eines PRs) und den eigenständigen --issue-Modus (Backfill ohne PR-Link).
strip_issue() {
  local issue="$1"
  fetch_body gh_retry gh api "repos/$REPO/issues/$issue" --jq '.body // ""'
  strip_file "$WORK/target.md"
  if [ "$STRIPPED" = "1" ]; then
    if [ "$DRY_RUN" = "true" ]; then
      echo "[dry-run] Issue-Body #$issue: Bild-Referenzen würden entfernt."
    elif gh_retry gh api --method PATCH "repos/$REPO/issues/$issue" -F "body=@$WORK/target.md"; then
      echo "🧼 Issue-Body #$issue: Bild-Referenzen entfernt."
    else
      echo "::warning title=Bild-Entfernung fehlgeschlagen::Issue-Body #$issue — Best-effort."
      FAILURES=$((FAILURES + 1))
    fi
  fi
  strip_comments "$issue" "Issue" "issue"
}

if [ -n "$PR" ]; then
  # --- 1) PR-Body ---------------------------------------------------------------
  fetch_body gh_retry gh pr view "$PR" --repo "$REPO" --json body --jq '.body // ""'
  strip_file "$WORK/target.md"
  if [ "$STRIPPED" = "1" ]; then
    if [ "$DRY_RUN" = "true" ]; then
      echo "[dry-run] PR-Body #$PR: Bild-Referenzen würden entfernt."
    elif gh_retry gh pr edit "$PR" --repo "$REPO" --body-file "$WORK/target.md"; then
      echo "🧼 PR-Body #$PR: Bild-Referenzen entfernt."
    else
      echo "::warning title=Bild-Entfernung fehlgeschlagen::PR-Body #$PR — Best-effort."
      FAILURES=$((FAILURES + 1))
    fi
  fi

  # --- 2) PR-Kommentare: Konversation (PRs sind Issues → issues-Endpoint) und
  #        Inline-Review-Kommentare (diff-bezogen, eigener pulls-Endpoint) ---------
  strip_comments "$PR" "PR" "issue"
  strip_comments "$PR" "Inline-Review" "pull"

  # --- 3) Closing-Issues: Bodies + Kommentare -----------------------------------
  while IFS= read -r issue; do
    [ -n "$issue" ] || continue
    strip_issue "$issue"
  done < <(gh_retry gh pr view "$PR" --repo "$REPO" --json closingIssuesReferences \
    --jq '.closingIssuesReferences[].number' 2>/dev/null || true)
fi

# --- Eigenständiger --issue-Modus: Issue direkt bereinigen (kein PR-Link) --------
if [ -n "$ISSUE" ]; then
  strip_issue "$ISSUE"
fi

echo "🧼 Bild-Sweep abgeschlossen (${PR:+PR #$PR}${PR:+${ISSUE:+, }}${ISSUE:+Issue #$ISSUE})."
echo "failures=$FAILURES"
