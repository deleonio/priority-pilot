# Gemeinsame Pfad-/Key-Logik fuer session-restore und session-save (per `source` eingebunden,
# kein eigenes Action-Manifest). Aus dem tatsaechlichen `pwd` berechnet statt hart auf
# $GITHUB_WORKSPACE verdrahtet, damit Save und Restore konsistent bleiben, solange beide im
# selben Job/Runner-Kontext laufen.

claude_project_dir() {
  echo "$HOME/.claude/projects/$(pwd | sed 's/\//-/g')"
}


# $1 = id-type (issue|pr), $2 = Nummer, $3 = Phase. Getrennter Namensraum fuer PR-basierte
# Phasen (review/fix), damit "claude-session-issue-<N>" nicht faelschlich eine PR-Nummer traegt
# (Kreuzverhoer-Finding M3, 2026-07-08). Seit der Artefakt-Umstellung (2026-07-10, GitHubs
# Read-only-Cache fuer untrusted Trigger) ist zusaetzlich die Phase Teil des Namens: EIN
# Artefakt pro Phase, damit keine Phase beim Hochladen den Stand einer anderen mitschleppt.
artifact_name_for() {
  echo "claude-session-$1-$2-$3"
}

archive_dir_for() {
  echo "${RUNNER_TEMP:-/tmp}/claude-session-archive/$1-$2"
}
