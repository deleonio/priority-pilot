# Health-Endpoint Extern Erreichbar Machen

**Issue:** #618  
**Stand:** 2026-08-16  
**Typ:** Operative Infrastruktur-Maßnahme (Abgeschlossen)

## Ziel

Die interne Liveness-Route `GET /health` ist über die öffentliche Domain erreichbar, damit externes Monitoring (Uptime-Checker, Health-Checks) den Backend-Status zuverlässig ermitteln kann.

## Vorbedingung

- Backend läuft und hört auf Port `:3000`
- CaddyReverse-Proxy ist konfiguriert und proxyt aktuell `/api/v1/*` und `/auth/*` an das Backend
- Route `GET /health` existiert im Backend (`server/src/express/index.ts:164-166`)

## Schritte

1. **Health-Test von außen ausführen**
   - Request: `GET https://hetzner.modevel.de/health`
   - Erwartung: JSON-Antwort `{"status":"ok"}` mit `Content-Type: application/json`

2. **Implementiertes Verhalten**
   - Request: `GET https://hetzner.modevel.de/health`
   - Tatsächliche Antwort: `{"status":"ok"}` (JSON, `application/json`)
   - Grund: Caddy proxyt `/health` an den Backend-Endpoint (`docs/caddy-setup.md:15,48`)

3. **Backend-Implementierung**
   - Route `GET /health` existiert im Backend (`server/src/express/index.ts:164-166`)
   - Caddy-Config dokumentiert den Proxy (`docs/caddy-setup.md:15,48`)

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

## Versionierung

- **v1.0** (2026-08-13): Initialefassung für Issue #618. Health-Endpoint extern erreichbar machen.
- **v1.1** (2026-08-16): Nightly-Sync — Ist-Stand-Korrektur. Feature ist bereits implementiert: Caddy-Config proxyt `/health`, Backend-Route liefert `{"status":"ok"}`, Doku in `docs/caddy-setup.md:15,48` aktualisiert.

---

## Status

**ABGESCHLOSSEN** — Das Feature ist vollständig implementiert und in Produktion.
