#!/bin/bash
# hacker-instance.sh - startet Balamentum als lokale Angriffsinstanz fuer das Hacker-Team
# (cron.hacker-team.yml, Methode: .claude/skills/hacker-team/SKILL.md).
# Usage: ./hacker-instance.sh (Vordergrund; CI: HACKER_NO_WATCH=1 mit vorab gebautem dist),
# beenden mit Ctrl+C bzw. Kill der Prozessgruppe.
#
# Unterschied zu ui-inspect.sh: Hier laeuft die Auth SCHARF - genau das ist die Angriffsflaeche.
# Dummy-Google-Credentials + SESSION_SECRET schalten isAuthActive() ein (server/src/express/
# requireAuth.ts): jede API-Route verlangt eine Session. NODE_ENV=test registriert zusaetzlich
# POST /auth/test-login (server/src/express/routes/auth.ts), mit dem das Team sich echte
# Sessions fuer beliebige E-Mails muenzen kann - Opfer- wie Angreifer-Konten. Die Allowlist
# bleibt bewusst LEER, sonst duerfte test-login nur gelistete Adressen.
#
# Externe Provider (Google, PayPal, Play, LLM) sind ohne echte Credentials nicht erreichbar -
# Angriffe bleiben zwingend lokal. Die DB ist eine Wegwerf-In-Memory-DB mit Demo-Seed.
#
# MONETIZATION_ENFORCED=1 haengt die Paket-Gates scharf (Rollout-Schalter aus plans.ts, Default
# aus): Ohne ihn wuerde jede Plan-Pruefung (requirePlanFeature) durchreichen und der
# Berechtigungs-Knacker testete gegen ein offenstehendes Tor.

set -euo pipefail

BACKEND_PORT="${HACKER_BACKEND_PORT:-3001}"
FRONTEND_PORT="${HACKER_FRONTEND_PORT:-4174}"

# Eigene Env-Namen, gleiche Ports wie die Inspect-Instanz (3001/4174): Der Browser-MCP erlaubt
# genau diese Origins (.mcp.json --allowed-origins) — eigene Ports wuerden dort geblockt.
# Paralleler Betrieb mit ui-inspect.sh ist so nicht moeglich, aber die LLM-Laeufe teilen sich
# die concurrency-Gruppe llm-sync (max. 1 gleichzeitig) und der Port-Vorabcheck bricht sauber
# ab, falls doch mal eine Instanz laeuft.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Port-Vorabcheck: lieber sauber abbrechen als halb starten (Muster ui-inspect.sh).
for PORT in "$BACKEND_PORT" "$FRONTEND_PORT"; do
	if lsof -ti "tcp:$PORT" >/dev/null 2>&1; then
		echo "FEHLER: Port $PORT ist bereits belegt - laeuft schon eine Angriffsinstanz?" >&2
		lsof -i "tcp:$PORT" >&2 || true
		exit 1
	fi
done

BACKEND_PID=""
FRONTEND_PID=""

# Job-Control aktivieren: jeder Hintergrund-Job landet in einer EIGENEN Prozessgruppe, nur so
# laesst sich unten der ganze Baum abraeumen (pnpm -> nodemon -> sh -c -> node, Muster
# ui-inspect.sh).
set -m

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
	echo "Angriffsinstanz wird beendet ..."

	local tree=""
	[ -n "$BACKEND_PID" ] && tree="$tree $(collect_tree "$BACKEND_PID")"
	[ -n "$FRONTEND_PID" ] && tree="$tree $(collect_tree "$FRONTEND_PID")"

	[ -n "$BACKEND_PID" ] && kill -- "-$BACKEND_PID" 2>/dev/null || true
	[ -n "$FRONTEND_PID" ] && kill -- "-$FRONTEND_PID" 2>/dev/null || true
	if [ -n "${tree// /}" ]; then
		kill $tree 2>/dev/null || true
	fi

	sleep 1
	for PORT in "$BACKEND_PORT" "$FRONTEND_PORT"; do
		REST_PIDS=$(lsof -ti "tcp:$PORT" 2>/dev/null || true)
		if [ -n "$REST_PIDS" ]; then
			kill $REST_PIDS 2>/dev/null || true
		fi
	done
}
trap cleanup EXIT INT TERM

# Backend: vorab gebautes dist direkt starten (HACKER_NO_WATCH=1, CI) oder ueber dev/nodemon.
start_backend() {
	if [ "${HACKER_NO_WATCH:-0}" = "1" ]; then
		pnpm --filter server exec node dist/index.js
	else
		pnpm --filter server dev
	fi
}

echo "Backend startet auf http://localhost:$BACKEND_PORT (In-Memory-DB, Demo-Seed, Auth SCHARF, test-login aktiv) ..."
PORT="$BACKEND_PORT" \
	DB_RESET=true \
	DB_SEED=true \
	DATABASE_STORAGE=":memory:" \
	NODE_ENV=test \
	SESSION_SECRET="hacker-team-session-secret" \
	GOOGLE_CLIENT_ID="hacker-team-dummy-client-id" \
	GOOGLE_CLIENT_SECRET="hacker-team-dummy-client-secret" \
	GOOGLE_ALLOWED_EMAILS= \
	GOOGLE_ALLOWED_EMAIL= \
	MISTRAL_API_KEY= \
	OPENROUTER_API_KEY= \
	CALDAV_ENCRYPTION_KEY="hacker-team-caldav-key" \
	MONETIZATION_ENFORCED="1" \
	start_backend &
BACKEND_PID=$!

# Bereitschaft: /tasks ohne Session 401 - DAS ist hier der Beweis, dass Server UND Auth-Gate
# stehen. curl -w schreibt bei Verbindungsfehler selbst "000" (curl exitet trotzdem mit 7,
# deshalb `|| true` gegen set -e - KEIN `|| echo 000`, das wuerde "000" an "000" haengen und
# jeden Vergleich brechen).
for _ in $(seq 1 60); do
	code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$BACKEND_PORT/tasks" 2>/dev/null || true)"
	if [ "$code" != "000" ] && [ "$code" != "502" ]; then
		break
	fi
	sleep 1
done
if [ "$code" = "000" ] || [ "$code" = "502" ]; then
	echo "FEHLER: Backend auf Port $BACKEND_PORT nicht bereit (Timeout nach 60s)." >&2
	exit 1
fi
if [ "$code" != "401" ]; then
	echo "FEHLER: /tasks antwortet ohne Session mit HTTP $code statt 401 - das Auth-Gate ist nicht scharf." >&2
	exit 1
fi

# Frontend: Vite-Dev-Server, Proxy reicht API-Calls an das Backend (kein --open, headless).
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
echo "Angriffsinstanz bereit:"
echo "  Frontend:  http://localhost:$FRONTEND_PORT"
echo "  API:       http://localhost:$BACKEND_PORT (Auth scharf: unangemeldet 401)"
echo "  Session muenzen (NODE_ENV=test, Allowlist leer):"
echo "    curl -s -c /tmp/attacker.jar -H 'Content-Type: application/json' \\"
echo "      -d '{\"email\":\"angreifer@example.com\"}' -X POST http://localhost:$BACKEND_PORT/auth/test-login"
echo "  Neu starten nach Crash: Hacker-Team-SKILL (Spielregeln: erst Beweis sichern, dann"
echo "  HACKER_NO_WATCH=1 nohup ./hacker-instance.sh > /tmp/hacker-instance.log 2>&1 &)."
echo "  Beenden mit Ctrl+C."
echo ""

wait
