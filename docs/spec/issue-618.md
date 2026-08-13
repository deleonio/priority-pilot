# Health-Endpoint Extern Erreichbar Machen

**Issue:** #618  
**Stand:** 2026-08-13  
**Typ:** Operative Infrastruktur-Maßnahme

## Ziel

Die interne Liveness-Route `GET /health` soll über die öffentliche Domain erreichbar sein, damit externes Monitoring (Uptime-Checker, Health-Checks) den Backend-Status zuverlässig ermitteln kann.

## Vorbedingung

- Backend läuft und hört auf Port `:3000`
- CaddyReverse-Proxy ist konfiguriert und proxyt aktuell `/api/v1/*` und `/auth/*` an das Backend
- Route `GET /health` existiert im Backend (`server/src/express/index.ts:164-166`)

## Schritte

1. **Health-Test von außen ausführen**
   - Request: `GET https://hetzner.modevel.de/health`
   - Erwartung: JSON-Antwort `{"status":"ok"}` mit `Content-Type: application/json`

2. **Aktuelles Verhalten (vor der Änderung)**
   - Request: `GET https://hetzner.modevel.de/health`
   - Tatsächliche Antwort: `index.html` (SPA-Fallback, `text/html`)
   - Grund: Caddy proxyt nur `/api/v1/*` und `/auth/*`, `/health` fällt auf SPA

3. **Lösungsoptionen**
   - **Option A:** `/health` zu Caddy-Proxy-Liste hinzufügen (bevorzugt – minimale Änderung)
   - **Option B:** `/api/v1/health` neu erstellen und dort proxyen

4. **Caddy-Config erweitern (Option A)**
   - In `docs/caddy-setup.md` den `/health`-Pfad zur Proxy-Liste hinzufügen
   - Auf Produktivserver in Caddy-Config den `/health`-Reverse-Proxy-Handler einfügen

## Erwartetes Ergebnis

- `GET https://hetzner.modevel.de/health` antwortet mit `{"status":"ok"}` (JSON)
- Health-Check ist von extern erreichbar (kein SPA-Fallback)
- Monitoring-Dienste können Backend-Down von Backend-up unterscheiden
- Keine Authentifizierung erforderlich (öffentliche Liveness-Route)

## Randfälle & Fehler

| Situation                               | Erwartetes Verhalten                                    |
| --------------------------------------- | ------------------------------------------------------- |
| Backend down (Node-Prozess läuft nicht) | Caddy liefert 502 Bad Gateway (proxy-Error)             |
| Backend startup fehlgeschlagen          | Caddy liefert 502 (Backend antwortet nicht auf `:3000`) |
| Health-Route selbst fehlerhaft          | Backend antwortet mit 5xx (Express-Error-Handler)       |
| Caddy-Config syntaktisch fehlerhaft     | Caddy reload schlägt fehl, Config-Rollback notwendig    |

## Akzeptanzkriterien

1. ✅ `GET /health` ist von extern erreichbar und antwortet mit JSON `{"status":"ok"}`
2. ✅ Caddy-Config in `docs/caddy-setup.md` dokumentiert den `/health`-Proxy
3. ✅ Keine Authentifizierung erforderlich (öffentliche Route)
4. ✅ Bei Backend-down liefert Caddy korrektes 502 (nicht SPA-Fallback)
