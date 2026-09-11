#!/usr/bin/env bash
# Entscheidet, ob ein Diff Anwendungscode berührt — und damit, ob die E2E-Shards laufen müssen.
#
# WARUM: Die KI-Pipeline produziert viele PRs, die ausschließlich `.github/**`, `docs/**` oder
# `.ai-knowledge/**` anfassen. Die acht E2E-Shards kosten dort je ~4,5 min Wandzeit und — viel
# teurer — acht Läufer-Plätze gegen das Job-Limit des Kontos, obwohl kein einziger Test etwas
# anderes prüfen kann als vorher. Dieser Filter schaltet sie für solche Diffs ab; der
# `verify`-Job läuft IMMER weiter (er ist das CI-Signal des Gates und prüft Format/Lint/
# Skript-Tests gerade an diesen Dateien).
#
# FAIL-CLOSED (Gegenteil von wait-for-checks.sh): Jeder unklare Zustand — API-Fehler, leere
# Dateiliste, unbekanntes Event — liefert `app=true`. Ein überflüssiger E2E-Lauf kostet
# Minuten, ein übersprungener kostet eine ungetestete Regression auf main.
#
# Ausgabe (stdout, key=value — direkt nach $GITHUB_OUTPUT anhängbar):
#   app=true|false
#   reason=<Klartext: erster Treffer bzw. warum nicht>
#
# Usage:
#   bash diff-touches-app.sh --repo <owner/repo> --pr <N>
#   bash diff-touches-app.sh --repo <owner/repo> --base <sha> --head <sha>
#   bash diff-touches-app.sh --files-from -          # Pfade auf stdin (lokal/Test)
set -uo pipefail

# Anwendungsrelevant. Einträge mit abschließendem `/` sind Präfixe, alle anderen exakte Pfade.
#   frontend/server/client — der Anwendungscode selbst, inkl. e2e-Specs und Playwright-Config
#   openapi.yml            — der Vertrag, aus dem die Typen beider Seiten generiert werden
#   Wurzel-Manifeste       — Abhängigkeits-/Toolchain-Wechsel (Renovate) können alles kippen
#   verify.yml             — ändert sich die CI-Definition selbst, läuft die volle Suite
APP_PATHS=(
  'frontend/'
  'server/'
  'client/'
  'openapi.yml'
  'package.json'
  'pnpm-lock.yaml'
  'pnpm-workspace.yaml'
  '.nvmrc'
  '.github/workflows/verify.yml'
)

REPO=""
PR=""
BASE=""
HEAD=""
FILES_FROM=""

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="${2:-}"; shift 2 ;;
    --pr) PR="${2:-}"; shift 2 ;;
    --base) BASE="${2:-}"; shift 2 ;;
    --head) HEAD="${2:-}"; shift 2 ;;
    --files-from) FILES_FROM="${2:-}"; shift 2 ;;
    *) echo "Unbekanntes Argument: $1" >&2; exit 2 ;;
  esac
done

emit() { # $1 = true|false, $2 = Begründung
  echo "app=$1"
  echo "reason=$2"
  exit 0
}

files=""
if [ "$FILES_FROM" = "-" ]; then
  files="$(cat)"
elif [ -n "$FILES_FROM" ]; then
  files="$(cat "$FILES_FROM")"
elif [ -n "$PR" ]; then
  files="$(gh api "repos/${REPO}/pulls/${PR}/files" --paginate --jq '.[].filename' 2>/dev/null)" || files=""
elif [ -n "$BASE" ] && [ -n "$HEAD" ]; then
  files="$(gh api "repos/${REPO}/compare/${BASE}...${HEAD}" --paginate --jq '.files[]?.filename' 2>/dev/null)" || files=""
else
  emit true "Weder --pr noch --base/--head noch --files-from — Diff unbekannt, E2E laeuft."
fi

# Leere Liste heißt NICHT „nichts geändert": ein Vergleich über zu viele Dateien, ein
# API-Fehler und ein leerer Push sehen hier identisch aus. Fail-closed.
if [ -z "$(printf '%s' "$files" | tr -d '[:space:]')" ]; then
  emit true "Dateiliste leer oder nicht lesbar — E2E laeuft (fail-closed)."
fi

while IFS= read -r f; do
  [ -z "$f" ] && continue
  for p in "${APP_PATHS[@]}"; do
    case "$p" in
      */) case "$f" in "$p"*) emit true "Anwendungscode berührt: $f" ;; esac ;;
      *) [ "$f" = "$p" ] && emit true "Anwendungscode berührt: $f" ;;
    esac
  done
done <<< "$files"

emit false "Kein Anwendungscode im Diff (nur Doku/Workflows/Wissensbasis) — E2E entfaellt."
