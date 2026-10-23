#!/usr/bin/env bash
# ai-container-result-Marker aus beiden Fundorten extrahieren (#2101, #2590).
#
# WARUM ZWEI FUNDORTE: Die Abschluss-Analyse soll den Marker in ihre Agenten-Ausgabe
# schreiben (Stdout, landet per tee in /tmp/claude-output.log) — Run 38538991189
# (Gruppe #2533) legte ihn stattdessen nur in den Harness-Kommentar ab, der Step las
# nur das Log und endete still. Seit #2590 durchsucht dieser Extraktor zuerst das
# Log, dann den Body des Harness-Kommentars (der Step holt ihn via harness-comment.sh
# in eine Temp-Datei). Ausgabe gewinnt.
#
# Dieses Skript ist die Workflow-Seite (Runner-Bash) und bleibt absichtlich OHNE gh:
# reine Datei-Inputs, damit der Stub-Test keine gh-Emulation braucht. Das GitHub-Holen
# bleibt im Step.
#
# Usage:
#   bash container-result.sh extract --log <datei> --body-file <datei>
#
# Ausgabe (stdout, key=value, ASCII):
#   payload=<json ohne Zeilenumbrueche>   leer, wenn kein Marker gefunden
#   source=log|comment|                   leer, wenn kein Marker gefunden
#
# Nie exit != 0 fuer "nicht gefunden" (fail-open, wie harness-comment.sh); nur
# Argumentfehler exiten hart, und zwar mit 2.
set -uo pipefail

MODE=""
LOG=""
BODY_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    extract) MODE="extract"; shift ;;
    # Wert-Flags mit $#-Guard: Ohne Wert wuerde $2 unter set -u mit Exit 1
    # crashen — nur Argumentfehler exiten laut Kopf hart, und zwar mit 2.
    --log)       [ $# -ge 2 ] || { echo "container-result: --log braucht einen Wert" >&2; exit 2; }
                 LOG="$2"; shift 2 ;;
    --body-file) [ $# -ge 2 ] || { echo "container-result: --body-file braucht einen Wert" >&2; exit 2; }
                 BODY_FILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ "$MODE" = "extract" ] || { echo "container-result: Unterbefehl extract ist Pflicht" >&2; exit 2; }

# Marker-Koerper zu einer einzeiligen JSON-Zeile — awk-Kette deckungsgleich mit dem
# bisherigen Step-Parsing (01-triage.yml bis #2590), damit bestehende Laeufe
# identisch parsen.
extract() {
  awk '/ai-container-result:START/{f=1;next} /ai-container-result:END/{f=0} f' "$1" 2>/dev/null \
    | awk '/^```json/{f=1;next} f && /^```/{exit} f' | tr -d '\r' | awk 'NF' \
    | tr '\n' ' ' | sed 's/[[:space:]]*$//'
}

PAYLOAD=""
SOURCE=""
if [ -n "$LOG" ] && [ -f "$LOG" ]; then
  PAYLOAD="$(extract "$LOG")"
  [ -n "$PAYLOAD" ] && SOURCE="log"
fi
if [ -z "$PAYLOAD" ] && [ -n "$BODY_FILE" ] && [ -f "$BODY_FILE" ]; then
  PAYLOAD="$(extract "$BODY_FILE")"
  [ -n "$PAYLOAD" ] && SOURCE="comment"
fi

printf 'payload=%s\n' "$PAYLOAD"
printf 'source=%s\n' "$SOURCE"
exit 0
