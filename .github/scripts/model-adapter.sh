#!/usr/bin/env bash
# Modell-Adapter: kanonische Definitionen (.github/models.json) → Runtime-Form.
#
# WARUM EIN ADAPTER: Die Quelldatei trägt nur die kanonische Wahrheit (Modell-Identität,
# Preis, Tier-Bindung) — die FORMATIERUNG je Runtime ist Code, nicht Daten. Vorher standen
# cc-/pi-Formen als fertige Strings nebeneinander in einer Datei; nichts erzwingt, dass beide
# dasselbe echte Modell meinen ([1m]-Suffix, provider/-Präfix waren frei handeditierbar
# auseinander gelaufen — der glm-5-turbo-Vorfall, docs/pipeline-optimierung.md 05.10.).
#
# FORMEN:
#   cc (Claude Code):  zai → '<id>[1m]' gdw. context >= 1_000_000, sonst '<id>';
#                      claude/openrouter → '<id>' unverändert
#   pi:                '<provider>/<id>'; deklariertes Ersatzmodell (tiers: {model, pi})
#                      greift transparent mit Notice
#
# PI-KATALOG-GUARD: pi fällt bei unbekannter Modell-ID STILL auf seinen Default zurück
# (beobachtet 04.10.: 'zai/glm-5.3-flash' lief als glm-5-turbo weiter, ohne Fehler). Der
# Adapter validiert die Ziel-ID gegen pis eingebauten Katalog und bricht LAUT ab (exit 1).
#
# Usage (Outputs als key=value auf stdout; Aufrufer leiten in $GITHUB_OUTPUT um):
#   model-adapter.sh resolve --runtime cc|pi --provider <p> --alias <a>
#       → canonical=<id>  resolved=<form>  substituted=true|false
#   model-adapter.sh settings-local --provider zai|openrouter
#       → druckt .claude/settings.local.json (cc-Formen, Subagent = haiku-Tier)
#   model-adapter.sh has-pi --provider <p>
#       → count=<n>  (Tiers mit gültiger pi-Form; provider ohne pi-Support → 0)
#
# Exit-Codes: 0 ok · 1 Konfigurationsfehler (Tier fehlt, pi-Katalog-Verstoß, Modell
# unbekannt) · 2 Argumentfehler — Konvention wie resolve-phase-routing.sh.
set -euo pipefail

# Test-Hook: MODELS_FILE_OVERRIDE zeigt auf eine mutierte Kopie (model-adapter.test.ts,
# Katalog-Guard-Fall) — Produktivläufe lesen immer die eingecheckte Datei.
MODELS_FILE="${MODELS_FILE_OVERRIDE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/models.json}"
ALIASES="fable|opus|sonnet|haiku"

# Pis eingebauter Modellkatalog je Provider (pi --list-models, .github/pi/README.md).
# Ein Ziel außerhalb dieser Formen wäre pi unbekannt → stiller Default-Fallback.
pi_catalog_ok() {
  case "$1" in
    zai/glm-5.3|zai/glm-5-turbo|zai/glm-4.7) return 0 ;;
    openrouter/*/*) return 0 ;; # vendor/model-Form (z. B. openrouter/poolside/laguna-s-2.1:free)
    *) return 1 ;;
  esac
}

usage() { grep '^#' "$0" | sed -n 's/^# \?//p' | head -26 >&2; exit 2; }
die_conf() { echo "model-adapter: $*" >&2; exit 1; }

CMD="${1:-}"; [ $# -gt 0 ] && shift
[ -n "$CMD" ] || usage
[ -f "$MODELS_FILE" ] || die_conf "models.json fehlt: $MODELS_FILE"

case "$CMD" in

  resolve)
    RUNTIME=""; PROVIDER=""; ALIAS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --runtime)  RUNTIME="$2";  shift 2 ;;
        --provider) PROVIDER="$2"; shift 2 ;;
        --alias)    ALIAS="$2";    shift 2 ;;
        *) usage ;;
      esac
    done
    [[ "$RUNTIME" =~ ^(cc|pi)$ ]] || die_conf "resolve: --runtime cc|pi erforderlich (bekam '${RUNTIME:-leer}')"
    [[ "$PROVIDER" =~ ^(claude|zai|openrouter)$ ]] || die_conf "resolve: unbekannter Provider '${PROVIDER:-leer}' (claude|zai|openrouter)"
    [[ "$ALIAS" =~ ^($ALIASES)$ ]] || die_conf "resolve: unbekannter Alias '${ALIAS:-leer}' ($ALIASES)"

    # PROVIDER-MATRIX: pi unterstützt Anthropic nicht (Abo an Claude Code gebunden) —
    # derselbe Guard wie in setup-agent, hier zusätzlich auf Modellebene.
    [ "$RUNTIME" != "pi" ] || [ "$PROVIDER" != "claude" ] \
      || die_conf "pi unterstützt Provider 'claude' nicht — das Anthropic-Abo ist an Claude Code gebunden (s. setup-agent-Guard)."

    # Tier lesen: String = beide Runtimes; {model, pi} = pi-Ersatz deklariert. KEIN
    # Text-Round-Trip (jq -r streift bei Strings die Quotes, ein zurückgepipetes Bare
    # Word wäre kein gültiges JSON mehr) — stattdessen ein jq-Call je Semantik.
    jq -e --arg p "$PROVIDER" --arg a "$ALIAS" '.tiers[$p][$a] != null' "$MODELS_FILE" >/dev/null \
      || die_conf "Tier '$ALIAS' fehlt für Provider '$PROVIDER' in models.json"
    CANONICAL="$(jq -r --arg p "$PROVIDER" --arg a "$ALIAS" '.tiers[$p][$a] | if type == "object" then .model else . end' "$MODELS_FILE")"
    SUBSTITUTE="$(jq -r --arg p "$PROVIDER" --arg a "$ALIAS" '.tiers[$p][$a] | if type == "object" then (.pi // "") else "" end' "$MODELS_FILE")"
    jq -e --arg m "$CANONICAL" '.models[$m] != null' "$MODELS_FILE" >/dev/null \
      || die_conf "Tier '$ALIAS' ($PROVIDER) referenziert unbekanntes Modell '$CANONICAL'"

    if [ "$RUNTIME" = "pi" ]; then
      TARGET="$CANONICAL"; SUBSTITUTED="false"
      if [ -n "$SUBSTITUTE" ]; then
        TARGET="$SUBSTITUTE"; SUBSTITUTED="true"
      fi
      RESOLVED="$PROVIDER/$TARGET"
      pi_catalog_ok "$RESOLVED" \
        || die_conf "pi-Katalog-Verstoß: '$RESOLVED' ist in pi nicht eingebaut (pi --list-models) — pi würde STILL auf seinen Default zurückfallen. tiers.pi auf ein eingebautes Modell setzen (s. .github/pi/README.md)."
      [ "$SUBSTITUTED" = "true" ] && echo "::notice title=pi-Ersatzmodell::Alias '$ALIAS' läuft unter pi als '$TARGET' (statt '$CANONICAL' — pi kennt es nicht; deklariert in models.json tiers)."
      echo "canonical=$TARGET"
      echo "resolved=$RESOLVED"
      echo "substituted=$SUBSTITUTED"
    else
      # cc: [1m] gdw. context >= 1M — nur am Anthropic-kompatiblen zai-Endpoint
      CONTEXT="$(jq -r --arg m "$CANONICAL" '.models[$m].context // 0' "$MODELS_FILE")"
      if [ "$PROVIDER" = "zai" ] && [ "${CONTEXT:-0}" -ge 1000000 ]; then
        echo "resolved=${CANONICAL}[1m]"
      else
        echo "resolved=$CANONICAL"
      fi
      echo "canonical=$CANONICAL"
      echo "substituted=false"
    fi
    ;;

  settings-local)
    PROVIDER=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --provider) PROVIDER="$2"; shift 2 ;;
        *) usage ;;
      esac
    done
    [[ "$PROVIDER" =~ ^(zai|openrouter)$ ]] || die_conf "settings-local: nur zai|openrouter (claude nativ braucht keine settings.local.json; bekam '${PROVIDER:-leer}')"

    # cc-Auflösung der 4 Tier-Aliasse + Subagent (haiku) — dieselbe resolve-Logik inline,
    # damit settings-local ein einziger Aufruf bleibt.
    cc_form() {
      local canonical context
      canonical="$(jq -r --arg p "$PROVIDER" --arg a "$1" '.tiers[$p][$a] | if type == "object" then .model else . end' "$MODELS_FILE")"
      context="$(jq -r --arg m "$canonical" '.models[$m].context // 0' "$MODELS_FILE")"
      if [ "$PROVIDER" = "zai" ] && [ "${context:-0}" -ge 1000000 ]; then
        printf '%s[1m]' "$canonical"
      else
        printf '%s' "$canonical"
      fi
    }
    [ -n "$(cc_form haiku)" ] || die_conf "Tier 'haiku' fehlt für Provider '$PROVIDER'"

    jq -n --arg url "$(jq -r --arg p "$PROVIDER" '.endpoints[$p]' "$MODELS_FILE")" \
          --arg haiku "$(cc_form haiku)" \
          --arg sonnet "$(cc_form sonnet)" \
          --arg opus "$(cc_form opus)" \
          --arg fable "$(cc_form fable)" \
          '{env: {ANTHROPIC_BASE_URL: $url, ANTHROPIC_DEFAULT_HAIKU_MODEL: $haiku, ANTHROPIC_DEFAULT_SONNET_MODEL: $sonnet, ANTHROPIC_DEFAULT_OPUS_MODEL: $opus, ANTHROPIC_DEFAULT_FABLE_MODEL: $fable, CLAUDE_CODE_SUBAGENT_MODEL: $haiku}}'
    ;;

  has-pi)
    PROVIDER=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --provider) PROVIDER="$2"; shift 2 ;;
        *) usage ;;
      esac
    done
    [[ "$PROVIDER" =~ ^(claude|zai|openrouter)$ ]] || die_conf "has-pi: unbekannter Provider '${PROVIDER:-leer}'"
    # pi unterstützt claude nicht (Abo an Claude Code gebunden, Guard in setup-agent) → 0.
    # Sonst zählen wir die Tiers, deren pi-Ziel den Katalog-Guard passiert — derselbe
    # Maßstab, den setup-pi beim resolve anlegt.
    COUNT=0
    if [ "$PROVIDER" != "claude" ]; then
      for A in fable opus sonnet haiku; do
        jq -e --arg p "$PROVIDER" --arg a "$A" '.tiers[$p][$a] != null' "$MODELS_FILE" >/dev/null || continue
        TARGET="$(jq -r --arg p "$PROVIDER" --arg a "$A" '.tiers[$p][$a] | if type == "object" then (.pi // .model) else . end' "$MODELS_FILE")"
        RESOLVED="$PROVIDER/$TARGET"
        jq -e --arg m "$TARGET" '.models[$m] != null' "$MODELS_FILE" >/dev/null || continue
        pi_catalog_ok "$RESOLVED" && COUNT=$((COUNT + 1))
      done
    fi
    echo "count=$COUNT"
    ;;

  *)
    usage
    ;;
esac
