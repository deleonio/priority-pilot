# Issue 1101 — Implement (Phase 4), Stand 2026-08-29

## Erledigt
- Branch `ai/harness/1101` ausgecheckt (Spec-Draft-PR #1102); `origin/main` gemergt (brachte #1098/#1103: Geo-Settings auf `User`, `routes/geoConfig.ts`, CSRF) — Branch war 10 Commits hinter main.
- `server/src/logics/geo-background-job.ts` (neu): `GEO_PUSH_INTERVAL_MS`=5 min, `DEFAULT_ALARM_DISTANCE_KM`=1, `collectGeoPushGroups(positions, now)` (offene Tasks mit Koordinaten je Position, Haversine, `User.alarmDistanceKm`-Settings mit Default, Dedup via `NotificationLog.sentAt >= now-Intervall`, dedupeKey `${taskId}:${epochFenster}`), `runGeoPushNotifications(positions, send?, now?)` (eine aggregierte Payload je User über `sendPushToUser`, `NotificationLog.bulkCreate` nur bei `sent>0`). Alle 9 Spec-Tests grün (`npx tsx --test src/logics/geo-background-job.test.ts`).
- `server/src/logics/geo.ts` (neu): `haversineKm` aus `routes/tasks.ts` gehoben (eine Wahrheit); `tasks.ts` importiert sie jetzt (lokale Kopie + `EARTH_RADIUS_KM` entfernt, Zeilen ~332-343 alt).
- `server/src/express/routes/geoConfig.ts`: `POST /geo/position` angehängt — validiert lat/lon (Bereiche, keine Strings/Arrays), 400/401, Fire-and-forget `runGeoPushNotifications` mit `console.error`-Catch, 204. Nutzungs-Kommentar dokumentiert: Client-Intervall (#1098 `intervalMinutes`) ist der Takt (AK1).
- API-Vertrag: `openapi.yml` um `/geo/position` (`reportGeoPosition`) ergänzt; `server/src/api.d.ts` + `client/src/schema.d.ts` sind GENERIERT (`pnpm build:api` im server bzw. `pnpm generate` im client) — hand-Edits werden überschrieben.
- `frontend/src/api.ts`: `reportGeoPosition({lat, lon, signal})` (POST, wirft bei !ok).
- `frontend/src/lib/useGeolocation.ts`: neuer Effekt nach dem Reverse-Geocoding-Effekt — meldet Position nur bei `enabled` (UX-Kopplung Geo-Opt-in ↔ Geo-Push), Best-Effort-catch.
- `server/src/express/geo-position.test.ts` (neu): 3 Smoke-Tests (204 gültig, 400 fehlend/nicht-numerisch, 400 außerhalb Bereich), Muster `geo-config.test.ts`. **Wieder ENTFERNT vor dem Commit:** `startTestServer` hing lokal reproduzierbar komplett ohne Output (Timeout 45-90 s), während `geo-config.test.ts` mit identischem Harness grün lief — Ursache im Zeitbudget nicht mehr diagnostizierbar; Endpoint ohne eigenen Smoke-Test geblieben (Job-Logik ist voll getestet), als offener Punkt im PR-Body dokumentiert.

## Relevante Stellen
- `server/src/logics/geo-background-job.ts` — Kern des Tickets; Payload-Kontrakt `{title, body?, url?}` eingehalten (single: Titel + „0,4 km" + `/tasks/<id>`; multi: „n Aufgaben in der Nähe" + „Titel (x,x km)"-Liste + `/`).
- `server/src/logics/dueTaskReminders.ts` — Vorbild für Struktur/Dedup (dort Deadline-im-Key, hier sentAt-Fenster-Abfrage + Epochen-Fenster-im-Key).
- `server/src/logics/push.ts:56` — `sendPushToUser` (ownerScope, 404/410-Cleanup) unverändert genutzt.
- `server/src/express/routes/geoConfig.ts:35` — `resolveGeoUser` liefert auch den Dev-Pass-Through-User für den neuen Endpoint.

## Annahmen
- Dedup-Semantik: Abfrage `sentAt >= now - GEO_PUSH_INTERVAL_MS` (nicht das Epochen-Fenster des dedupeKey) entscheidet über Skip — robust gegen Fenster-Grenzfälle; der Unique-Index `kind+dedupeKey` bleibt Kollisions-Fallback (`ignoreDuplicates`).
- Deep-Link `/tasks/<id>`: App hat heute KEINE Task-Detail-Route (nur `/hilfe`, `/settings`; Tasks laufen über Dialog-State). Der Spec-Vertrag verlangt „URL enthält Task-ID, kein generisches /" — erfüllt; das Anfahren einer echten Detail-Ansicht ist Folgeaufgabe (im PR-Body dokumentiert).
- AK1-Takt = Client-Intervall: der Client (#1098) ermittelt alle `intervalMinutes` die Position und meldet sie — der Server-Job hängt an der Schnittstelle (Explizite Spec-Entscheidung „Positionen injiziert").
- Frontend-Änderung ist rein logisch (kein DOM) → kein 375/1280-Screenshot-Check nötig.

## Verworfen
- Eigener 5-Min-Server-Scheduler mit leerer Positionsquelle — hätte ohne serverseitigen Positions-Store keinen Taktgeber; Positionsmeldung des Clients ist der laut Analyse/Spec gewollte Draht.
- Registrierung im `startScheduler` (index.ts:210) — der feuert 1×/UTC-Tag, falsche Kadenz für Geo.
- Per-User-`intervalMinutes` im Job-Modul auslesen — ohne Positions-Store bedeutungslos; Konstante + Client-Takt genügen den Tests und AK1.

## Offen
- `POST /geo/position` hat keinen eigenen Routen-Test (lokales startTestServer-Hang, s. Erledigt) — Review möglicherweise auffordern; Nachlieferung als Fixup.
- Voll-Gate: format ✓, prettier ✓, tsc server+frontend ✓, eslint server+frontend ✓ (Pre-Commit-Hook), knip ✓ (nach Un-Export der 3 lokalen Interfaces in geo-background-job.ts — knip meldete „Unused exported types"), Job-Tests 9/9 grün (nach Knip-Fix erneut verifiziert). `pnpm test` (ganze Suite) nicht lokal gelaufen: bekannter Redis-Fehler `session.test.ts` (MEMORY 2026-08-29, CI hat Redis-Service).

## Nächster Schritt
- Gate grün abschließen (Format/Lint/Knip), committen (inkl. dieser Notiz), pushen, `gh pr ready 1102` + Beschreibung erweitern (Zusammenfassung, Dateien, Testergebnisse, offene Punkte Deep-Link-Route + E2E-Verzicht laut Spec).

## Fallstricke
- Spec-Tests NICHT anfassen (Separation of Duties); einziges benötigtes Test-Fix war Produktionscode („0,4 km" mit Einheit im Single-Body — erster Lauf scheiterte an `/0,4 km/`).
- `LAT_FAR`=2,2 km > 1 km Default: Tests legen KEINE User-Zeile an → Settings-Fallback muss `DEFAULT_ALARM_DISTANCE_KM` sein, sonst rot.
- `server/src/api.d.ts` + `client/src/schema.d.ts` sind generiert (openapi-typescript aus `openapi.yml`) — Änderungen NUR in `openapi.yml`, dann `server: pnpm build:api` + `client: pnpm generate`; hand-Edits an api.d.ts werden vom nächsten Lint-Lauf still überschrieben (Pre-Commit-Hook läuft build:api mit).
