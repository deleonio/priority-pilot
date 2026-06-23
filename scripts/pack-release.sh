#!/usr/bin/env bash
# Baut Frontend + Backend und schnürt ein deploybares Release-Tarball aus dem Monorepo.
#
# Nutzung:  scripts/pack-release.sh <vX.Y.Z>     z. B. scripts/pack-release.sh v1.2.3
#
# Ergebnis: priority-pilot-<vX.Y.Z>.tar.gz im Repo-Root. Entpackt enthält es:
#   dist/                 -> gebautes SPA (Vite), wird vom Reverse-Proxy ausgeliefert
#   server/dist/index.js  -> startfähiges Backend (ESM):
#                            DATABASE_STORAGE=… DB_SEED=false node server/dist/index.js
#   server/package.json   -> Prod-Manifest des Servers
#   server/node_modules/  -> nur Prod-Deps inkl. native sqlite3 (siehe Hinweis unten)
#
# Hinweis zur Host-Annahme (offene Entscheidung aus #100/R1):
#   Die Prod-`node_modules` werden hier in CI gebaut. Das setzt voraus, dass der Build-Host
#   architektur-kompatibel zum Ziel-Host ist (Annahme: x64-Linux + Node 22, passend zum
#   CI-Runner) — relevant für die native `sqlite3`-Bindung. Weicht die Host-Architektur ab,
#   die Prod-Deps stattdessen auf dem Host installieren (`pnpm install --prod` nach dem
#   Entpacken) und den `node_modules`-Kopierschritt unten entfernen.
set -euo pipefail

VERSION="${1:?Usage: pack-release.sh <vX.Y.Z>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAGE="$(mktemp -d)"
DEPLOY="$(mktemp -d)"
trap 'rm -rf "$STAGE" "$DEPLOY"' EXIT

echo "==> Build (client -> frontend -> server)"
pnpm install --frozen-lockfile
pnpm -r build

echo "==> Server-Prod-Bundle (nur Prod-Deps, inkl. native sqlite3)"
# `pnpm deploy` erzeugt ein eigenständiges Verzeichnis ohne Store-Symlinks (tarball-tauglich).
# `--legacy` ist je nach pnpm-Konfiguration nötig, damit in ein leeres Zielverzeichnis deployt
# wird; alternativ die Prod-Deps auf dem Host installieren.
rmdir "$DEPLOY"
pnpm --filter server --prod deploy --legacy "$DEPLOY"

echo "==> Release-Baum zusammenstellen"
mkdir -p "$STAGE/server"
cp -r frontend/dist "$STAGE/dist"               # SPA      -> Reverse-Proxy / file_server
cp -r "$DEPLOY/dist" "$STAGE/server/dist"       # Backend  -> node server/dist/index.js
cp "$DEPLOY/package.json" "$STAGE/server/package.json"
cp -r "$DEPLOY/node_modules" "$STAGE/server/node_modules"

OUT="$ROOT/priority-pilot-${VERSION}.tar.gz"
tar -czf "$OUT" -C "$STAGE" .
echo "==> Fertig: $OUT"
