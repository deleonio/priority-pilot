# Issue 1098 — Implement (Lauf 4), Stand 2026-08-28

**ERGEBNIS: VERDICT not-ready — Deadline; SERVERSEITIG FERTIG & GRÜN, Frontend fehlt komplett.** PR #1103 bleibt Draft (kein `gh pr ready`). Lauf 4 hat als Erster Produktivcode geschrieben und gepusht (Lauf 1–3: nur Notizen).

## Erledigt
- Branch `ai/harness/1098` (Commit a7e6a264 + neue Impl-Commits, s. git log).
- **Server komplett (AK2/AK6/AK7):**
  - `server/src/models/user.ts` — 3 neue Spalten `displayDistanceKm` (Default 5), `alarmDistanceKm` (Default 1), `intervalMinutes` (Default 5), INTEGER, allowNull false.
  - `server/src/express/routes/geoConfig.ts` (NEU) — GET/PUT `/geo-config`: GET=gespeicherte Werte sonst Defaults (flaches Objekt!), PUT mit Kreuz-Schranken-Validierung (alarm ∈ [1, display], display ∈ [alarm, 50], interval ∈ [1, 60], Number.isInteger) → 400 ohne Persistenz; 401 ohne Session.
  - `server/src/express/index.ts` — Import + `app.use(geoConfigRouter)` direkt nach tasksRouter (hinter globalem requireAuth).
  - `server/src/express/routes/tasks.ts` — `/tasks/nearby` filtert jetzt `.filter(item => item.distanceKm <= maxDisplayKm)` nach Sortierung, `maxDisplayKm = geoUser?.displayDistanceKm ?? 5` (User-Import ergänzt).
- **Tests grün (lokal, `npx tsx --test` im `server/`-Verzeichnis):** `geo-config.test.ts` 10/10, `tasks-nearby.test.ts` 6/6.
- KEIN Voll-Gate gelaufen (Zeit) — format/prettier/lint/knop/test offen; Frontend-Unit-/E2E-Tests weiterhin rot (nicht angefasst).

## Relevante Stellen
- Frontend (alles offen): `frontend/src/components/SettingsPage.tsx:235-292` (3 KolInputRange mit Kreuz-Schranken in `_min`/`_max`, key-Remount :266-272, `_disabled`-Muster :338, `_hint` folgt Intervall), `frontend/src/lib/useGeolocation.ts:5,162` (Intervall aus Config, Fallback 5 min, 3 Hook-Instanzen), `frontend/src/components/Dashboard.tsx:222` (NearbyCard bedingungslos), `Footer.tsx:4-14`, `NearbyCard.tsx` (formatKm `(2,4 km)`).
- Rot-Tests Frontend: `SettingsPage.test.tsx` (+125 Z.), `useGeolocation.test.ts` (+54 Z.), `frontend/e2e/issue-1098-geo-settings.spec.ts` (133 Z.), `issue-1066-nearby-card.spec.ts` (+24 Z.).
- OpenAPI/Client-Typen: GeoConfig-DTO fehlt noch (`server/src/api`, `client`-Paket) — Route nutzt lokalen Typ.

## Annahmen
- User-Spalten über `sequelize.sync({force:true})` in Tests (resetDb) — bestätigt, Tests grün.
- Teil-Commit ohne Voll-Gate ist besser als 4. Null-Runde (Lauf 1 hatte anderes Votum — mit gepushten, getesteten Server-Änderungen steht der Folgelauf auf festem Boden).

## Verworfen
- Frontend-Start innerhalb der Restzeit — ~2 Min reichten nicht mal fürs Lesen der Test-Dateien.

## Offen
- Frontend AK1/AK3/AK4/AK5 + TF1–TF4, TF7/TF8 (E2E), OpenAPI/Client-Typen.
- Voll-Gate (format, prettier --check ., lint, knip, test) vor dem finalen Push; danach `gh pr ready 1103` + PR-Beschreibung erweitern (Implementierungs-Zusammenfassung, Testergebnisse, Test-Pflege-Hinweis aus tasks-nearby.test.ts:16-19 ist schon im Spec verankert).

## Nächster Schritt
- Frontend: zuerst `SettingsPage.test.tsx` und `useGeolocation.test.ts` NEU lesen (rot-Vertrag), dann Settings-Block + Hook-Intervall + Dashboard/Footer-Bedingung; Server-Teil NICHT mehr anfassen (grün).

## Fallstricke
- GET/PUT antworten mit dem **flachen** Objekt `{displayDistanceKm, alarmDistanceKm, intervalMinutes}` (deepEqual — kein Wrapper).
- AK2: KEINE Error-States/Alerts/Inline-`_msg` (Autoren-Entscheidung) — dynamische Kreuz-Schranken in `_min`/`_max`.
- TF3: `_disabled`-Wechsel nach Mount → key-Remount (SettingsPage.tsx:266-272).
- TF8: Bounding-Box-Assertions statt scrollWidth; E2E-Filter-Falle: `npx playwright test e2e/<datei>.spec.ts` direkt im `frontend/`-Verzeichnis.
- Intervall-Verkürzung darf Nominatim 1 req/s nicht reißen — Re-Entrancy-Guard im Hook bleibt.
- Server-Tests laufen mit `cd server && npx tsx --test src/express/<file>.test.ts` ( cwd bleibt zwischen Bash-Calls NICHT erhalten — im selben Call cd-en!).
