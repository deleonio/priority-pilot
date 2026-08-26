#!/usr/bin/env bash
# Entscheidet, ob die Spec-Phase für ein Ticket laufen muss — aus dem KI-ANALYSE-Block.
#
# WARUM ÜBERHAUPT ÜBERSPRINGBAR: Die Spec-Phase ist ein voller LLM-Lauf, der als Vertrag
# zwischen Analyse und Umsetzung ROTE TESTS liefert. Für Tickets, die keinen Anwendungscode
# anfassen, kann sie das per Definition nicht: Der Test-Carve-out (.claude/skills/ticket-spec/SKILL.md,
# ADR-0001) verbietet Tests auf Workflows, Skripte, Config und Markdown, weil ein
# String-Match auf selbst geschriebene Dateien per Konstruktion keinen Fehler findet. Übrig
# bliebe ein Spec-Dokument — dafür lohnt der Lauf nicht.
#
# WARUM FAIL-SAFE RICHTUNG SPEC: Jede Unsicherheit (Feld fehlt, unlesbar, Pfade unklar)
# führt zu needs_spec=true. TDD hat sich als stabil erwiesen und wird nicht aufgegeben; ein
# überflüssiger Spec-Lauf kostet Token, ein fälschlich übersprungener kostet den Vertrag,
# auf dem die Umsetzung aufsetzt. Die teurere Richtung ist die sichere.
#
# WARUM NICHT ALLEIN AUF DIE LLM-ANGABE VERTRAUEN: „spec: nein" in der Routing-Tabelle ist
# eine Selbstauskunft der Analyse. Das Konzept verlangt ausdrücklich, dass der Skip nicht
# zum bequemen Default wird. Deshalb wird die Angabe gegen die im Analyse-Block deklarierten
# „Betroffene Dateien" geprüft: Sobald ein Pfad in Anwendungscode zeigt, gilt die Spec als
# nötig — egal was die Tabelle sagt. Der Skip ist damit technisch begrenzt, nicht nur per Prompt.
#
# Usage:
#   bash resolve-spec-skip.sh --block-file <pfad>     # Datei mit dem Issue-Body
#   printf '%s' "$BODY" | bash resolve-spec-skip.sh   # oder über stdin
#
# Ausgabe (stdout, key=value):
#   needs_spec=true|false
#   reason=<einzeiliger Klartext>

set -uo pipefail

BLOCK_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --block-file) BLOCK_FILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -n "$BLOCK_FILE" ]; then
  BODY="$(cat "$BLOCK_FILE" 2>/dev/null || true)"
else
  BODY="$(cat || true)"
fi

# Anwendungscode-Präfixe — identisch zu denen, die 03-claude-spec.yml für die
# Artefakt-Prüfung nutzt (HAS_APP_TEST/TOUCHES_APP). EINE Definition, zwei Leser:
# liefen sie auseinander, könnte ein Ticket die Spec überspringen und in der
# Umsetzung trotzdem unter die Testpflicht fallen.
APP_PREFIXES='server/src/|frontend/src/|frontend/e2e/'

out() {
  echo "needs_spec=$1"
  printf 'reason=%s\n' "$(printf '%s' "$2" | tr -d '\n\r')"
  exit 0
}

# Leerer/unlesbarer Body: nichts zu entscheiden — Spec läuft.
[ -n "$BODY" ] || out true "Kein Analyse-Block lesbar — Spec läuft (fail-safe)."

field() {
  printf '%s' "$BODY" | grep -iE "^[[:space:]]*[-*]?[[:space:]]*$1:" | head -1 \
    | sed -E "s/^[^:]*:[[:space:]]*//" || true
}

# Run-Wert (ja|nein) einer Phase aus der ai-phase-routing-Tabelle — Parse-Logik
# deckungsgleich mit resolve-phase-routing.sh (Feld $3 der Markdown-Zeile).
routing_run() {
  printf '%s' "$BODY" | sed -n '/ai-phase-routing:START/,/ai-phase-routing:END/p' \
    | awk -F'|' -v ph="$1" '/^\|/ {
        c = $2; gsub(/[ \t]/, "", c)
        if (c == ph) { r = $3; gsub(/[ \t]/, "", r); print r; exit }
      }'
}

# UX-Bezug (ux-Zeile) erzwingt die Spec: Ein UX-Entwurf ohne Spezifikation ist nicht
# anschlussfähig — die Spec formalisiert ihn. `needs_ux ⇒ needs_spec` ist damit hier UND
# in 02 verankert (dessen ux-ready-Pfad setzt immer ai:needs-spec).
UX="$(routing_run ux)"
case "$UX" in
  ja) out true "Routing ux: ja — UX-Ergebnis braucht die Spec zur Formalisierung." ;;
esac

SPEC_FIELD="$(routing_run spec)"

# Zeile fehlt oder trägt etwas Unerwartetes → Spec läuft. Kein Raten.
case "$SPEC_FIELD" in
  nein) ;;
  ja) out true "Analyse verlangt die Spec (Routing spec: ja)." ;;
  '') out true "spec-Zeile fehlt in der Routing-Tabelle — Spec läuft (fail-safe)." ;;
  *) out true "spec-Zeile unlesbar ('${SPEC_FIELD}') — Spec läuft (fail-safe)." ;;
esac

# Ab hier steht „spec: nein" in der Tabelle. Gegenprobe an den deklarierten Pfaden.
DATEIEN="$(field 'Betroffene Dateien')"
[ -n "$DATEIEN" ] || out true "'spec: nein', aber keine 'Betroffene Dateien' deklariert — nicht überprüfbar, Spec läuft."

# Backticks/Kommata/Aufzählungszeichen zu Zeilen normalisieren, dann gegen die
# Anwendungscode-Präfixe prüfen. Ein Treffer genügt.
TREFFER="$(printf '%s' "$DATEIEN" | tr '`,;' '\n\n\n' | sed -E 's/^[[:space:]]*[-*][[:space:]]*//; s/^[[:space:]]+//; s/[[:space:]]+$//' \
  | grep -E "^($APP_PREFIXES)" | head -3 | tr '\n' ' ' || true)"

if [ -n "$TREFFER" ]; then
  out true "'spec: nein', aber Anwendungscode betroffen (${TREFFER}) — Spec läuft, TDD gilt dort."
fi

out false "Kein Anwendungscode betroffen (${DATEIEN}) — die Spec könnte hier keine Tests schreiben (Carve-out), Umsetzung übernimmt direkt."
