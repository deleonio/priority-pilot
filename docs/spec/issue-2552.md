# Spalten-Migrationen über einen Helfer (`ensureColumns`)

**Stand:** 2026-10-14

## Ziel

Das 53-fach wiederholte Gerüst in `server/src/logics/migrate.ts` (`PRAGMA table_info` → „Spalte existiert → überspringen" → `ALTER TABLE ADD COLUMN`) wandert in einen Helfer `ensureColumns(db, tabelle, spalten)`. Die Migrationen erzeugen dasselbe Schema wie vorher; eine neue Spalte braucht nur noch einen Listeneintrag (plus ggf. Backfill in der aufrufenden Funktion).

## Voraussetzungen

- Vorlage ist das Muster aus `migrateSeriesColumns` (Liste `{name, definition}` + PRAGMA + Vorhanden-Check + `ALTER TABLE ADD COLUMN`), das der Helfer generalisiert.
- Funktionen mit Zusatzlogik behalten diese: Backfill/Datenupdate, Spalten-DROP, RENAME, Unique-Index. Der Helfer ersetzt nur das Add-Column-Gerüst.
- Reihenfolge `migrateSeriesRenameFields` vor `migrateSeriesTable` bleibt bestehen.
- Semantik „Tabelle fehlt → No-op" (leeres PRAGMA-Ergebnis) bleibt erhalten.
- Exportierte Funktionsnamen/Signaturen bleiben stabil — Aufrufer in `server/src/index.ts` unberührt.
- Reine Datenmigrationen ohne Spaltengerüst (z. B. `migrateLegacyPlans`) werden nicht angetastet.

## Verhalten

1. **AK1 — Alt-Schema-Fixtures bleiben grün:** Alle bestehenden Tests in `server/src/logics/migrate.test.ts` laufen unverändert grün; kein Fixture wird angepasst.
2. **AK2 — Einmaligkeit des Gerüsts:** `PRAGMA table_info` steht in `server/src/logics/migrate.ts` genau einmal — im Helfer. Statischer Nachweis im PR (`grep -c 'PRAGMA table_info' server/src/logics/migrate.ts` = 1), kein Automatisierungstest.
3. **AK3 — Helfer-Vertrag:** Fehlende Spalte wird mit ihrer Definition angelegt; vorhandene Spalte bleibt unverändert (kein `ALTER`, idempotenter Zweitaufruf); fehlende Tabelle ist ein No-op.
4. **AK4 — Gates:** `pnpm --filter server build` und `pnpm --filter server lint` bleiben grün.

## Erwartetes Ergebnis

- Nach der Migration ist das Schema identisch mit dem vorherigen Stand (Alt-Schema-Fixtures grün).
- Eine neue Spalte erfordert nur noch einen Listeneintrag beim Helfer-Aufruf.
- Der Helfer ist idempotent und no-op-sicher auf frischen DBs.

## Testfälle

- TF1 (AK1): Bestandsabsicherung — keine neuen Tests; die unveränderten Alt-Schema-Fixtures in `migrate.test.ts` sind der Vertrag.
- TF2 (AK2): statischer grep-Nachweis im PR-Body (= 1) — kein Automatisierungstest (reine Strukturzählung).
- TF3 (AK3): neuer describe-Block `ensureColumns` in `server/src/logics/migrate.test.ts` mit den drei Fällen aus AK3; Schema-Verifikation per `PRAGMA table_info`.
