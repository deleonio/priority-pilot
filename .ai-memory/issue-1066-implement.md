# Issue 1066 — Implement-Phase (2026-08-27, Run 1: SOFT-DEADLINE-ABBRUCH)

## Erledigt
- Branch `feat/issue-1066-nearby-card` (Draft PR #1071) ausgecheckt, rote Spec-Tests lokal bestätigt.
- SERVER KOMPLETT (alle Server-Spec-Tests GRÜN):
  - `server/src/models/task.ts` — Felder + Spalten `latitude`/`longitude` (FLOAT, nullable, validate -90..90/-180..180) neben `address`.
  - `server/src/models/series.ts` — analog (mit defaultValue null).
  - `server/src/logics/migrate.ts` — lat/lon an `SERIES_COLUMNS` (tasks) UND `SERIES_TABLE_COLUMNS` (series) angehängt (FLOAT, nullable → kein DEFAULT nötig).
  - `server/src/logics/series.ts` — Snapshot `latitude: series.latitude ?? null, longitude: series.longitude ?? null` direkt unter der address-Zeile in generateDueInstances.
  - `server/src/express/routes/tasks.ts` — TaskAttributes + Validierung lat/lon (Zahl/null, Bereich, eigene Fehlermeldungen), serializeTask liefert lat/lon, NEU `GET /tasks/nearby` (Op importiert, Haversine `haversineKm`, status != Done, lat/lon != null, ownerScope, sortiert, slice(0,10), distanceKm auf 1 Nachkommastelle gerundet; Route VOR `/tasks/:id` registriert; ungültige Query → 400). NearbyTaskDto-Typ importiert.
  - `server/src/express/routes/series.ts` — SeriesAttributes + Validierung lat/lon analog address, serialize + instanceAttrs-Übernahme (PATCH auf offene Instanzen).
  - `openapi.yml` — latitude/longitude in Task/TaskCreate/TaskUpdate/Series/SeriesCreate/SeriesUpdate; NEU Schema `NearbyTask` (id/title/distanceKm required) + Pfad `/tasks/nearby` (400 → `$ref: '#/components/responses/ValidationError'`; KEIN security-Block — Repo hat keine securitySchemes, openapi-typescript bricht sonst).
  - `pnpm build:api` lief grün (api.d.ts regeneriert), `npx tsc --noEmit`: keine Fehler in geänderten Dateien.
- Test-Verifikation einzeln pro Datei: tasks-coordinates 5/5, tasks-nearby 5/5, series 18/0 — GRÜN.

## Relevante Stellen
- `server/src/express/routes/tasks.ts` — `/tasks/nearby` + lat/lon-Validierung (Insert in validateTaskFields vor dem deadline-Block).
- `openapi.yml` — `/tasks/nearby` Pfad direkt vor `/tasks/{id}:`; NearbyTask-Schema vor ReverseGeocodeResponse.
- `frontend/src/lib/useAddressSearch.test.ts` + `frontend/e2e/issue-1066-nearby-card.spec.ts` — NOCH ROT, Frontend fehlt komplett.

## Annahmen
- `pnpm test` (node --test Glob) startet JEDE Datei im eigenen Prozess → der Cross-File-Sequelize-Fehler („no such table: main.pillars" bei drop) tritt nur auf, wenn man MEHRERE Testdateien in EINEM tsx-Aufruf startet — kein Produktionsfehler.

## Verworfen
- Frontend in Run 1 — Zeitlimit (soft deadline) erreichte den Server-Abschluss; sauberes Committen statt halbfertigem Frontend.

## Offen
- FRONTEND KOMPLETT (Run 2): `frontend/src/api.ts` nearby-Client (GET /tasks/nearby?lat=&lon=), `frontend/src/lib/useAddressSearch.ts` Vorschläge `{address, lat, lon}` statt Strings (roter Test vorhanden!), `frontend/src/components/TaskForm.tsx` Koordinate des Vorschlags übernehmen + Leeren → null/null, Dashboard-Card „In der Nähe" (Test-Anker nearby-card/nearby-item/nearby-empty/nearby-denied/nearby-preference-off, KolCard-Muster Dashboard.tsx:156, max. 10, #id+Titel+km, KEINE Adresse im Eintrag — Spec docs/spec/issue-1066.md), AK4/AK8-Hinweise, SeriesTab lat/lon mitspeichern, GeoBadge auf lat/lon keyen + Reverse-Geocoding (AK11, "Adresse nicht verfügbar").
- Gate komplett: `pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip && pnpm test` — in Run 1 NICHT mehr gelaufen (nur tsc + Einzeltests). Vor dem nächsten Push zwingend.
- e2e `frontend/e2e/issue-1066-nearby-card.spec.ts` rot — braucht Card. Direkt laufen lassen mit `npx playwright test e2e/issue-1066-nearby-card.spec.ts` im frontend-Verzeichnis (Memory: --filter greift nicht).
- PR #1071 bleibt DRAFT bis Frontend + Gate grün → dann `gh pr ready 1071` + Body erweitern (Format/Lint/Test-Ergebnisse dokumentieren, e2e-Befund).

## Nächster Schritt
- Run 2: Frontend umsetzen (api.ts → useAddressSearch → TaskForm/SeriesTab → Dashboard-Card), dann GATE in voller Länge, erst dann pushen + PR ready.

## Fallstricke
- openapi-typescript bricht bei unbekannten $refs (responses/BadRequest|Unauthorized existieren NICHT — ValidationError/NotFound sind die vorhandenen) und bei security-Schemes ohne Deklaration.
- Die nearby-Route MUSS vor `/tasks/:id` bleiben (sonst fängt parseId sie als 404).
- Server-Testdateien NICHT mehrere in einem tsx-Aufruf (s. Annahmen).
- PR-Body/Commit: deutscher Text, Commit-Message-Referenz `#1066`.
