#!/usr/bin/env bash
# Issue-Guete verifizieren VOR der Analyse-Phase — rein mechanisch, ohne LLM.
#
# ZWECK: Die teuerste Verschwendung der Pipeline ist eine Analyse, die raten muss,
# weil das Ticket vage ist („Button schoener machen"). needs-human danach kostet
# einen vollen Lauf. Dieses Skript lehnt schwache Tickets im PRECHECK ab — der
# Autor erhaelt sofortigen, maschinellen Feedback-Kommentar; kein Runner-Setup,
# kein LLM-Call. Die Analyse startet nur mit strukturiertem Input.
#
# GEPRUEFT WIRD ( deckungsgleich mit .github/ISSUE_TEMPLATE/ticket.yml):
#   1. Template-Felder vorhanden: die vier Ueberschriften (Problem / Erwartet /
#      Auftritt / Gelöst) muessen als Markdown-Abschnitte existieren.
#   2. Mindestfuellung: jedes Pflichtfeld >= 10 Zeichen echten Texts
#      (Platzhalter-Text des Templates zaehlt nicht).
#   3. Kriterium-Zaehlung: „Wann ist es gelöst?" braucht >= 1 pruefbaren Punkt
#      (Zeile mit `-` oder `*` Bullet, nicht nur Fliesstext).
#   4. Vage-Wort-Filter: Beispiele wie „irgendwie", „einfach mal", „besser
#      machen" ohne konkretes Was/Wo → zurueckgewiesen.
#
# FAIL-SAFE-RICHTUNG: Ein API-Fehler oder unlesbarer Body fuehrt zu ok=true —
# die Guete-Pruefung darf die Pipeline nie blockieren, sie ist ein Filter, kein
# Gate gegen Infrastructure-Ausfaelle. Nur ein LESEBARES, schwaches Ticket wird
# zurueckgewiesen; das ist bewusst fail-closed auf inhaltlicher Ebene.
#
# Usage:
#   bash verify-issue-quality.sh --repo <owner/repo> --issue <N>
#
# GitHub-Outputs:
#   ok       – true|false (false = Ticket ungenuegend, nicht analysieren)
#   reason   – einzeilige Begründung (für Kommentar/Notice)
#   details  – mehrzeilige, datenschutzfreundliche Hinweise an den Autor
set -uo pipefail

REPO=""
ISSUE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)  REPO="$2";  shift 2 ;;
    --issue) ISSUE="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[[ -n "$REPO" && -n "$ISSUE" ]] || { echo "verify-issue-quality: --repo und --issue sind Pflicht" >&2; exit 2; }

emit() { # ok reason details
  echo "ok=$1"      >> "$GITHUB_OUTPUT"
  printf 'reason=%s\n'  "$(printf '%s' "$2" | tr -d '\n\r')" >> "$GITHUB_OUTPUT"
  # Details mehrzeilig: Delimiter-Syntax für mehrzeilige Outputs
  {
    echo "details<<VERIFY_EOF"
    printf '%s\n' "$3"
    echo "VERIFY_EOF"
  } >> "$GITHUB_OUTPUT"
}

fail() { # details-block
  emit false "Issue nicht analyse-reif — siehe Kommentar am Ticket." "$1"
  exit 0
}

BODY="$(gh issue view "$ISSUE" --repo "$REPO" --json body --jq '.body // ""' 2>/dev/null)" || {
  # Lesefehler: nicht blockieren (fail-safe richtung Pipeline)
  emit true "Issue-Body nicht lesbar — Guete-Pruefung uebersprungen." ""
  exit 0
}
[ -n "$BODY" ] || fail "Das Ticket ist leer. Bitte mit dem **Ticket-Template** neu erfassen: Problem, Erwartung, Ort, Loesungskriterien."

# Abschnitt zwischen zwei Markdown-H2/H3-Ueberschriften (oder bis Textende).
section() { # heading-substring
  printf '%s' "$BODY" | awk -v h="$1" '
    BEGIN { insec = 0 }
    /^#+ / {
      insec = (index(tolower($0), tolower(h)) > 0) ? 1 : 0
      next
    }
    insec { print }
  '
}

# Echten Text messen: Bullets und Woerter zaehlen, Whitespace raus.
real_text_len() { printf '%s' "$1" | tr -s '[:space:]' ' ' | wc -c | tr -d ' '; }

# Ticket bereits in der Pipeline? (Analyse-Block existiert) → Vorab-Check unsinnig:
# Phasen-Edits (Body-Updates durch Triage/Spec/…) wuerden ihn sonst bei jedem Edit
# neu anstossen. Guete ist dann durch die laufende Analyse selbst gesichert.
if printf '%s' "$BODY" | grep -q 'KI-ANALYSE:START'; then
  echo "skipped=true" >> "$GITHUB_OUTPUT"
  emit true "Analyse-Block vorhanden — Ticket ist in der Pipeline, Vorab-Check uebersprungen." ""
  exit 0
fi
echo "skipped=false" >> "$GITHUB_OUTPUT"

PROBLEM="$(section 'Was ist das Problem')"
EXPECTED="$(section 'Was soll stattdessen passieren')"
SCOPE="$(section 'Wo tritt es auf')"
CRITERIA="$(section 'Wann ist es gelöst')"

# 1. Felder vorhanden?
MISSING=""
[[ -z "$PROBLEM"   ]] && MISSING="- Abschnitt **Was ist das Problem?** fehlt"
[[ -z "$EXPECTED" ]] && MISSING="${MISSING:+$MISSING
}- Abschnitt **Was soll stattdessen passieren?** fehlt"
[[ -z "$SCOPE"     ]] && MISSING="${MISSING:+$MISSING
}- Abschnitt **Wo tritt es auf?** fehlt"
[[ -z "$CRITERIA" ]] && MISSING="${MISSING:+$MISSING
}- Abschnitt **Wann ist es gelöst?** fehlt"
if [ -n "$MISSING" ]; then
  MSG="Das Ticket folgt nicht dem Template. Bitte Struktur uebernehmen:
$MISSING

Das Template findest du beim Anlegen eines Issues (Ticket). Es zwingt zu vier klaren Angaben - genau die, mit denen die Analyse arbeiten kann."
  fail "$MSG"
fi

# 2. Mindestfuellung (>= 10 Zeichen echten Texts). Platzhalter-Matching entfaellt:
# GitHub-Forms uebernehmen die Feld-Beschreibungen nicht in den Body — nur bei
# Copy-Paste des Template-Markdowns waeren sie da, und der laenge-Check fängt das.
THIN=""
for pair in "Problem:$PROBLEM" "Erwartung:$EXPECTED" "Ort:$SCOPE" "Kriterien:$CRITERIA"; do
  label="${pair%%:*}"; content="${pair#*:}"
  len="$(real_text_len "$content")"
  if [ "$len" -lt 10 ]; then
    THIN="${THIN:+$THIN
}- **$label** ist zu duenn — konkret schreiben (beobachtbar, nicht abstrakt)"
  fi
done
if [ -n "$THIN" ]; then
  MSG="Einige Angaben sind zu unbestimmt:
$THIN"
  fail "$MSG"
fi

# 3. Loesungskriterien: mindestens 1 pruefbarer Punkt (Bullet-Zeile)
BULLETS="$(printf '%s' "$CRITERIA" | grep -cE '^[[:space:]]*[-*+] ' || true)"
if [ "$BULLETS" -lt 1 ]; then
  MSG='Der Abschnitt **Wann ist es geloest?** enthaelt keinen pruefbaren Punkt.
Schreibe mindestens EINE Zeile mit einem Bindestrich-Bullet, die man von aussen nachpruefen kann (z. B. "- Bei 375px fuellt der Button die Formularbreite").'
  fail "$MSG"
fi

# 4. Vage-Wort-Filter auf Problem+Erwartung (Fluestern wie „irgendwie besser")
VAGUE="$(printf '%s\n%s' "$PROBLEM" "$EXPECTED" | grep -inE 'irgendwie|einfach mal|besser machen|verschönern|ohne weiteres|irgendwas|kann man nicht|funzt nicht geht nicht' | head -3 || true)"
if [ -n "$VAGUE" ]; then
  MSG='Die Beschreibung enthaelt vage Formulierungen (z. B. "besser machen"), ohne WAS konkret anders sein soll.
Ersetze sie durch beobachtbares Verhalten: Was passiert jetzt (wo, fuer wen) - was soll stattdessen passieren?'
  fail "$MSG"
fi

emit true "Issue-Struktur ok — Analyse kann starten." ""
