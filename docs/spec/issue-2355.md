# Spec #2355 — Serien-Schalter „Automatisch anlegen“ (Server)

## Ziel

Eine Serie lässt sich als reine Vorlage führen: Aufgaben entstehen nur auf Abruf, nicht automatisch.

## Vertrag

- `Series.autoCreate` (Boolean, Default `true`; Migration ergänzt Bestand mit `true`). `POST`/`PATCH /series` setzen es, `GET /series` liefert es.
- Rhythmus `none` nur bei effektivem `autoCreate === false` (POST: Body; PATCH: Body oder gespeicherter Wert), sonst 400. Bei `none` ohne `startDate` setzt der Server heute (UTC-Mitternacht).
- `POST /series/generate-all` und `POST /series/:id/generate` legen für `autoCreate: false` nichts an (`created: 0` bzw. 201 mit `[]`).
- `selectSeriesRepresentatives`: Instanzen mit `seriesId` und `seriesOccurrence == null` bleiben einzeln erhalten; Instanzen mit Anker klappen weiter auf eine zusammen.
- `openapi.yml`, `server/src/api.d.ts`, `client/src/schema.d.ts` enthalten `autoCreate` und `none` (kein eigener Test, Build/tsc erzwingt es).

## Tests

`series.api.test.ts` (AK1–AK3, AK4 über `GET /tasks`), `series-representatives.test.ts` (AK4), `migrate.test.ts` (AK1 Migration).
