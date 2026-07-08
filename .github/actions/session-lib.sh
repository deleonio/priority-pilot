# Gemeinsame Pfad-/Key-Logik fuer session-restore und session-save (per `source` eingebunden,
# kein eigenes Action-Manifest). Aus dem tatsaechlichen `pwd` berechnet statt hart auf
# $GITHUB_WORKSPACE verdrahtet, damit Save und Restore konsistent bleiben, solange beide im
# selben Job/Runner-Kontext laufen.

claude_project_dir() {
  echo "$HOME/.claude/projects/$(pwd | sed 's/\//-/g')"
}


# $1 = id-type (issue|pr), $2 = Nummer. Getrennter Namensraum fuer PR-basierte Phasen
# (review/fix), damit "claude-session-issue-<N>" nicht faelschlich eine PR-Nummer traegt
# (Kreuzverhoer-Finding M3, 2026-07-08).
cache_key_for() {
  echo "claude-session-$1-$2"
}

archive_dir_for() {
  echo "${RUNNER_TEMP:-/tmp}/claude-session-archive/$1-$2"
}
