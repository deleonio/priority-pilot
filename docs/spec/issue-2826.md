# Spec #2826 — Typ-Audit der Modelle gegen MariaDB

## Ziel

Die Sequelize-Modelle legen unter MariaDB (ADR 0026) korrekte Spaltentypen an: FLOAT→DOUBLE,
Millisekunden-tragende DATE(3), MEDIUMBLOB für Rechnungs-PDFs. SQLite-Verhalten (das Gate)
bleibt unverändert.

## Voraussetzung

- Modelle unter `server/src/models/`, Initialisierung über `sequelize.sync()` (ohne `alter`).
- Gate läuft gegen SQLite; MariaDB-Nachweis (AK7) ist manueller Lauf nach #2825.

## Verhalten (Testvertrag)

1. **AK1 — DOUBLE:** Alle 18 FLOAT-Spalten (12 Modelle: `dependency.weight`, `pillar.weight`,
   `placeFavorite.latitude/longitude`, `scoreEntry.punkte`, `series.estimatedEffort/latitude/longitude`,
   `seriesPillar.share/confidence`, `task.estimatedEffort/actualEffort/latitude/longitude`,
   `taskPillar.share/confidence`, `user.lastGeoLatitude/lastGeoLongitude`) melden
   `DataTypes.DOUBLE` (Spiegel via `getAttributes()`). Bestehende Tests bleiben grün.
2. **AK2 — DATE(3):** `tasks.seriesOccurrence` ist `DataTypes.DATE(3)`; Millisekunden
   überleben Save/Reload identisch (`.123` → `getTime()` gleich). Die Normalisierungsregel
   (Millisekunden erhalten) steht als Kommentar am Modell — Prüfliste, nicht maschinell prüfbar.
3. **AK5 — JSON/BLOB:** `task.checklist`, `series.checklist`, `invoices.lineItems`,
   `pillarFeedback.pillars` bleiben `DataTypes.JSON` (Spiegel) und JSON-Roundtrips liefern
   deep-equal zurück; `invoices.pdfBytes` ist mindestens `DataTypes.BLOB('medium')`
   (MariaDB-BLOB endet bei 64 KB).
4. **AK3/AK4/AK7 — MariaDB-Nachweis:** Unique-Index-Byte-Längen, TEXT→STRING(768), ENUM,
   `sync()`-Lauf unter MariaDB — manuelle PR-Prüfliste (TF4); automatisierter MariaDB-Smoke
   kommt in eigenem Folgeticket (ADR 0026). Kein automatisierter Test möglich (SQLite-Gate).
5. **AK6 — Kollation:** `fn('lower')`-Lookup und Email-/Hash-Uniques verhalten sich unter
   `utf8mb4_general_ci` unverändert — abgesichert durch die bestehenden llmProviders-/Token-Tests
   (TF5, kein neuer Test); Befund in der Prüfliste.

## Erwartetes Ergebnis

`server/src/models/type-audit.test.ts` ist rot (DOUBLE/DATE(3)/MEDIUMBLOB-Assertionen schlagen
auf den FLOAT/DATE/BLOB-Status quo an) und wird mit der Modell-Änderung grün — ohne dass ein
bestehender Test rot wird.
