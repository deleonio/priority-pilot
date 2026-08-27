<!-- ai-review -->
🎯 Review-Status: reviewed — Kreuzverhör (Runde 1) zu PR #1064, implementiert Issue #1063 (`address` an Serien + Geo-Badge in Serien- und Erledigt-Liste): keine Findings; alle sechs Akzeptanzkriterien sind durch grüne Tests abgedeckt.

🟢 **Solide.** Der Vertikal-Schnitt — Modellspalte (`models/series.ts`), Migration über die etablierte `SERIES_TABLE_COLUMNS`-Liste (`logics/migrate.ts`), API-Validierung analog `Task.address` (`routes/series.ts`), Snapshot-Vererbung in `generateDueInstances` (`logics/series.ts`), Kaskade auf offene Instanzen, OpenAPI (3 Schemata + `applyToInstances`), Adressfeld im TaskForm-Serienmodus, `GeoBadge` in `SeriesTab`/`CompletedTasksTable` — folgt durchgängig den vorhandenen Mustern (`description`, `autoDeleteAfterDeadline`).

Stichprobenartig verifiziert:

- Kaskade filtert erledigte Instanzen korrekt raus (`openInstancesWhere` mit `status != 'Done'`, `server/src/express/routes/series.ts`) — AK3/#555 eingehalten.
- Spec-Tests zwischen Spec-Commit `8e9ae3a9` und Impl-Commit `9001fc73` unverändert (Separation of Duties eingehalten, keine Wasserung).
- E2e-Anker existieren: `series-tree-item-<id>` auf dem `<li>` (`SeriesTab.tsx:144`), `_task` an `DoneTaskRow` — die AK4–AK6-Tests haben Zähne.
- Mobile-first: keine neuen `@media`-Regeln, `.done-title-cell` löst 375px über Umbruch (`flex-wrap`/`overflow-wrap`), per E2e-Bounding-Box geprüft (AK6).
- Die beiden Abweichungen — Badge als `<span role="img">` statt `KolBadge` (Vertrag verlangt `data-testid` + `aria-label` auf demselben Element) und Migration über die Spaltenliste statt eigener `migrateSeriesAddress` (Testvertrag von `migrateSeriesTable`) — sind im PR-Body begründet und nachvollziehbar.
- CI: `verify`/`precheck` grün; die e2e-Matrix war zum Review-Zeitpunkt noch pending — das übernimmt der Gate-Workflow (`pr-gate-merge.yml`) deterministisch.

### ✅ Behobene Anmerkungen

noch keine — erste Runde ohne Findings.

### Footer

Review-Typ: Kreuzverhör
Updated: 2026-08-27
