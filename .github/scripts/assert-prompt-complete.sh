#!/usr/bin/env bash
# Bricht ab, wenn im fertig substituierten Prompt noch ein {{PLATZHALTER}} steht.
#
# WARUM: Ein unersetzter Platzhalter ist immer ein Fehler und kostet sonst einen kompletten
# LLM-Lauf, in dem der Agent die Nummer aus dem Kontext raten muss. Genau das lief lange
# unbemerkt: spec.md/implement.md benutzten ISSUE_NR ohne Raute, fixup.md PR_NR ohne Raute --
# das alte sed-Muster (#ISSUE_NR) traf diese Stellen nie, und niemand hat es gemerkt, weil ein
# wörtlich stehengebliebenes "ISSUE_NR" im Prompt keinen Fehler auslöst.
#
# Das ist eine Laufzeit-Zusicherung im Workflow, kein Test der Workflow-Definition -- ADR 0001
# ("GitHub-Workflows bleiben ungetestet") bleibt unberührt.
#
# Aufruf: bash .github/scripts/assert-prompt-complete.sh [pfad]   (Default: /tmp/claude-prompt.txt)
set -euo pipefail

f="${1:-/tmp/claude-prompt.txt}"

if [ ! -f "$f" ]; then
  echo "::error title=❌ Prompt fehlt::$f existiert nicht — der Prompt-Bau ist vorher gescheitert."
  exit 1
fi

# `|| true` ist Pflicht: grep ohne Treffer liefert 1, und unter `set -o pipefail` bricht das
# die Zuweisung ab — der Guard wäre dann ausgerechnet im GUTEN Fall rot.
rest="$(grep -oE '\{\{[A-Z_]+\}\}' "$f" | sort -u | tr '\n' ' ' || true)"
if [ -n "$rest" ]; then
  echo "::error title=❌ Prompt unvollständig::Nicht ersetzte Platzhalter in $f: ${rest% }. Fehlt ein sed-Aufruf im Workflow, oder wurde der Platzhalter im Prompt umbenannt?"
  exit 1
fi
