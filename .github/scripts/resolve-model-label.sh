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

# Labels eines Objekts EINMAL holen (Ergebnis in LABELS_JSON). Rückgabe 0 = gelesen,
# 1 = API nicht erreichbar. Bewusst EIN Aufruf je Objekt: Aliase und das Analyse-Done-Label
# werden aus derselben Antwort gelesen — zwei Abfragen könnten einen Zwischenstand sehen
# und wären doppelte Last ohne Gewinn.
LABELS_JSON=""
fetch_labels() {
  local kind="$1" number="$2"
  if [ "$kind" = "pr" ]; then
    LABELS_JSON="$(gh pr view "$number" --repo "$REPO" --json labels 2>/dev/null)"
  else
    LABELS_JSON="$(gh issue view "$number" --repo "$REPO" --json labels 2>/dev/null)"
  fi
  [ -n "$LABELS_JSON" ]
}

# Alle ai:model:*-Aliase aus einer Labels-Antwort, einer je Zeile.
aliases_from() {
  printf '%s' "$1" | jq -r --arg p "$PREFIX" '.labels[].name | select(startswith($p)) | ltrimstr($p)'
}

# Trägt die Antwort das Done-Label der Analyse? Das entscheidet, ob ein fehlendes
# Modell-Label ein DEFEKT ist oder schlicht nie vorgesehen war.
has_analysed_json() {
  printf '%s' "$1" | jq -e 'any(.labels[]; .name == "ai:analysed")' >/dev/null 2>&1
}

SOURCE="$KIND"

# FAIL-CLOSED (Gegenteil von check-phase-label.sh): Dort ist Fail-open richtig, weil eine
# verschluckte Phase teurer ist als ein doppelter Lauf. Hier startet direkt danach ein
# LLM-Lauf — ohne gesicherte Modellwahl liefe er auf dem settings.json-Default, also
# potenziell auf dem teuersten Modell. Im Zweifel also NICHT starten.
fetch_labels "$KIND" "$TICKET" \
  || emit "" "true" "false" "Label-Abfrage für ${KIND} #${TICKET} fehlgeschlagen — fail-closed (ungeprüfte Modellwahl würde auf dem Default-Modell starten)"
SELF_JSON="$LABELS_JSON"
FOUND="$(aliases_from "$SELF_JSON")"
ORIGIN_JSON="$SELF_JSON"

# Zweite Stufe: PR ohne eigenes Label erbt vom verknüpften Issue.
LINKED=""
if [ "$KIND" = "pr" ] && [ -z "$FOUND" ]; then
  LINKED="$(gh pr view "$TICKET" --repo "$REPO" --json closingIssuesReferences \
    --jq '.closingIssuesReferences[0].number // empty' 2>/dev/null)"
  if [ -n "$LINKED" ]; then
    # Auch hier fail-closed: Ist das verknüpfte Issue nicht lesbar, lässt sich die
    # Herkunft nicht bestimmen — und „nicht bestimmbar" darf NICHT als „keine Herkunft"
    # durchgehen, sonst liefe ein Ticket mit nachweislicher Analyse still auf dem
    # Default-Modell (fail-open im einzigen fail-closed-Pfad, Review-Finding zu PR #916).
    fetch_labels issue "$LINKED" \
      || emit "" "true" "false" "Labels des verknüpften Issues #${LINKED} nicht lesbar — fail-closed (Analyse-Herkunft unbestimmbar)"
    FOUND="$(aliases_from "$LABELS_JSON")"
    ORIGIN_JSON="$LABELS_JSON"
    SOURCE="issue #${LINKED}"
  fi
fi

COUNT="$(printf '%s' "$FOUND" | grep -c . || true)"
if [ "$COUNT" -eq 0 ]; then
  # KEIN pauschales Parken mehr (Fehlverhalten aus PR #914): Die Gate-Logik unterstellte,
  # dass JEDER Lauf aus einer Analyse stammt. Das stimmt nicht — Harness-PRs, von Hand
  # geöffnete PRs und Renovate-PRs haben nie ein Issue durchlaufen, das ein Label hätte
  # setzen können. Sie parkten dadurch dauerhaft beim Menschen, und der Autolabeler lief
  # dabei sogar hart auf Fehler.
  #
  # Unterschieden wird deshalb nach HERKUNFT:
  #   - Die Analyse ist nachweislich gelaufen (ai:analysed am Objekt oder am verknüpften
  #     Issue), hat aber kein Modell gesetzt → das ist ein Defekt der Analyse. Parken.
  #   - Keine Analyse-Herkunft → es war nie eines vorgesehen. Kein Parken; der Lauf nutzt
  #     den Phasen-Default (vars.CLAUDE_MODEL_* bzw. .claude/settings.json), also exakt das
  #     Verhalten von vor der Modellwahl. Das ist kein stilles Raten, sondern der
  #     unveränderte Status quo für einen Pfad, den das Routing gar nicht abdeckt — und er
  #     wird als Notice sichtbar gemacht, nicht verschwiegen.
  # Beide bereits gelesenen Antworten prüfen: das Objekt selbst UND — falls vorhanden —
  # das verknüpfte Issue. Keine weitere API-Abfrage, keine Fehlerquelle mehr an dieser
  # Stelle: Unlesbare Antworten sind oben schon fail-closed abgefangen.
  ANALYSED="false"
  if has_analysed_json "$SELF_JSON" || has_analysed_json "$ORIGIN_JSON"; then
    ANALYSED="true"
  fi
  if [ "$ANALYSED" = "true" ]; then
    emit "" "true" "false" "Kein '${PREFIX}*'-Label an ${KIND} #${TICKET}, obwohl die Analyse gelaufen ist (ai:analysed) — sie muss genau eines setzen."
  fi
  emit "" "false" "false" "Kein '${PREFIX}*'-Label und keine Analyse-Herkunft an ${KIND} #${TICKET} — Phasen-Default gilt (kein Parken)."
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
