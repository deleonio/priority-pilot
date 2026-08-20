#!/usr/bin/env bash
# Parkt ein Ticket beim Menschen, wenn eine Phase ABGESTÜRZT ist (kein verwertbares
# VERDICT) — mit Begründung und Log-Auszug.
#
# WARUM: Die Issue-Phasen konsumieren ihren Trigger im Post-Assertion-Step, BEVOR sie das
# Verdict auswerten. Lieferte der LLM-Lauf keins (Absturz, Provider-Fehler, Timeout), fiel
# die Auswertung in einen else-Zweig, der nur ein ::warning schrieb: Das Ticket stand danach
# ohne Trigger, ohne ai:needs-human und ohne Hinweis da — die Kette war still tot. Beobachtet
# an Issue #912, das so über sechs Stunden unbemerkt liegenblieb, zweimal hintereinander.
#
# WARUM PARKEN STATT RE-ARMEN: Ein erneutes Setzen des Triggers würde bei einem
# VORÜBERGEHENDEN Fehler helfen, bei einem DAUERHAFTEN aber endlos Läufe erzeugen — und
# genau der dauerhafte Fall trat auf (Provider-Kontingent erschöpft, Reset erst Tage später).
# Ein geparktes Ticket kostet einen Blick, eine Schleife kostet Kontingent. Deshalb die
# teurere-für-den-Menschen, aber billigere-für-das-Budget Richtung.
#
# BEGRÜNDUNGSPFLICHT: Das Label wird nie ohne Kommentar gesetzt, und der Kommentar nennt
# was zu entscheiden ist, worauf es sich bezieht und welche Optionen bestehen — inklusive
# des Log-Auszugs, in dem die echte Ursache steht (Provider-Fehler stehen NUR dort).
#
# Usage:
#   bash phase-crash-park.sh --repo <owner/repo> --issue <N> --phase <name> \
#                            --trigger <label> [--log <datei>]
#
# Ausgabe (stdout, key=value):
#   parked=true|false
#   reason=<einzeiliger Klartext>

set -uo pipefail

REPO=""
ISSUE=""
PHASE=""
TRIGGER=""
LOG_FILE="/tmp/claude-output.log"
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --issue) ISSUE="$2"; shift 2 ;;
    --phase) PHASE="$2"; shift 2 ;;
    --trigger) TRIGGER="$2"; shift 2 ;;
    --log) LOG_FILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ -n "$REPO" ] || { echo "phase-crash-park: --repo required" >&2; exit 2; }
[ -n "$ISSUE" ] || { echo "phase-crash-park: --issue required" >&2; exit 2; }
[ -n "$PHASE" ] || { echo "phase-crash-park: --phase required" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"

out() {
  echo "parked=$1"
  printf 'reason=%s\n' "$(printf '%s' "$2" | tr -d '\n\r')"
  exit 0
}

# Log-Auszug über den bestehenden Helfer — er entfernt ANSI-/Steuerzeichen und kappt die
# Zeilenlänge, damit der Kommentar nicht durch Terminal-Müll unlesbar wird.
LOGTAIL=""
if [ -r "$LOG_FILE" ]; then
  LOGTAIL="$(bash "${HERE}/needs-human-explain.sh" logtail --file "$LOG_FILE" 2>/dev/null || true)"
fi
[ -n "$LOGTAIL" ] || LOGTAIL="(kein Log-Auszug verfügbar — /tmp/claude-output.log fehlt oder ist leer)"

RE_ARM=""
if [ -n "$TRIGGER" ]; then
  RE_ARM="- Ursache behoben? Dann \`ai:needs-human\` entfernen **und** \`${TRIGGER}\` setzen — die Phase läuft erneut.
- Nur \`ai:needs-human\` zu entfernen startet NICHTS: Der Trigger wurde beim Start konsumiert."
else
  RE_ARM="- Ursache behoben? Dann \`ai:needs-human\` entfernen und den Phasen-Trigger neu setzen."
fi

BODY_FILE="$(mktemp)"
cat > "$BODY_FILE" <<EOF
<!-- ai-phase-crash -->
## ⛔ Phase \`${PHASE}\` abgebrochen — Ticket geparkt

**Was zu entscheiden ist:** Ob die Ursache behebbar ist und die Phase erneut laufen soll.

**Worauf es sich bezieht:** Issue #${ISSUE}, Phase \`${PHASE}\`

**Befund:** Der Lauf endete ohne verwertbares VERDICT. Das ist kein inhaltliches Urteil,
sondern ein Abbruch — meist ein Provider- oder Laufzeitfehler. Die echte Ursache steht im
Log-Auszug:

<details><summary>Letzte Zeilen aus dem Claude-Log</summary>

\`\`\`
${LOGTAIL}
\`\`\`

</details>

**Optionen:**
${RE_ARM}
- Häufigste Ursache sind Provider-Limits (Kontingent erschöpft, Rate-Limit). Dann hilft
  Warten oder ein Providerwechsel über den Workflow \`0/7 LLM-Provider\`.

---
_Ohne diesen Hinweis stünde das Ticket ohne Trigger und ohne Label da — die Kette wäre
still gestorben._
EOF

gh label create "ai:needs-human" --repo "$REPO" --color 5319e7 \
  --description "Nicht-automatisierbare Entscheidung — wartet auf Mensch" 2>/dev/null || true

# Dedupe gegen den jüngsten Kommentar: Der Continue-Sweep und manuelles Re-Labeln können
# denselben Absturz mehrfach erzeugen. Fail-open — lieber ein Duplikat als kein Hinweis.
LAST="$(gh issue view "$ISSUE" --repo "$REPO" --json comments --jq '[.comments[]] | last | .body // ""' 2>/dev/null || true)"
NEW="$(cat "$BODY_FILE")"
if [ "$LAST" = "$NEW" ]; then
  echo "::notice::Absturz-Hinweis steht bereits als jüngster Kommentar — kein Doppel-Post."
else
  gh issue comment "$ISSUE" --repo "$REPO" --body-file "$BODY_FILE" >/dev/null 2>&1 || true
fi
rm -f "$BODY_FILE"

if gh issue edit "$ISSUE" --repo "$REPO" --add-label "ai:needs-human" >/dev/null 2>&1; then
  out true "Phase ${PHASE} ohne VERDICT abgebrochen — Ticket #${ISSUE} mit ai:needs-human geparkt."
fi
# Selbst wenn das Label nicht gesetzt werden konnte, ist der Kommentar draußen — das Ticket
# ist dann wenigstens nicht mehr stumm.
out false "Phase ${PHASE} ohne VERDICT abgebrochen — Label konnte nicht gesetzt werden, Hinweis wurde kommentiert."
