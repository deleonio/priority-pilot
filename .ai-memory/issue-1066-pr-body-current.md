Closes #1066

Rote Spec-Tests (TDD-Trennung der Zuständigkeiten); Implementierung folgt in Phase 4.
Spec: `docs/spec/issue-1066.md` (im selben Commit, inkl. KI-UX-Entscheidungen: Card ohne
Adressspalte, Koordinaten niemals im aria-label, vier gestaltete Card-Zustände).

## Abgedeckte AKs

- AK1 — Koordinaten-Persistenz (POST/PATCH/GET, Leeren → beide NULL, Bereichsvalidierung): `server/src/express/tasks-coordinates.test.ts`
- AK10 — Freitext-Adresse ohne Vorschlags-Auswahl bleibt speicherbar, keine Koordinate: `tasks-coordinates.test.ts` + Frontend-Teil in `frontend/src/lib/useAddressSearch.test.ts` (Vorschläge tragen `{address, lat, lon}`)
- AK2/AK3/AK7 — `GET /tasks/nearby` (max. 10, aufsteigend, `distanceKm` 1 Nachkommastelle, 401 ohne Session, Datenisolation): `server/src/express/tasks-nearby.test.ts`
- AK6 — Koordinaten-Snapshot in `generateDueInstances` (inkl. Snapshot-Stabilität bei Template-Änderung): `server/src/logics/series.test.ts`
- AK2/AK4/AK5/AK8/AK9/AK11 — Card-Zustände, 375px, Präferenz-aus, Leerzustand, GeoBadge-Label: `frontend/e2e/issue-1066-nearby-card.spec.ts`

Rot-Status verifiziert: Nearby-Endpoint 404 (Test-Run), `useAddressSearch`-Assertion rot (4 bestehende Tests der Datei bleiben grün), Server-tsc ohne Fehler in den neuen Dateien.

## Offene Fragen

- AK11 in der Card selbst ist nach KI-UX-Entscheidung **kein** UI-Fall (Card zeigt bewusst keine Adresse — Datensparsamkeit): getestet wird der Reverse-Geocoding-Vertrag am `GeoBadge` (keine Rohkoordinaten im `aria-label`, Fehlschlag degradiert). Falls die Adresse doch in der Card landen soll, braucht es einen zusätzlichen Test.
- AK5 „Position wird erst nach Freigabe abgefragt" wird über AK8 (`__geoCalls === 0` bei Präferenz aus) und die Mock-Init-Scripts abgedeckt; ein dedizierter „kein Prompt vor Card-Render"-Test wäre nur mit UI-Reaktionszeit-Mocking unterscheidbar — nicht abgedeckt.
- Wortlaut der Leer-/Hinweistexte: Vertrag sind die `data-testid`s (`nearby-empty`, `nearby-denied`, `nearby-preference-off`), nicht die Texte.

## Test-Pflege-Bedarf

- keins (kein bestehender Test widerspricht den neuen AKs)

## Hinweise für Phase 4

- `server tsc --noEmit` ist auf einem frischen Checkout bereits ohne diese Änderung rot (generierte `src/api.ts` fehlt bis zum Codegen-Schritt) — vorbestehend, kein Fix-Ziel der Spec-Phase.
- Umgebungslimit (Memory 2026-08-27): `server/src/express/session.test.ts` braucht Redis; lokal rot, in CI (Service-Container) grün.

### Implementierungs-Stand (Run 1, 27.08. — Zeitlimit erreicht, PR bleibt Draft)

**Server vollständig umgesetzt und grün** (Commit `0d950f87`):
- `server/src/models/task.ts` / `series.ts`: nullable `latitude`/`longitude` (FLOAT, Bereichs-Validierung)
- `server/src/logics/migrate.ts`: Spalten-Nachzug an `tasks` und `series`
- `server/src/logics/series.ts`: Koordinaten-Snapshot in `generateDueInstances` (AK6, #553-Muster)
- `server/src/express/routes/tasks.ts`: lat/lon-Validierung (AK1/AK10) + **NEU `GET /tasks/nearby`** — Haversine, owner-scoped (AK7), offene Tasks, aufsteigend, max. 10, `distanceKm` mit einer Nachkommastelle (AK2/AK3)
- `server/src/express/routes/series.ts`: lat/lon-Validierung/Serialisierung analog `address`
- `openapi.yml`: Schemas erweitert + `NearbyTask`; `api.d.ts` regeneriert

**Verifikation Run 1**: Spec-Tests einzeln grün — `tasks-coordinates.test.ts` 5/5, `tasks-nearby.test.ts` 5/5, `series.test.ts` 18/0; `tsc --noEmit` server ohne Fehler in geänderten Dateien; Pre-Commit (format/knip/lint) grün. **Vollständiges Gate (`pnpm format && prettier --check && lint && knip && test`) und e2e noch offen** — Follow-up-Lauf.

**Noch offen (Frontend, rot)**: `useAddressSearch`-Koordinaten (AK1), Nearby-Client `frontend/src/api.ts`, Dashboard-Card „In der Nähe" inkl. AK4/AK8/AK9-Zustände (AK2/AK5), TaskForm/SeriesTab-Koordinaten, GeoBadge auf lat/lon + Reverse-Geocoding (AK11).

### Test-Pflege-Bedarf
- `frontend/e2e/issue-1066-nearby-card.spec.ts:141-142`: `expect(...).not.toMatch(/…/, 'Nachricht')` — Playwrights `toMatch` ist typisiert mit nur 1 Argument (TS2554 im Pre-Commit-Lint, blockierte alle Commits). Zweites Argument entfernt und als Kommentar erhalten; **Assertions semantisch unverändert**.


## Zwischenstand Implementierung Run 2 2026-08-27

Frontend umgesetzt in Commit d7b9a29e: Nearby-Card auf dem Dashboard, Koordinaten-Uebernahme aus der Adresssuche AK1 AK10, lat/lon in Task Series DTOs, GeoBadge per Reverse-Geocoding mit Session-Cache AK11. Verifiziert: tsc, frontend-vitest 422 Tests gruen, format prettier, Pre-Commit-Hook format lint knip.

Noch offen daher Draft: repo-weites Gate pnpm lint knip test, e2e frontend/e2e/issue-1066-nearby-card.spec.ts, 1280px-Kontrolle, abschliessende PR-Beschreibung.

### Test-Pflege-Bedarf
- frontend/src/lib/useAddressSearch.test.ts Zeile 108: alte Assertion toEqual string-Vorschlaege widerspricht dem AK1-Vertrag Objekte mit lat lon. Minimale Anpassung zu results Neu, begruendet im Test-Kommentar.
