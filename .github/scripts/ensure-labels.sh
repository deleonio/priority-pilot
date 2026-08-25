#!/usr/bin/env bash
# Legt die Labels an, die die Triage-Phase zum Schreiben braucht — idempotent.
#
# WARUM EIGENES SKRIPT: Dieselbe Kette stand zweimal wortgleich in 01-claude-triage.yml —
# einmal im Prompt-Heredoc (der Zerlegungspfad braucht sie VOR `gh issue create --label`,
# sonst schlägt das Anlegen fehl) und einmal in der Post-Assertion. Zwei Kopien laufen
# auseinander, sobald jemand nur eine anfasst: eine neue Modellklasse oder eine geänderte
# Farbe fehlt dann genau im anderen Pfad. Jetzt eine Stelle, zwei Aufrufer.
#
# `|| true` pro Zeile ist Absicht: `gh label create` scheitert, wenn das Label schon
# existiert — das ist der Normalfall und kein Fehler.
#
# Aufruf: bash .github/scripts/ensure-labels.sh
# Erwartet ein authentifiziertes `gh` (GH_TOKEN) im Repo-Kontext.
set -euo pipefail

gh label create "ai:analysed" --color 0E8A16 2>/dev/null || true
gh label create "ai:needs-ux-ui" --color FBCA04 2>/dev/null || true
gh label create "ai:needs-spec" --color FBCA04 2>/dev/null || true
gh label create "ai:needs-impl" --color FBCA04 2>/dev/null || true

for m in haiku sonnet opus; do
  gh label create "ai:model:$m" --color C5DEF5 --description "Modell der Folgephasen" 2>/dev/null || true
done
