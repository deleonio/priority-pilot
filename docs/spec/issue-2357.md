# Spec #2357 — Aufgabe aus Serie auf Abruf anlegen

## Ziel

`POST /series/:id/instances` legt jederzeit genau eine Aufgabe aus einer aktiven Serie an,
unabhängig von `autoCreate`. Die Aufgabe verhält sich danach wie jede Instanz.

## Vertrag

- **Body optional** (`{}`/leer): Titel, Priorität, Aufwand, Beschreibung, Adresse/Koordinaten,
  Kategorie, `autoDeleteAfterDeadline` und Säulen (Snapshot) kommen von der Serie, `userId` ist der
  Serien-Eigentümer. Die Kopierlogik teilt sich der Abruf mit `generateDueInstances`.
- **Overrides:** `title`, `priority`, `estimatedEffort`, `description`, `deadline` (ISO). Ungültige
  Werte (leerer Titel, ungültige Deadline, …) → 400, nichts angelegt. Ohne `deadline` bleibt sie leer.
- **Verknüpfung:** `seriesId` = `originSeriesId` = Serien-ID, `seriesOccurrence` leer (kein Anker).
- **`isException`:** `true`, wenn ein mitgegebener Wert von der Serie abweicht (Titel, Priorität,
  Aufwand, Beschreibung); gleiche Werte oder nur `deadline` → `false`.
- **Antworten:** 201 + Task-DTO; ruhende Serie (`active: false`) → 409; unbekannte/fremde Serie → 404.
- **Grenzen:** `MAX_OPEN_INSTANCES` und `autoCreate` wirken nicht.
- **Benachrichtigung:** bei `createdById !== userId` genau ein Push wie #1253, bei Selbst-Anlage keiner.
- **Kaskade:** `PATCH applyToInstances` und `DELETE ?cascade=true` erfassen die Aufgabe über `seriesId`.
- **Automatik:** Aufgaben ohne Anker verhindern oder verschieben keinen regulären Termin.

## Testabdeckung

| AK  | Test                                                                |
| --- | ------------------------------------------------------------------- |
| 1–4 | `server/src/express/series-instances.api.test.ts`                   |
| 5   | `server/src/express/series-generated-notification.test.ts` (#2357)  |
| 6   | `server/src/express/series.cascade.test.ts` (Abruf-Aufgaben, #2357) |
| 7   | `server/src/express/series-instances.api.test.ts` (AK7)             |
