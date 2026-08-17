#!/bin/bash
# ui-inspect.sh - startet Priority Pilot als wegwerfbare Inspect-Instanz für den Browser-MCP.
# Usage: pnpm ui:inspect (oder ./ui-inspect.sh), beenden mit Ctrl+C.
#
# Warum ein eigener Start statt `pnpm dev`: `server/.env` enthält echte Google-OAuth-Credentials,
# damit ist `isAuthActive()` (server/src/express/requireAuth.ts) scharf und ein Agenten-Browser
# sieht ausschließlich die Login-Wand. Hier werden die Auth-Variablen geblankt (leere Strings
# gewinnen gegen die .env, weil `process.loadEnvFile` bereits gesetzte Variablen nicht
# überschreibt) und die App läuft auf einer temporären In-Memory-DB mit Demo-Seed.
#
# Eigene Ports, damit parallel laufendes `pnpm dev` (3000/5173) und `test:e2e` (3000/4173)
# unberührt bleiben. Details: docs/browser-mcp.md

set -euo pipefail

BACKEND_PORT="${INSPECT_BACKEND_PORT:-3001}"
FRONTEND_PORT="${INSPECT_FRONTEND_PORT:-4174}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Port-Vorabcheck: lieber sauber abbrechen als halb starten (--strictPort meldet sich sonst erst,
# wenn das Backend bereits läuft, und hinterlässt einen verwaisten Prozess).
for PORT in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if lsof -ti "tcp:$PORT" >/dev/null 2>&1; then
    echo "FEHLER: Port $PORT ist bereits belegt - läuft schon eine Inspect-Instanz?" >&2
    lsof -i "tcp:$PORT" >&2 || true
    exit 1
  fi
done

BACKEND_PID=""
FRONTEND_PID=""

# Job-Control auch im Skript aktivieren: damit landet jeder Hintergrund-Job in einer EIGENEN
# Prozessgruppe (Gruppen-Id = Job-Pid). Nur so lässt sich unten der ganze Baum abräumen —
# `pnpm` startet `nodemon`, das seinerseits `sh -c 'pnpm build && node dist/index.js'` startet.
# Ein Kill nur auf die pnpm-Pid (oder auf den Port-Listener) lässt nodemon am Leben, und der
# startet den Server bei der nächsten Dateiänderung munter neu — der Port ist dann wieder belegt,
# ohne dass ein sichtbares `ui-inspect.sh` läuft.
set -m

# Alle Nachfahren eines Prozesses einsammeln (pgrep -P listet nur die direkte Kind-Ebene).
# Muss VOR dem Kill laufen: sobald Zwischenprozesse sterben, werden ihre Kinder an init
# umgehängt und sind über die Elternkette nicht mehr auffindbar.
collect_tree() {
  local pid="$1"
  local kid
  echo "$pid"
  for kid in $(pgrep -P "$pid" 2>/dev/null || true); do
    collect_tree "$kid"
  done
}

cleanup() {
  trap - EXIT INT TERM
  echo ""
  echo "Inspect-Instanz wird beendet ..."

  local tree=""
  [ -n "$BACKEND_PID" ] && tree="$tree $(collect_tree "$BACKEND_PID")"
  [ -n "$FRONTEND_PID" ] && tree="$tree $(collect_tree "$FRONTEND_PID")"

  # Negatives Argument = ganze Prozessgruppe (Kind, Enkel, Urenkel).
  [ -n "$BACKEND_PID" ] && kill -- "-$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill -- "-$FRONTEND_PID" 2>/dev/null || true
  # Nachzügler aus dem vorher eingesammelten Baum: nodemon startet sich in einer eigenen
  # Prozessgruppe neu und entkommt damit dem Gruppen-Kill.
  if [ -n "${tree// /}" ]; then
    kill $tree 2>/dev/null || true
  fi

  # Gürtel und Hosenträger: falls doch etwas an den Ports hängt, gezielt nachräumen
  # (xargs -r ist GNU-only, deshalb der explizite Leer-Check).
  sleep 1
  for PORT in "$BACKEND_PORT" "$FRONTEND_PORT"; do
    REST_PIDS=$(lsof -ti "tcp:$PORT" 2>/dev/null || true)
    if [ -n "$REST_PIDS" ]; then
      kill $REST_PIDS 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

# Backend: temporäre In-Memory-DB (DB_RESET=true bedeutet sync({force:true}) - ohne :memory:
# würde das die echte database.sqlite leeren!), Demo-Seed AN (der Agent soll gefüllte Ansichten
# sehen), Auth aus, kein LLM-Key (Lektorat/Advisor antworten deterministisch mit 503 statt echte,
# kostenpflichtige Calls abzusetzen). SESSION_SECRET bleibt bewusst UNGESETZT - ein leerer String
# rutscht in den `?? 'dev-secret'`-Fallback, ein gesetzter Wert schaltet die Auth wieder scharf.
echo "Backend startet auf http://localhost:$BACKEND_PORT (In-Memory-DB, Demo-Seed, Auth aus) ..."
PORT="$BACKEND_PORT" \
  DB_RESET=true \
  DB_SEED=true \
  DATABASE_STORAGE=":memory:" \
  GOOGLE_CLIENT_ID= \
  GOOGLE_CLIENT_SECRET= \
  GOOGLE_ALLOWED_EMAILS= \
  GOOGLE_ALLOWED_EMAIL= \
  MISTRAL_API_KEY= \
  pnpm --filter server dev &
BACKEND_PID=$!

# Bereitschaft über /tasks prüfen: die Wurzel / hat keine Route und liefert 404.
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$BACKEND_PORT/tasks" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! curl -sf "http://localhost:$BACKEND_PORT/tasks" >/dev/null 2>&1; then
  echo "FEHLER: Backend auf Port $BACKEND_PORT nicht bereit (Timeout nach 60s)." >&2
  exit 1
fi

# Frontend: `pnpm --filter frontend exec vite` statt `run dev`, weil das dev-Skript `--open`
# enthält und ein echtes Browserfenster aufreißen würde - der Agent browst headless.
echo "Frontend startet auf http://localhost:$FRONTEND_PORT ..."
API_PROXY_TARGET="http://localhost:$BACKEND_PORT" \
  pnpm --filter frontend exec vite --port "$FRONTEND_PORT" --strictPort &
FRONTEND_PID=$!

for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo ""
echo "Inspect-Instanz bereit: http://localhost:$FRONTEND_PORT"
echo "Claude kann jetzt per Playwright-MCP dorthin navigieren (siehe docs/browser-mcp.md)."
echo "Beenden mit Ctrl+C."
echo ""

wait
