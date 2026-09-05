# Issue 1222 — Review (Phase 5), Stand 2026-09-05T21:35Z

**ERGEBNIS: VERDICT reviewed, Ampel 🟢 (nit-only, kein Fixup-Lauf).** Kreuzverhör Erstunde von PR #1242 (kein ai-review-Marker vorhanden → MODE=Cross-Examination). Review 5123089231 (event COMMENT, 2 Inline-Nits) + Sammelkommentar `5554880899` (Marker `<!-- ai-review -->`). Titel-Gate: PR-Titel war nicht CC-konform → `feat(server): create task series for a group member (#1222)` gesetzt.

## Erledigt
- MODE-Bestimmung: `gh pr view --json comments` = leer → kein Marker → Kreuzverhör; Closing-Issue #1222 existiert → AKs aus Harness-Kommentar (KI-ANALYSE stand=2026-09-05T20:17:52Z, 10 AKs) gelesen.
- Gesamtdiff gelesen (1488 Zeilen, 18 Dateien); alle 10 AKs gegen Code+Tests geprüft (server: series-created-by.test.ts AK1-3/5/7, series-recipient-instances.test.ts AK4/6; frontend: TaskForm AK8, SeriesTab AK9; e2e AK10 375+320px Bounding-Box).
- AK4-Priority `options.userId ?? series.userId ?? null` (logics/series.ts:155) verifiziert: einzige Aufrufstellen series.ts:638 (kein userId) und logics/series.ts:188 (nur Serien des Aufrufers, userId identisch) → safe; Pass-Through profitiert.
- Spec/Impl-Trennung per `git diff 1a25455e bf6839eb` verifiziert: einzige Teständerung = `until`-Konstante 2026-03-01→2027-03-01 (series-recipient-instances.test.ts:111), Assertions unverändert, im PR-Body dokumentiert → kein Trennungsverstoß.
- Migration: `createdById` in `SERIES_TABLE_COLUMNS` (migrate.ts:75), `migrateSeriesTable` wird in index.ts:166 aufgerufen (vor sync) ✓; kein eigener Export nötig (Spec-Annahme bestätigt).
- KoliBri-first: KolBadge (Muster TaskTree.tsx:127), CSS-Klasse `series-tree-badge` existiert (app.css:1471), keine neuen @media, e2e 375+320px.
- CI: verify pass, e2e 1-4 pass (gh pr checks) → Tests grün belegt, kein lokaler Lauf nötig (node_modules fehlen eh).
- Serialisierung: `serializeSeries` ohne Kontext an series.ts:479 (GET :id) und :572 (generate) — beide ownerScope-geschützt, Empfänger-Sicht → handedOff falsch; konsistent mit tasks.ts:614/692 (#1213-Präzedenz) → kein Finding.

## Relevante Stellen
- `server/src/express/routes/series.ts:376` + `:91` — Nit 1: doppelter `resolveGeoUser` je GET /series (2× User.findByPk).
- `server/src/express/series-recipient-instances.test.ts:111` — Nit 2: hartcodiertes `until` 2027-03-01, Test läuft danach leer/rot.
- `server/src/logics/series.ts:155` — AK4-Kernstelle, korrekt umgesetzt.
- `server/src/express/routes/geoConfig.ts:29-49` — `resolveGeoUser` = 1 DB-Query je Aufruf (findByPk/findOne), Grund für Nit 1.

## Annahmen
- CI `verify` (pass) deckt format/lint/build/test ab; lokale Testläufe deshalb nicht wiederholt (node_modules nicht installiert).
- Gate-Ergebnisse im PR-Body (856/586 Tests pass) als wahr angenommen, durch grüne CI-Jobs gestützt.
- Titelscope `server` statt `series` gemäß Vorgabe im Review-Prompt (type/scope hints feat/server), obwohl der Branch-Commit `feat(series)` nutzt.

## Verworfen
- Blocker-Suche in Pass-Through-Edge-Cases (userId im Body ohne Auth): `recipientInput !== requesterId` → GroupMember-Check mit `?? -1` → 403; sicher, kein Finding (Muster identisch tasks.ts #1213).
- AK7-Migrationstest als "echter" Altbestand (Spalte fehlt physisch): deckt bestehendes migrate.test.ts ab; Spec-Vertrag (NULL-Serie lesbar) ist getestet.
- Subagent-Recherche (haiku/recherche) — API 400 (MEMORY 2026-09-05 bestätigt); Greps direkt ausgeführt.
- labels gesetzt — verboten (Workflow).

## Offen
-

## Nächster Schritt
- Fixup nur falls ein Mensch die 2 Nits ordert (beide nicht-blockierend); sonst Merge-Gate (gate-merge) laufen lassen.

## Fallstricke
- `gh pr comment --json id` existiert nicht (Flag unbekannt) → URL-Output direkt verwenden.
- Sammelkommentar-Suche über `issues/1242/comments` + `startswith("<!-- ai-review -->")` (nicht review-Kommentare) — ersteller-ID-Filter unnötig.
- Inline-Kommentar-Zeilen müssen im NEW-Diff liegen: series.ts:376 und test.ts:111 verifiziert per grep im Working-Tree (der PR-Stand ist ausgecheckt).
