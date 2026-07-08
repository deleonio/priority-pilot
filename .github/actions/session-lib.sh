# Gemeinsame Pfad-/Key-Logik fuer session-restore und session-save (per `source` eingebunden,
# kein eigenes Action-Manifest). Aus dem tatsaechlichen `pwd` berechnet statt hart auf
# $GITHUB_WORKSPACE verdrahtet, damit Save und Restore konsistent bleiben, solange beide im
# selben Job/Runner-Kontext laufen.

claude_project_dir() {
  echo "$HOME/.claude/projects/$(pwd | sed 's/\//-/g')"
}

archive_dir_for_issue() {
  echo "${RUNNER_TEMP:-/tmp}/claude-session-archive/issue-$1"
}
