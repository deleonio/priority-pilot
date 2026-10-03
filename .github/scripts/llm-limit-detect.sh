#!/usr/bin/env bash
# Erkennt einen echten Limit-Abbruch des Claude-Aufrufs (#1954). Ein Lauf gilt nur dann
# als Limit-Abbruch, wenn der Aufruf SELBST fehlschlug (outcome=failure — echte Abbrueche
# enden nach wenigen Sekunden mit Exit 1) UND die Limit-Zeile die LETZTE Ausgabe ist.
# Ein Lauf, der den Satz nur zitiert (etwa aus einem Ticket-Text) und normal mit Verdict
# endet, ist keiner — der bisherige Volltext-grep wertete ihn falsch und liess die Labels
# ohne Hinweis stehen.
#
# Das Limit-Muster steht NUR hier (#1954 AK3): die Label-Zweige in 04-implement.yml und
# team.yml sowie der diagnostische Check in llm-fair-usage-check/action.yml beziehen es
# ueber `pattern` bzw. `pattern --wide`.
#
# Ausgabe (stdout, key=value):
#   detect: limit=true|false  line=<Trefferzeile, einzeilig gekappt>
#           Fehlendes Log / outcome != failure -> limit=false (Safe-Default: Lauf
#           normal behandeln statt Labels stehen zu lassen).
#   pattern [--wide]: gibt das Muster fuer grep -E aus. --wide zusaetzlich die rein
#           diagnostischen Treffer (1310/1313, Fair Usage, Limit Exhausted).
#
# Usage:
#   llm-limit-detect.sh detect --log <datei> --outcome <success|failure>
#   llm-limit-detect.sh pattern [--wide]

set -uo pipefail

LOG_FILE="/tmp/claude-output.log"
OUTCOME=""
WIDE="false"
CMD="${1:-}"
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --log) LOG_FILE="$2"; shift 2 ;;
    --outcome) OUTCOME="$2"; shift 2 ;;
    --wide) WIDE="true"; shift ;;
    *) shift ;;
  esac
done

# Abbruch-Muster: Klartext-Familie, mit der die CLI einen Kontingent-Abbruch beendet.
PATTERN='hit your (session|usage|weekly|monthly) limit'
# Diagnose-Muster: nur fuer den informativen llm-fair-usage-check (der auch Zitate
# sichtbar machen will — dort ist jeder Treffer Information, kein Verdict).
PATTERN_WIDE="$PATTERN|\[131[03]\]|Fair Usage Policy|Limit Exhausted"

case "$CMD" in
  pattern)
    if [ "$WIDE" = "true" ]; then
      printf '%s\n' "$PATTERN_WIDE"
    else
      printf '%s\n' "$PATTERN"
    fi
    exit 0
    ;;
  detect)
    if [ "$OUTCOME" != "failure" ]; then
      echo "limit=false"
      echo "line=(Aufruf-Outcome '${OUTCOME:-leer}' != failure — kein Limit-Abbruch)"
      exit 0
    fi
    if [ ! -s "$LOG_FILE" ]; then
      echo "limit=false"
      echo "line=(Log fehlt oder ist leer — keine Aussage moeglich)"
      exit 0
    fi
    # Letzte nicht-leere Zeile: echte Abbrueche enden auf der Limit-Zeile (#1954-Beleg).
    # grep-Exit-Codes sind hier die Antwort, kein Fehler — || true haelt -e/pipefail ruhig.
    LAST_LINE="$(grep -v '^[[:space:]]*$' "$LOG_FILE" | tail -1 | tr -d '\n\r' || true)"
    if [ -n "$LAST_LINE" ] && printf '%s' "$LAST_LINE" | grep -qE "$PATTERN"; then
      echo "limit=true"
      printf 'line=%s\n' "$(printf '%s' "$LAST_LINE" | cut -c1-400)"
    else
      echo "limit=false"
      echo "line=(letzte Ausgabe ist keine Limit-Zeile)"
    fi
    exit 0
    ;;
  *)
    echo "Usage: llm-limit-detect.sh detect --log <datei> --outcome <success|failure> | pattern [--wide]" >&2
    exit 2
    ;;
esac
