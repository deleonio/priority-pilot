# Issue 1063 — Implement (Phase 4)

## Erledigt
- Draft PR #1064 (Branch `feat/issue-1063-geo-badge`) ausgecheckt, Datei-Verifikation OK, Ampel 🟢.
- Server: models/series.ts (address-Feld + Spalte), migrate.ts, routes/series.ts (Validierung/Serialisierung/Kaskade), logics/series.ts (Snapshot-Vererbung), openapi.yml (3 Schemata + applyToInstances-Text), Typen regeneriert (gitignored).
- Frontend: TaskForm.tsx (Adressfeld auch im Serie-Modus, Payloads, Kaskade-Erkennung, Vorbelegung), neuer GeoBadge.tsx, SeriesTab.tsx + CompletedTasksTable.tsx (Titel-Zelle per renderIntoCell), app.css (.geo-badge/.done-title-cell).
- **Migration über SERIES_TABLE_COLUMNS-Liste in migrate.ts gelöst, NICHT über eigene migrateSeriesAddress** — der bestehende Test migrate.test.ts:226 („findAll ohne SQLITE_ERROR nach migrateSeriesTable+sync") erzwingt das Serien-Muster; erste Variante mit eigener Funktion machte ihn rot, wieder entfernt.
- Gates: format/prettier/lint/knip alle 0; Server-Tests 713 pass / 0 fail (Exit 1 nur durch bekannten Redis-Umgebungsskip in session.test.ts, pre-existing lt. MEMORY 2026-08-27); Frontend 421 pass; E2e issue-1063-geo-badge.spec.ts 3/3 grün (AK4/AK5/AK6).
- Commit 9001fc73 gepusht; PR #1064 ready gesetzt, Body erweitert (.ai-memory/issue-1063-pr-body-impl.md, inkl. KoliBri-Abweichungs-Begründung + Impeccable-Detector-Fehlanzeige + Migrations-Muster-Abweichung). `closingIssuesReferences`=[1063] verifiziert.

## Relevante Stellen
- server/src/logics/migrate.ts SERIES_TABLE_COLUMNS — Serien-Spalten kommen hier rein, nie als eigene Migration.
- frontend/src/components/GeoBadge.tsx — geteilter Badge (span role=img, FA-Globus, aria-label, testid).

## Annahmen
- Redis-Skip in session.test.ts ist umgebungsbedingt (CI hat redis:8-Service), kein Fix-Ziel.

## Verworfen
- Eigene `migrateSeriesAddress` (Analyse-Vorschlag) — widerspricht dem migrateSeriesTable-Testvertrag; stattdessen Spalte in die gemeinsame Liste.
- KolBadge fürs Badge — Label landet im Shadow-DOM; Vertrag verlangt data-testid + aria-label auf demselben Element (Begründung im PR-Body).
- Impeccable-Detector — Skill existiert im Repo nicht (.claude/skills/impeccable/ fehlt); per PR-Body dokumentiert.

## Offen
- keine

## Nächster Schritt
- Phase abgeschlossen; ggf. Review-Fixup-Runden (review-kreuzverhoer) folgen.

## Fallstricke
- Keine Tests geändert (Separation of Duties eingehalten); Test-Pflege-Bedarf: keiner.
