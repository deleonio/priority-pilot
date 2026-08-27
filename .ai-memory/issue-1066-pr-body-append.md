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
