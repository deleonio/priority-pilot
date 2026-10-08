# Spec #2405 — Generierungshorizont der Serien an einer Stelle berechnen

Status: rot (Spec-Phase, Tests noch nicht erfüllt) · Issue: #2405

## Ziel

Die Horizont-Berechnung `now + GENERATE_HORIZON_DAYS` ist bisher an drei Stellen
dupliziert (täglicher Job, `POST /series`-Erstanlage, `POST /series/generate-all`).
Sie zieht als exportierte Funktion `generateHorizonUntil` in `logics/series.ts`
zusammen — dort, wo auch die Konstante `GENERATE_HORIZON_DAYS` liegt. Reiner
Refactor: das Verhalten (UTC-Rechnung, dieselben Instanzen) ändert sich nicht.

## Vorbedingungen

- `GENERATE_HORIZON_DAYS = 30` in `server/src/logics/series.ts` (Produktpolicy-Kommentar bleibt).
- Drei Duplikat-Stellen der Addition `until.setUTCDate(until.getUTCDate() + GENERATE_HORIZON_DAYS)`:
  `logics/seriesAutoCreate.ts` (`runSeriesAutoCreate`), `express/routes/series.ts` in
  `POST /series` (#2404-Erstanlage) und `POST /series/generate-all`.

## Schritte / Verhalten

1. **Zentrale Berechnung (AK1):** `server/src/logics/series.ts` exportiert
   `generateHorizonUntil(now: Date): Date`. Sie gibt `now + GENERATE_HORIZON_DAYS` Tage
   zurück, gerechnet in UTC per `setUTCDate`: der Monatsübergang ist korrekt
   (2026-10-31 → 2026-11-30), die Uhrzeit des Referenzzeitpunkts bleibt erhalten.
   Außerhalb von `logics/series.ts` wird `GENERATE_HORIZON_DAYS` weder importiert noch
   selbst addiert (grep über `server/src` → 0 Treffer außerhalb; der Export der Konstante
   entfällt, knip).
2. **Aufrufstellen (AK2):** `runSeriesAutoCreate` und beide Horizont-Stellen der Route
   rufen die Funktion statt eigener Addition. Das Erzeugungsverhalten ist unverändert —
   Nachweis über die bestehenden Suiten (`seriesAutoCreate.test.ts`, `series.api.test.ts`,
   `series-generate-all-auth.test.ts`) statt eines neuen Tests; der Grep aus AK1 ist
   Prüfschritt in der PR-Beschreibung.

## Erwartetes Ergebnis (Tests)

- `server/src/logics/series.test.ts` — neue Describe-Gruppe `generateHorizonUntil
(#2405, AK1)`: exakt +30 Tage inkl. Monatsübergang bei UTC-Mitternacht;
  Uhrzeit-Erhalt. Roter Zustand bis zur Umsetzung: fehlender Named-Export
  (`does not provide an export named 'generateHorizonUntil'`).
- AK2: keine neuen Tests (Dedup) — die bestehenden Suiten bleiben grün und belegen das
  unveränderte Verhalten (Umsetzungs-Nachweis in der PR-Beschreibung).

## Abgrenzungen

- Kein Verhaltenswechsel, kein neues Feature; die Konstante bleibt in
  `logics/series.ts` (nur ihr Export entfällt).
