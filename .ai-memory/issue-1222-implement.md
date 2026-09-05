# Issue 1222 — Implement (Phase 4), Stand 2026-09-05T21:25Z

**ERGEBNIS: Gate komplett grün, PR #1242 review-ready (`gh pr ready`).**

## Erledigt
- Branch `ai/harness/1222` + Draft-PR #1242 übernommen; lokale Duplikate der 3 Phasen-Notizen byte-identisch mit Branch-Stand → entfernt, Checkout möglich.
- Server: `openapi.yml` (Series: `userId/createdById/createdByName/forUserId/forUserName`; SeriesCreate: `userId`; Task: `userId`), `pnpm build:api` (server) + `pnpm generate` (client, gitignored), `models/series.ts` (`createdById` nullable + Spalte), `migrate.ts` (`createdById` in `SERIES_TABLE_COLUMNS`), `routes/series.ts` (POST-Empfängerlogik #1213-Muster, `seriesReadScope`, `serializeSeriesFor`, serializeSeries-Kontext, POST-Response ohne Owner-Scope nachgeladen), `routes/tasks.ts` (`loadUserNames` exportiert, `serializeTask` mit `userId`), `logics/series.ts:158` (`userId: options.userId ?? series.userId ?? null`).
- Frontend: `TaskForm.tsx` (Empfänger-Select auch im Serie-Modus `!isEdit && recipientVisible`, 403-Wording „Serie", `userId` im seriesCreate-Payload), `SeriesTab.tsx` (KolBadge „Für: …" bei `forUserName`, Toolbar nur bei `forUserId == null`).
- Tests: rote Spec-Tests AK1–AK7 unverändert grün; AK8 neu in `TaskForm.test.tsx` (5 Tests), AK9 neu in `SeriesTab.test.tsx` (2 Tests + KolBadge-Mock), AK10 neu `frontend/e2e/issue-1222-series-recipient.spec.ts` (2 Tests, 375+320 px Bounding-Box) — Spec hatte AK8–AK10 bewusst offen gelassen.
- Gate: `pnpm format`/`prettier --check` ✓, `pnpm lint` ✓, `pnpm knip` ✓ (nur Config-Hints), `pnpm test` ✓ (Server 856 pass/1 skip direkt, root exit 0), e2e: neuer Spec 2/2 ✓ + `series-tab`/`series`/`groups-foreign-task` 21/21 ✓.

## Relevante Stellen
- `server/src/express/routes/series.ts:326` POST (Empfänger-Prüfung wie `tasks.ts:468-487`), `:302` GET-Liste (`seriesReadScope`), `:99` serializeSeries (handedOff-Logik wie `serializeTask`), `:352` POST-Response via `Series.findOne` statt `findSeriesWithPillars` (Ersteller ist bei Empfänger-Serie nicht Owner → sonst 500).
- `server/src/logics/series.ts:158` — AK4-Kernstelle.
- `frontend/src/components/SeriesTab.tsx:152-186` — Badge + bedingte Toolbar.
- `frontend/src/components/TaskForm.tsx:921` — Sichtbarkeit, `:689` Payload.

## Annahmen
- `userId` im Task-DTO (nullable) ist vom roten AK4-Test gefordert (Orakel `GET /tasks`) — Vertragserweiterung im PR-Body dokumentiert.
- PUT/PATCH-Wege unverändert: PATCH akzeptiert `userId` nicht (SeriesUpdate ohne `userId`), Empfänger-Wechsel nachträglich nicht vorgesehen.

## Verworfen
- Separate Migration `migrateSeriesCreatedById` (erst gebaut, dann entfernt): der bestehende `migrate.test.ts`-Test „nach Migration antwortet Series.findAll()…" pinn't `migrateSeriesTable` als alleinige Nachzieh-Stelle → Spalte in `SERIES_TABLE_COLUMNS` (Muster `userId` #244); Test unverändert grün.
- Playwright-MCP-Layout-Check: der neue e2e-Spec prüft exakt 375/320 px per Bounding-Box im echten Browser — stärker als der MCP-Screenshot.

## Offen
- Test-Pflege (im PR-Body dokumentiert): `series-recipient-instances.test.ts:111` `until` 2026-03-01 → 2027-03-01 (Datum lag vor „heute" → Generate-Fenster strukturell leer, nie grün); Assertion-Semantik unverändert.

## Nächster Schritt
- Review-Phase (`ai:needs-review`): Kreuzverhör von PR #1242; DTO-Erweiterung Task.`userId` besonders ansehen.

## Fallstricke
- `pnpm build:api` im `server`-Verzeichnis, nicht im Root (Root hat kein build:api); `client`: `pnpm generate`.
- lint: ungenutzter `import type { User }` in series.ts fliegt auf (resolveGeoUser liefert den Typ implizit).
- Wurzel-`pnpm test` läuft eine andere Test-Glob als `node --import tsx --test "src/**/*.test.ts"` im server (274 vs 857) — beide grün.
- e2e-Serie: nach POST `page.reload()` vor dem Öffnen des Serien-Tabs (SeriesTab lädt nur beim App-Start).
