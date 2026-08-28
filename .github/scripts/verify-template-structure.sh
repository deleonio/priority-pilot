#!/usr/bin/env bash
# Template-Struktur pruefen NACH einem Analyse-Body-Edit — rein mechanisch, ohne LLM.
#
# ZWECK: Die Triage schreibt den Issue-Body komplett neu (Copyedit + KI-ANALYSE-Block,
# SKILL Step 2/4) — auch bei Re-Triage. Der Vorab-Check (verify-issue-quality.sh)
# skippt sich bei bestehendem Analyse-Block selbst. Dieses Skript ist der Post-Check:
# Es stellt sicher, dass die vier Ticket-Template-Ueberschriften den Edit ueberlebt
# haben. Fehlt eine, lesen Folgearbeiten (UX/Spec/Implementierung) ihre Eingaben aus
# Abschnitten, die nicht mehr existieren.
#
# GEPRUEFT WIRD (nur Struktur, nie Inhalt — Copyedit darf Inhalte glätten):
#   - Je Template-Überschrift: mindestens EINE Zeile, die als Markdown-Heading
#     beginnt (^#+) und die Überschrift enthaelt (case-insensitive, Substring —
#     deckungsgleich mit section() in verify-issue-quality.sh; GitHub Forms
#     erzeugen H3-Labels MIT Fragezeichen, manuelle Tickets oft H2 ohne).
#
# FAIL-SAFE-RICHTUNG: Unlesbare Datei oder leerer Output blockieren die Pipeline
# nie — wie beim Guete-Gate ist das ein inhaltlicher Filter, kein Infra-Gate.
#
# Usage:
#   bash verify-template-structure.sh --body-file <datei>
#
# stdout (einzeilig, ASCII — maschinengelesen vom Workflow-Step):
#   ok=true|false
#   reason=<kurze Begruendung>
#   missing=<fehlende Ueberschriften, "; "-separiert>   (nur bei ok=false)
#
# Exit: 0 immer; 2 nur bei Parameterfehlern.
set -uo pipefail

BODY_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --body-file) BODY_FILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[[ -n "$BODY_FILE" ]] || { echo "verify-template-structure: --body-file ist Pflicht" >&2; exit 2; }

# Die vier Pflicht-Ueberschriften des Ticket-Templates (.github/ISSUE_TEMPLATE/ticket.yml).
# Ohne Fragezeichen: Substring-Match trifft beide Formen (mit/ohne "?").
H_PROBLEM="Was ist das Problem"
H_EXPECTED="Wie soll es sein"
H_SCOPE="Wo tritt es auf"
H_CRITERIA="Woran messen wir das"

BODY="$(cat "$BODY_FILE" 2>/dev/null)" || {
  printf 'ok=true\nreason=Body-Datei nicht lesbar — Pruefung uebersprungen (fail-safe).\n'
  exit 0
}

# Ueberschrift vorhanden? Markdown-Heading-Zeile (^#+ …), die den Text enthaelt.
# -i: case-insensitive; Substring statt Anker: verhindert Fehlalarm bei "?"/Zusatztext,
# verlangt aber zwingend das fuehrende "#" (Fliesstext-Nennungen zaehlen nicht).
# KEINE Pipe: unter pipefail wuerde `printf | grep -q` bei Bodies groesser als der
# Pipe-Buffer (64 KB) den SIGPIPE-Exit (141) von printf als "nicht gefunden" melden
# (grep -q exitet nach dem Erstmatch) — Herestring liest grep aus einer temp. Datei.
has_heading() {
  grep -qiE "^#+[[:space:]]*.*$1" <<<"$BODY"
}

MISSING=""
check() { # <suchtext>
  has_heading "$1" || MISSING="${MISSING:+$MISSING; }$1"
}
check "$H_PROBLEM"
check "$H_EXPECTED"
check "$H_SCOPE"
check "$H_CRITERIA"

if [ -n "$MISSING" ]; then
  printf 'ok=false\n'
  printf 'reason=Template-Ueberschriften fehlen nach Analyse-Edit\n'
  printf 'missing=%s\n' "$MISSING"
  exit 0
fi

printf 'ok=true\nreason=Template-Struktur intakt\n'
