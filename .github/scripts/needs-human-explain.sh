#!/usr/bin/env bash
# Erklärungs-Gate für ai:needs-human: Das Label darf nur mit einem Kommentar
# gesetzt werden, den der Mensch ohne Suche auflösen kann.
#
# WARUM: Die Setz-Pfade in 05/06 posteten teils Erklärungen, die nichts trugen —
# Crash- und No-Progress-Kommentare erklärten den Pipeline-Mechanismus statt die
# Ursache (PR #870, #842), Verdict-Kommentare verwiesen auf Sektionen, die so
# nicht existierten (PR #848). Vorbild ist PR #844: Erklärungs-Kommentar mit
# Marker (Was/Wo/Optionen/Empfehlung), per Permalink eindeutig auffindbar.
#
# Drei Bausteine für die Label-Post-Assertion-Steps der Workflows 05/06:
#   lookup  — jüngsten Erklärungs-Kommentar DIESES Laufes finden und Permalink
#             + Finding-Titel liefern. Mit --since zählen nur Kommentare seit
#             Lauf-Beginn, damit kein alter Marker referenziert wird (#842).
#             Modi: decisions (Marker ai-fixup-decisions), review (Marker
#             ai-review), review-section (ai-review MIT Sektion
#             „Entscheidungs-Findings" — Substring-Prüfung, tolerant gegenüber
#             Heading-Level/Emoji, weil das LLM in #848 abwich).
#   logtail — gesäuberter Log-Auszug aus /tmp/claude-output.log. Dort steht die
#             echte Ursache (402 Credits, 1313 Fair Usage, API-Fehler), nicht im
#             generischen Workflow-Text.
#   post    — Kommentar posten, es sei denn, der jüngste Kommentar am PR ist
#             wortidentisch (Dedupe gegen die Doppel-Posts aus #870/#848).
#
# Bash (kein .ts): reine gh-/jq-Wrapper-Logik, analog check-phase-label.sh —
# lokal ausführbar gegen echte PRs:
#   bash .github/scripts/needs-human-explain.sh lookup --repo o/r --pr 42 \
#        --mode decisions --since 2026-08-18T06:00:00Z
#
# Ausgabe: key=value auf stdout (lookup/post), Rohtext mehrzeilig (logtail).
# Fehler sind NIE fatal: lookup meldet dann status=missing und der Workflow
# postet seine eigene Diagnose — die sichere Richtung für die Regel.

set -uo pipefail

CMD="${1:-}"
[ $# -gt 0 ] && shift

REPO=""
PR=""
MODE=""
SINCE=""
BODY_FILE=""
LOG_FILE="/tmp/claude-output.log"
LOG_LINES="25"

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    # --ticket ist ein Alias für --pr: `lookup` fragt ohnehin den Endpunkt
    # repos/…/issues/<n>/comments ab, der für Issues UND PRs dieselben Kommentare
    # liefert. Der Alias macht nur lesbar, dass die Triage (Phase 01) ein ISSUE
    # prüft — die Mechanik ist identisch, es gibt keinen zweiten Codepfad.
    --pr|--ticket) PR="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --since) SINCE="$2"; shift 2 ;;
    --body-file) BODY_FILE="$2"; shift 2 ;;
    --file) LOG_FILE="$2"; shift 2 ;;
    --lines) LOG_LINES="$2"; shift 2 ;;
    *) shift ;;
  esac
done

case "$CMD" in
  lookup)
    [ -n "$REPO" ] && [ -n "$PR" ] && [ -n "$MODE" ] || { echo "lookup: --repo/--pr/--mode required" >&2; exit 2; }
    case "$MODE" in
      # startswith statt contains: Die Workflow-Action-Cards zitieren den Marker
      # TEXTLICH ("steht im Kommentar mit Marker <!-- ai-fixup-decisions -->",
      # #844) — contains hätte die Card statt der Erklärung getroffen. Der
      # Konvention folgt der Marker am Kommentar-Anfang (wie <!-- ai-review -->).
      # Postet das LLM ihn mitten im Text, gilt lookup als missing und der
      # Workflow postet seine Diagnose — die Regel bleibt erfüllt.
      decisions) FILTER='[.[] | select(.body | startswith("<!-- ai-fixup-decisions -->"))] | last' ;;
      review) FILTER='[.[] | select(.body | startswith("<!-- ai-review -->"))] | last' ;;
      review-section) FILTER='[.[] | select((.body | startswith("<!-- ai-review -->")) and (.body | test("Entscheidungs-Findings")))] | last' ;;
      # triage: Erklärung der Analyse-Phase, wenn sie das Ticket als nicht
      # eindeutig einstuft. Ohne diesen Kommentar darf ai:needs-human NICHT
      # gesetzt werden — ein Label ohne Begründung verlagert die Analysearbeit
      # zurück auf den Menschen und ist damit wertlos.
      triage) FILTER='[.[] | select(.body | startswith("<!-- ai-triage-decision -->"))] | last' ;;
      *) echo "lookup: unbekannter Modus '$MODE' (erlaubt: decisions review review-section triage)" >&2; exit 2 ;;
    esac

    # Mit Retry: unmittelbar nach Claudes Post liefert die API den Kommentar
    # (Replikationsverzögerung) gelegentlich noch nicht — gleiche Lektion wie der
    # Marker-Check in 05 (PR #524).
    COMMENTS="[]"
    for attempt in 1 2 3; do
      COMMENTS="$(gh api "repos/${REPO}/issues/${PR}/comments?per_page=100&since=${SINCE}" 2>/dev/null || echo '[]')"
      [ "$(printf '%s' "$COMMENTS" | jq -r "$FILTER | select(. != null) | .id" 2>/dev/null)" != "" ] && break
      [ "$attempt" -lt 3 ] && sleep "$attempt"
    done

    BODY="$(printf '%s' "$COMMENTS" | jq -r "$FILTER | select(. != null) | .body" 2>/dev/null || true)"
    if [ -z "$BODY" ]; then
      echo "status=missing"
      exit 0
    fi

    PERMALINK="$(printf '%s' "$COMMENTS" | jq -r "$FILTER | select(. != null) | .html_url" 2>/dev/null || true)"

    # Kommentar-Metadaten (Issue #961): Der Fixup-Workflow merkt sich beim Start-
    # Konsum id + updated_at des letzten ai-review-Sammelkommentars als Baseline
    # und erkennt am Laufende daran das Review-Delta (Sammelkommentar wird über
    # Runden FORTGESCHRIEBEN — eine ID, wechselndes updatedAt; nur die ID wäre
    # blind gegen in-place Edits). Für die anderen Modi harmloses Beiwerk.
    COMMENT_ID="$(printf '%s' "$COMMENTS" | jq -r "$FILTER | select(. != null) | .id" 2>/dev/null || true)"
    COMMENT_UPDATED="$(printf '%s' "$COMMENTS" | jq -r "$FILTER | select(. != null) | .updated_at" 2>/dev/null || true)"

    # Finding-Titel: Markdown-Headings und nummerierte Listeneinträge des
    # Erklärungs-Kommentars, einzeilig zusammengefasst (key=value-tauglich).
    FINDINGS="$(printf '%s\n' "$BODY" | tr -d '\r' \
      | grep -E '^#{1,6} [^#]|^[[:space:]]*[0-9]+\. ' \
      | sed -E 's/^#{1,6}[[:space:]]*//; s/^[[:space:]]*[0-9]+\.[[:space:]]*//' \
      | cut -c1-120 | head -8 \
      | awk 'NR>1{printf " | "} {printf "%s", $0} END{print ""}')"

    echo "status=found"
    echo "permalink=${PERMALINK}"
    [ -n "$COMMENT_ID" ] && echo "id=${COMMENT_ID}"
    [ -n "$COMMENT_UPDATED" ] && echo "updated_at=${COMMENT_UPDATED}"
    [ -n "$FINDINGS" ] && echo "findings=${FINDINGS}"
    ;;

  logtail)
    # ANSI-/Steuerzeichen komplett entfernen (portabler als sed-Escapes): der
    # Resttext einer OSC-Sequenz bleibt als Klartext stehen — kosmetisch, aber
    # unschädlich in einem Markdown-Codeblock.
    [ -r "$LOG_FILE" ] || exit 0
    # Fenster um die LETZTE VERDICT:-Zeile statt blinder letzter N Zeilen: Die
    # Begründung (Findings, Entscheidungs-Sektion) steht typischerweise VOR dem
    # Verdict — "letzte 25 Zeilen" schnitt sie systematisch ab und ließ nur
    # Noise übrig (PR #903, #944). Ohne VERDICT:-Zeile: Fallback tail
    # (Crash-Fall — dort steht die Ursache, z. B. 402/1313, am Ende).
    clean() { LC_ALL=C tr -d '\000-\010\013\014\016-\037'; }
    VLINE="$(grep -n 'VERDICT:' "$LOG_FILE" | tail -1 | cut -d: -f1)"
    if [ -n "$VLINE" ]; then
      START=$(( VLINE > LOG_LINES ? VLINE - LOG_LINES : 1 ))
      END=$(( VLINE + 3 ))
      sed -n "${START},${END}p" "$LOG_FILE" | clean | cut -c1-400
    else
      tail -n "$LOG_LINES" "$LOG_FILE" | clean | cut -c1-400
    fi
    ;;

  post)
    [ -n "$REPO" ] && [ -n "$PR" ] && [ -n "$BODY_FILE" ] || { echo "post: --repo/--pr/--body-file required" >&2; exit 2; }
    [ -r "$BODY_FILE" ] || { echo "post=missing-body"; exit 0; }
    # Dedupe: jüngsten Kommentar am PR holen (gh liefert ihn mit; scheitert die
    # Abfrage, wird gepostet — Fail-open, ein Duplikat ist besser als ein
    # verlorener Kommentar). Vergleich nach Trimmen schließender Leerzeilen.
    LAST="$(gh pr view "$PR" --repo "$REPO" --json comments --jq '[.comments[]] | last | .body // ""' 2>/dev/null || true)"
    NEW="$(cat "$BODY_FILE")"
    trim() { printf '%s' "$1" | sed -E 's/[[:space:]]+$//'; }
    if [ -n "$(trim "$LAST")" ] && [ "$(trim "$LAST")" = "$(trim "$NEW")" ]; then
      echo "post=dupe"
      exit 0
    fi
    if gh pr comment "$PR" --repo "$REPO" --body-file "$BODY_FILE" 2>/dev/null; then
      echo "post=new"
    else
      echo "post=failed"
    fi
    ;;

  *)
    echo "Usage: needs-human-explain.sh lookup --repo <o/r> --pr|--ticket <N> --mode <decisions|review|review-section|triage> [--since <ISO>]" >&2
    echo "       needs-human-explain.sh logtail [--file <path>] [--lines <N>]" >&2
    echo "       needs-human-explain.sh post --repo <o/r> --pr <N> --body-file <path>" >&2
    [ -n "$CMD" ] && echo "unbekannter Befehl: $CMD" >&2
    exit 2
    ;;
esac
