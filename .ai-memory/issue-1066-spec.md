# Issue 1066 — Spec-Phase (2026-08-27)

## Erledigt
- Branch `feat/issue-1066-nearby-card`, Commit c7ad22d6 `test: red spec tests for #1066`, Draft PR #1071 (Titel = Issue-Titel wörtlich, Closes #1066 verifiziert, keine Labels gesetzt).
- Spec `docs/spec/issue-1066.md` geschrieben (AKs 1-11, KI-UX-Entscheidungen eingeflossen, Test-Anker `nearby-card`/`nearby-item`/`nearby-empty`/`nearby-denied`/`nearby-preference-off` als Vertrag fixiert).
- Rote Tests: `server/src/express/tasks-coordinates.test.ts` (AK1/AK10), `server/src/express/tasks-nearby.test.ts` (AK2/AK3/AK7, Auth-Env + Register-Muster aus api-auth-protection.test.ts), Anhang in `server/src/logics/series.test.ts` (AK6 Snapshot, Intersection-Typ `TaskWithCoords` gegen tsc im Pre-Commit), Anhang in `frontend/src/lib/useAddressSearch.test.ts` (AK1 Frontend), `frontend/e2e/issue-1066-nearby-card.spec.ts` (AK2/AK4/AK5/AK8/AK9/AK11, geolocation-Mock per addInitScript, `window.__geoCalls`-Zähler).
- Rot verifiziert: nearby-Endpoint → 404 (tsx --test), useAddressSearch-Assertion rot (4 bestehende Tests der Datei grün), `npx tsc --noEmit` in server meldet KEINEN Fehler in den neuen Dateien.

## Relevante Stellen
- `docs/spec/issue-1066.md` — verbindlicher Vertrag inkl. „Card zeigt bewusst KEINE Adresse" (KI-UX offene Frage 1).
- `server/src/express/tasks-nearby.test.ts` — Endpoint-Vertrag: `GET /tasks/nearby?lat=&lon=`, Response-Feld `distanceKm` (1 Nachkommastelle), max 10, owner-scoped.
- `server/src/logics/series.test.ts:615-695` — Koordinaten-Snapshot-Block; Helper `withCoords` castet Instanzen.
- `frontend/e2e/issue-1066-nearby-card.spec.ts` — `GEO_INIT(permission, geoEnabled)` setzt localStorage `pp-geolocation-enabled` = 'true'/'false' (Format aus useGeolocation.ts:24 verifiziert: String-Compare).
- `frontend/src/lib/useGeolocation.ts:17` — STORAGE_KEY `pp-geolocation-enabled`, Wert `'true'`/`'false'`.

## Annahmen
- Endpoint-Query-Parameter heißen `lat`/`lon`, Response-Feld `distanceKm` — in der Spec fixiert, Impl darf abweichen, müsste dann die Tests anpassen.
- AK4-Test prüft Rest-Dashboard über `getByRole('region', {name: /jetzt dran|nächste aufgabe/i})` — setzt voraus, dass die bestehende Sektion ein benanntes Region-Element bleibt.
- Koordinaten-Spaltennamen `latitude`/`longitude` (Triage-Vorschlag, in Spec fixiert).

## Verworfen
- Dedizierter Vitest-Unit für Reverse-Geocoding-Anzeige (KI-ANALYSE-Testfall): Modul existiert nicht → Import bricht tsc im Pre-Commit (Memory 2026-08-23); AK11 stattdessen e2e über GeoBadge-aria-label ohne Rohkoordinaten.
- „Kein Prompt vor Card-Render" als eigener e2e-Test: nur mit UI-Reaktionszeit-Mocking unterscheidbar — in PR-Body unter Offene Fragen dokumentiert.

## Offen
- -

## Nächster Schritt
- Phase 4 (impl, Label `ai:needs-impl`): Spec + PR #1071 umsetzen — Reihenfolge: Spalten/Migration → Endpoint → Card. Test-Anker und `distanceKm`/`lat`/`lon`-Vertrag aus der Spec übernehmen.

## Fallstricke
- Blanket-`replace()` über series.test.ts traf VORHANDENE `for (const inst of instances)`-Loops (Zeilen 52/430/464/481) — nur die neuen Blöcke casten; vor Commit per `git diff --stat` gegenprüfen.
- `npx tsc --noEmit` im server ist auf frischem Checkout vorbestehend rot (generierte `src/api.ts` fehlt bis Codegen) — nicht als eigener Fehler werten, gezielt nach eigenen Dateinamen greppen.
- Server-Tests mit Auth brauchen das Env-Set (SESSION_SECRET/GOOGLE_*) auf Modul-Ebene + Register-Cookie-Muster, sonst schlagen 401-Assertions aus dem falschen Grund an.

## Re-Run 2026-08-28 (Spec-Phase erneut getriggert)
- Zustand verifiziert, NICHTS neu gemacht: Branch `feat/issue-1066-nearby-card`, Commit c7ad22d6 (Spec + 5 Testdateien, gepusht), Draft PR #1071 (Titel wörtlich, `Closes #1066` im Body, labels=[]). Impl-Commits 0d950f87/d7b9a29e liegen darüber — Spec-Phase darf den Branch nicht rebasen/rewriten.
