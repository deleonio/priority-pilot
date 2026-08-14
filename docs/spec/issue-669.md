# Issue 669: Redundanz-Signatur um describe-Kette erweitern

## Ziel

Die Redundanz-Erkennung in `.github/scripts/analyze-test-suite.ts` soll echte Dubletten von False Positives unterscheiden. Gleichnamige Tests in **verschiedenen** describe-Blöcken (verschiedene Endpoints/Tabellen/Migrationen) dürfen nicht als Redundanz gemeldet werden.

## Vorbedingung

- `.github/scripts/analyze-test-suite.ts` existiert und gruppiert Tests nach `file + name + matcher`
- Test-Reports vom 2026-08-14 zeigen 6 False Positives (siehe Issue-Body)

## Schritte

### 1. Analyse der Ist-Situation

**Datei**: `.github/scripts/analyze-test-suite.ts`
**Zeile**: 564 + 583 (`redundancySignature` / `detectRedundancy`)

Aktuelle Signatur: `file + name + matcher`

- Fehlende Dimension: **describe-Kette**
- Konsequenz: Gleichnamige Tests in verschiedenen describe-Blöcken kollidieren

Beispiel-Fälle (aus Report 2026-08-14):

- `server/src/express/api.test.ts`: "404 wenn nicht gefunden" in 3 verschiedenen describe-Blöcken (GET/PATCH/DELETE)
- `server/src/logics/migrate.test.ts`: "ist idempotent: ..." für 2 verschiedene Migrationen
- `server/src/models/title-length-schema.test.ts`: "DB-Validierung: 30 Zeichen ..." für 2 verschiedene Tabellen

### 2. Lösung: Signatur erweitern

**Neue Signatur**: `describe-chain::name::matcher`

- Die describe-Kette wird als Präfix vorangestellt
- Nur Tests mit **identischer** describe-Kette werden verglichen

### 3. Verifikation (lokaler Scanner-Lauf)

**Scanner vor Änderung** gegen die 4 betroffenen Dateien laufen:

- Erwartet: 6 False-Positive-Warnings
- Dateien: `server/src/express/api.test.ts`, `server/src/express/series.api.test.ts`, `server/src/logics/migrate.test.ts`, `server/src/models/title-length-schema.test.ts`

**Scanner nach Änderung** gegen gleiche Dateien:

- Erwartet: **0 Warnings** (die 6 Fälle verschwinden)

**Negativ-Test** (echte Dubletten):

- In `temp-test.ts` einen Test **im selben** describe-Block duplizieren
- Erwartet: 1 Warning (echte Dubletten werden weiterhin gemeldet)

## Erwartetes Ergebnis

- **[AK1]** Die 6 Findings aus dem Report vom 2026-08-14 entstehen nicht mehr
- **[AK2]** Echte Copy-Paste-Dubletten im selben describe-Block werden weiterhin gemeldet
- Die Redundanz-Heuristik bleibt scharf, sondern nur besser präzise

## Technische Details

**Änderungsbereich**: Chirurgische Änderung in `analyze-test-suite.ts`

- Zeile 564: `redundancySignature`-Funktion erweitern
- Zeile 583: `detectRedundancy`-Gruppierung anpassen
- Die describe-Kette muss aus dem Test-Kontext extrahiert werden

**Hinweis**: ADR #567 gilt — für `.github/scripts/` werden keine eigenen Tests geschrieben. Verifikation erfolgt über lokalen Scanner-Lauf.
