#!/usr/bin/env bash
# Modellwahl aus dem Label `ai:model:<alias>` auflösen — VOR dem Claude-Code-Start.
#
# WARUM EIN LABEL: `--model` und `ANTHROPIC_MODEL` gelten nur für die Session, mit der sie
# gestartet werden; ein Modellwechsel mitten im nicht-interaktiven Lauf ist nicht möglich.
# Die Entscheidung muss also VOR dem Start feststehen und ohne LLM-Aufruf lesbar sein.
# Ein Label ist trivial abfragbar, am Ticket sichtbar, manuell überschreibbar und braucht
# keine zusätzliche Zustandshaltung. Kein Freitext-Parsing, kein Issue-Body, keine Datei.
#
# QUELLE UND VORRANG (bewusst zweistufig):
#   1. Das Objekt selbst (Issue oder PR). Am PR gesetzt gewinnt es — so kann ein Mensch
#      hochstufen, ohne die Analyse zu wiederholen, und die Auto-Eskalation unten schreibt
#      ihr Ergebnis dorthin.
#   2. Fällt am PR nichts, das verknüpfte Issue (closingIssuesReferences). Damit bleibt die
#      Analyse die EINE Quelle der Wahrheit; das Label muss nicht auf den PR kopiert werden
#      und kann folglich auch nicht auseinanderlaufen.
#
# VALIDIERUNG: Genau EIN `ai:model:*` muss auflösbar sein. Bei keinem oder mehreren bricht
# der Start ab (abort=true) — bewusst NICHT still das erste oder das teuerste nehmen: eine
# stillschweigend geratene Modellwahl ist genau das Verhalten, gegen das dieser Umbau
# antritt. Der Aufrufer setzt dann `ai:needs-human` mit Begründung.
#
# AUTO-ESKALATION (--auto-escalate, nur --kind pr): Eine zu niedrig eingestufte Subtask
# erzeugt Review-Schleifen, die die Ersparnis auffressen (Hypothese 4 des Konzepts). Ab der
# zweiten Review-Runde am selben PR wird deshalb eine Stufe hochgesetzt
# (haiku -> sonnet -> opus, bei opus Ende). Runden werden an den `<!-- ai-review -->`-
# Markern gezählt — dasselbe Signal, das needs-human-explain.sh bereits nutzt.
#
# Usage:
#   bash resolve-model-label.sh --repo <owner/repo> --ticket <N> --kind <issue|pr> \
#                               [--auto-escalate]
#
# Ausgabe (stdout, key=value — die Action reicht sie nach GITHUB_OUTPUT durch):
#   model=<alias|leer>
#   abort=true|false
#   escalated=true|false
#   reason=<einzeiliger Klartext, nur bei abort=true>

set -uo pipefail

REPO=""
TICKET=""
KIND=""
AUTO_ESCALATE="false"
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --ticket) TICKET="$2"; shift 2 ;;
    --kind) KIND="$2"; shift 2 ;;
    --auto-escalate) AUTO_ESCALATE="true"; shift ;;
    *) shift ;;
  esac
done
[ -n "$REPO" ] || { echo "resolve-model-label: --repo required" >&2; exit 2; }
[ -n "$TICKET" ] || { echo "resolve-model-label: --ticket required" >&2; exit 2; }
case "$KIND" in
  issue|pr) ;;
  # Wie check-phase-label.sh: ein Tippfehler soll laut scheitern, nicht still ein
  # falsches Objekt lesen und damit die Modellwahl unbemerkt verfehlen.
  *) echo "resolve-model-label: --kind muss 'issue' oder 'pr' sein (war: '${KIND}')" >&2; exit 2 ;;
esac

# Präfix EINMAL definieren; `ai:model:` ist bewusst kein Pipeline-Trigger, sondern reine
# Konfiguration am Ticket (s. label-transition.sh, MANAGED).
PREFIX="ai:model:"

emit() {
  echo "model=${1}"
  echo "abort=${2}"
  echo "escalated=${3}"
  # reason trägt Labelnamen aus dem Event — einzeilig halten, sonst lassen sich über
  # $GITHUB_OUTPUT weitere Keys unterschieben (gleiche Leine wie in check-phase-label.sh).
  [ -n "${4:-}" ] && printf 'reason=%s\n' "$(printf '%s' "$4" | tr -d '\n\r')"
  exit 0
}

# Alle ai:model:*-Aliase eines Objekts, einer je Zeile.
aliases_of() {
  local kind="$1" number="$2" data
  if [ "$kind" = "pr" ]; then
    data="$(gh pr view "$number" --repo "$REPO" --json labels 2>/dev/null)"
  else
    data="$(gh issue view "$number" --repo "$REPO" --json labels 2>/dev/null)"
  fi
  [ -n "$data" ] || return 1
  printf '%s' "$data" | jq -r --arg p "$PREFIX" '.labels[].name | select(startswith($p)) | ltrimstr($p)'
}

SOURCE="$KIND"
FOUND="$(aliases_of "$KIND" "$TICKET")"
API_OK=$?

# FAIL-CLOSED (Gegenteil von check-phase-label.sh): Dort ist Fail-open richtig, weil eine
# verschluckte Phase teurer ist als ein doppelter Lauf. Hier startet direkt danach ein
# LLM-Lauf — ohne gesicherte Modellwahl liefe er auf dem settings.json-Default, also
# potenziell auf dem teuersten Modell. Im Zweifel also NICHT starten.
if [ "$API_OK" -ne 0 ]; then
  emit "" "true" "false" "Label-Abfrage für ${KIND} #${TICKET} fehlgeschlagen — fail-closed (ungeprüfte Modellwahl würde auf dem Default-Modell starten)"
fi

# Zweite Stufe: PR ohne eigenes Label erbt vom verknüpften Issue.
if [ "$KIND" = "pr" ] && [ -z "$FOUND" ]; then
  LINKED="$(gh pr view "$TICKET" --repo "$REPO" --json closingIssuesReferences \
    --jq '.closingIssuesReferences[0].number // empty' 2>/dev/null)"
  if [ -n "$LINKED" ]; then
    FOUND="$(aliases_of issue "$LINKED")"
    SOURCE="issue #${LINKED}"
  fi
fi

COUNT="$(printf '%s' "$FOUND" | grep -c . || true)"
if [ "$COUNT" -eq 0 ]; then
  emit "" "true" "false" "Kein '${PREFIX}*'-Label an ${KIND} #${TICKET} (und keines am verknüpften Issue) — die Analyse muss genau eines setzen."
fi
if [ "$COUNT" -gt 1 ]; then
  emit "" "true" "false" "Mehrdeutige Modellwahl an ${KIND} #${TICKET}: $(printf '%s' "$FOUND" | tr '\n' ' ')— genau ein '${PREFIX}*'-Label ist erlaubt."
fi

MODEL="$(printf '%s' "$FOUND" | head -1)"
case "$MODEL" in
  haiku|sonnet|opus|fable) ;;
  *) emit "" "true" "false" "Unbekannter Modell-Alias '${MODEL}' an ${KIND} #${TICKET} (Quelle: ${SOURCE}) — erlaubt: haiku | sonnet | opus | fable." ;;
esac

# ── Auto-Eskalation ──────────────────────────────────────────────────────────
ESCALATED="false"
if [ "$AUTO_ESCALATE" = "true" ] && [ "$KIND" = "pr" ]; then
  ROUNDS="$(gh pr view "$TICKET" --repo "$REPO" --json comments \
    --jq '[.comments[] | select(.body | contains("<!-- ai-review -->"))] | length' 2>/dev/null || echo 0)"
  [ -n "$ROUNDS" ] || ROUNDS=0
  if [ "$ROUNDS" -ge 2 ]; then
    case "$MODEL" in
      haiku)  MODEL="sonnet"; ESCALATED="true" ;;
      sonnet) MODEL="opus";   ESCALATED="true" ;;
      # opus/fable bleiben — höher geht es nicht, und ein weiterer Wechsel würde nur
      # Cache-Wärme kosten, ohne dass mehr Fähigkeit dazukäme.
      *) ;;
    esac
  fi
fi

emit "$MODEL" "false" "$ESCALATED"
