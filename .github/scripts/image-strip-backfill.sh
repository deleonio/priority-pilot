#!/usr/bin/env bash
# Einmaliger Backfill des Bild-Sweeps (Issue #1021, Datenschutz) für den kompletten
# historischen Altbestand: pr-image-strip.sh lief bisher nur automatisch bei einem
# PR-MERGE bzw. einzeln per workflow_dispatch-Catch-up (s. 06-claude-pr-documenter.yml).
# PRs/Issues von VOR Einführung des Sweeps blieben unbereinigt.
#
# Zieht ihn hier einmalig über den gesamten Altbestand nach:
#   1) alle GESCHLOSSENEN PRs (gemergt ODER verworfen) — deckt PR-Body, PR-Kommentare
#      (Konversation + Inline-Review) und Bodies/Kommentare ALLER Closing-Issues ab
#      (pr-image-strip.sh im --pr-Modus). Bewusst KEIN merged_at-Filter: ein verworfener
#      PR trägt dieselben Screenshots und denselben Datenschutzgrund; der --pr-Modus
#      liest nichts Merge-Spezifisches (Review-Finding PR #1043 F4).
#   2) alle geschlossenen Issues direkt — deckt zusätzlich Issues ab, die NICHT als
#      Closing-Issue eines PRs verlinkt sind (pr-image-strip.sh im --issue-Modus).
#
# SCOPE-ENTSCHEID (bewusst): Nur GESCHLOSSENE Vorgänge. Offene Issues/PRs bleiben
# unangetastet, weil ihre Screenshots noch aktiver Arbeitskontext sind (ein Bug-Report
# ohne sein Bild ist während der Bearbeitung wertlos). Für sie greift der reguläre
# Sweep automatisch, sobald sie geschlossen/gemergt werden — der Altbestand ist damit
# vollständig abgedeckt, nur zeitversetzt (Review-Finding PR #1043 F4, 2. Teil).
#
# Überschneidung zwischen (1) und (2) ist gewollt und harmlos: ein Issue, das bereits
# über (1) bereinigt wurde, ist beim Durchlauf in (2) ein No-op (PATCH nur bei
# tatsächlicher Änderung, s. strip-images.mjs changed=0/1 — Idempotenz-Grundlage).
#
# FEHLER SIND LAUT, NICHT STILL (Review-Findings PR #1043 F2/F3): Der Lauf wird manuell
# EINMAL ausgelöst; ein grüner Job ist das einzige Signal, dass der Datenschutz-Nachzug
# erfolgt ist. Deshalb:
#   - Ein fehlgeschlagenes LISTING bricht hart ab (exit 1) statt eine leere Schleife zu
#     drehen und "0 geprüft" als Erfolg zu melden.
#   - Fehlgeschlagene PATCHes werden aus pr-image-strip.sh über dessen "failures=<n>"-
#     Zeile herausgeführt und aufsummiert; am Ende exit 1 bei failures > 0. Der Exit-Code
#     des Kind-Prozesses taugt dafür nicht: pr-image-strip.sh ist bewusst best-effort
#     und endet in jedem Sweep-Pfad mit 0.
#   - Ein Lauf, der NICHTS gefunden hat (0 PRs UND 0 Issues), gilt als Fehler: bei einem
#     Repo mit Historie ist das kein legitimes Ergebnis, sondern ein stiller API-Ausfall.
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

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Sekundäres Rate-Limit von GitHub (~80 schreibende Requests/min) ist bei mehreren
# hundert Objekten die realistischste Abbruchursache. Alle THROTTLE_EVERY Objekte den
# Rest-Kontingent prüfen und bei Bedarf bis zum Reset warten, statt in den 403 zu laufen
# (Review-Finding PR #1043 F5). Im Dry-Run entfällt das: keine Schreib-Requests.
THROTTLE_EVERY=25
RATE_FLOOR=200
throttle() {
  [ -z "$DRY_RUN_FLAG" ] || return 0
  local remaining reset now wait
  remaining="$(gh api rate_limit --jq '.resources.core.remaining' 2>/dev/null || echo "")"
  [ -n "$remaining" ] || return 0 # Rate-Limit nicht lesbar: weiterlaufen, nicht raten
  if [ "$remaining" -lt "$RATE_FLOOR" ]; then
    reset="$(gh api rate_limit --jq '.resources.core.reset' 2>/dev/null || echo "")"
    now="$(date -u +%s)"
    wait=$((${reset:-0} - now + 5))
    if [ "$wait" -gt 0 ] && [ "$wait" -le 3900 ]; then
      echo "::notice title=Rate-Limit::Nur noch $remaining Requests — warte ${wait}s bis zum Reset."
      sleep "$wait"
    fi
  fi
}

# Listing MIT Exit-Code-Prüfung: "2>/dev/null || true" in einer Process-Substitution
# verschluckt Fehler und macht einen Totalausfall (Token abgelaufen, 403, API-Ausfall)
# ununterscheidbar von "nichts zu tun" (Review-Finding PR #1043 F3).
list_or_die() {
  local out="$1" what="$2" endpoint="$3" filter="$4"
  if ! gh api "$endpoint" --paginate --jq "$filter" > "$out" 2>"$WORK/list.err"; then
    echo "::error title=Listing fehlgeschlagen::$what nicht abrufbar — Backfill abgebrochen (kein Teil-Erfolg vortäuschen)."
    sed -n '1,5p' "$WORK/list.err" >&2 || true
    exit 1
  fi
}

# Einen Sweep ausführen, seine Ausgabe durchreichen und die "failures=<n>"-Zeile
# herausziehen. Fehlt die Zeile, ist das Kind vorzeitig gestorben — fail-closed als
# ein Fehlschlag zählen statt als Erfolg (Datenschutz-Ziel: lieber laut als leise).
SWEEP_FAILURES=0
run_sweep() {
  local out n
  out="$(bash "$SCRIPT_DIR/pr-image-strip.sh" "$@" $DRY_RUN_FLAG 2>&1)"
  printf '%s\n' "$out"
  n="$(printf '%s\n' "$out" | sed -n 's/^failures=\([0-9][0-9]*\)$/\1/p' | tail -1)"
  if [ -z "$n" ]; then
    echo "::warning title=Sweep unvollständig::$* — keine failures-Bilanz, zähle als Fehlschlag."
    n=1
  fi
  SWEEP_FAILURES=$((SWEEP_FAILURES + n))
}

# --- 1) Geschlossene PRs (gemergt UND verworfen) --------------------------------
list_or_die "$WORK/prs.txt" "Geschlossene PRs" \
  "repos/$REPO/pulls?state=closed&per_page=100" '.[] | .number'
pr_total=0
echo "::group::1) Geschlossene PRs (Body, Kommentare, Closing-Issues)"
while IFS= read -r pr; do
  [ -n "$pr" ] || continue
  pr_total=$((pr_total + 1))
  [ $((pr_total % THROTTLE_EVERY)) -eq 0 ] && throttle
  echo "--- PR #$pr ---"
  run_sweep --repo "$REPO" --pr "$pr"
done < "$WORK/prs.txt"
echo "::endgroup::"

# --- 2) Geschlossene Issues (select(.pull_request == null): PRs sind über den
#        issues-Endpoint ebenfalls sichtbar und liefen bereits in Schritt 1) -------
list_or_die "$WORK/issues.txt" "Geschlossene Issues" \
  "repos/$REPO/issues?state=closed&per_page=100" '.[] | select(.pull_request == null) | .number'
issue_total=0
echo "::group::2) Geschlossene Issues direkt (Body + Kommentare, auch ohne PR-Link)"
while IFS= read -r issue; do
  [ -n "$issue" ] || continue
  issue_total=$((issue_total + 1))
  [ $((issue_total % THROTTLE_EVERY)) -eq 0 ] && throttle
  echo "--- Issue #$issue ---"
  run_sweep --repo "$REPO" --issue "$issue"
done < "$WORK/issues.txt"
echo "::endgroup::"

echo ""
echo "=== Backfill abgeschlossen ==="
echo "PRs geprüft:     $pr_total"
echo "Issues geprüft:  $issue_total"
echo "Fehlgeschlagene Schreibversuche: $SWEEP_FAILURES"

# Ein Lauf ohne ein einziges Objekt ist in einem Repo mit Historie kein legitimes
# Ergebnis, sondern ein stiller Ausfall — nicht grün durchwinken.
if [ "$pr_total" -eq 0 ] && [ "$issue_total" -eq 0 ]; then
  echo "::error title=Nichts verarbeitet::Weder PRs noch Issues gefunden — das ist bei vorhandener Repo-Historie ein Fehler, kein Erfolg."
  exit 1
fi

if [ "$SWEEP_FAILURES" -gt 0 ]; then
  echo "::error title=Backfill unvollständig::$SWEEP_FAILURES Schreibversuch(e) fehlgeschlagen — Altbestand NICHT vollständig bereinigt. Lauf nach Klärung wiederholen (idempotent)."
  exit 1
fi

echo "::notice title=Backfill sauber::Alle $((pr_total + issue_total)) Objekte ohne Fehlschlag verarbeitet."
