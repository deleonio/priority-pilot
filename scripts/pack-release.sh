#!/usr/bin/env bash
# RETIRED (#152): Der Tag-/Tarball-/GitHub-Release-Deploy wurde durch das einfache
# "Merge auf main -> Build -> rsync der dist-Verzeichnisse" ersetzt. Es gibt kein Tarball
# und kein GitHub Release mehr — der Build laeuft direkt in .github/workflows/release.yml,
# die dist-Verzeichnisse werden per rsync auf den Server gespiegelt (Backend via PM2).
#
# Dieses Skript hat keine Funktion mehr und wird nur als Tombstone gehalten, bis das
# Tooling das Loeschen der Datei wieder zulaesst. Siehe docs/deployment.md.
set -euo pipefail
echo "pack-release.sh ist seit #152 ausser Betrieb. Deployment laeuft ueber rsync (siehe docs/deployment.md)." >&2
exit 1
