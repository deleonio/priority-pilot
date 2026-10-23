# Spec #2501 — Checkpunkte an der Serie/Vorlage

Checklisten („Checkpunkte", Muster Task-Checkliste #531) werden an der **Serie/Vorlage** gepflegt.
Jede neu erzeugte Instanz startet mit einer Kopie der Checkliste, alle Punkte offen; das Abhaken
bleibt allein an der Instanz. Bestehende offene Instanzen werden von Checklisten-Änderungen an der
Serie bewusst **nicht** angefasst (Abhak-Stände sind Nutzerfortschritt; ADR 0020 Punkt 3 regelt den
Live-Link der Instanz, nicht die Feld-Kaskade).

## Datenmodell

- Neue JSON-Spalte `checklist` am `Series`-Template, Default `[]`; Eintrag-Typ
  `SeriesChecklistItem = { id: UUID, title: string }` — **ohne** `completed` (das Abhaken gehört
  zur Instanz). Muster: `Task.checklist` (#531, models/task.ts:221).
- Migration `migrateSeriesChecklist` (analog `migrateTaskChecklist`, migrate.ts:694): fehlende
  Spalte wird vor `sync()` per `ALTER TABLE` nachgezogen; idempotent, frische DB → No-op.
- Grenze: `MAX_CHECKLIST_ITEMS = 50` wie bei Tasks; Fehlermeldung dynamisch aus der Konstante.

## REST (`/series`)

- `POST /series` und `PATCH /series/:id` nehmen `checklist` entgegen; Validierung analog
  `validateChecklist` (routes/tasks.ts:94): Liste ≤ 50, je Eintrag gültige UUID-`id`, nicht-leerer
  `title` (1–255 Zeichen nach Trim). Ein Eintrag mit `completed` wird mit **400** abgewiesen
  (REST und MCP) — die Serie kennt keinen Erledigt-Stand.
- `GET /series` und `GET /series/:id` liefern `checklist` im DTO mit (auch `series_list` über MCP);
  Einträge tragen genau `id` und `title`, kein `completed`.
- Die PATCH-Kaskade (`applyToInstances`, #553) übernimmt `checklist` bewusst **nicht** auf
  bestehende offene Instanzen.

## Instanz-Erzeugung (AK4)

`createInstanceFromSeries` (logics/series.ts:183 — gemeinsame Kopierlogik) snapshotet
`series.checklist` auf die Instanz: alle Punkte mit **denselben UUIDs** und `completed: false`.
Gilt für alle Erzeugungspfade: `generateDueInstances`, Auto-Job (`runSeriesAutoCreate`) und
`createOnDemandInstance` (`series_instantiate`). Das Abhaken einer Instanz ändert weder Serie noch
Schwestern-Instanzen.

## MCP (AK2)

Neue Werkzeuge (Muster `task_checklist_*`, tools.ts:558):

| Werkzeug                  | Eingabe                     | Wirkung                                                                                                                                 |
| ------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `series_checklist_add`    | `{ seriesId, title }`       | hängt `{id (Werkzeug-UUID), title}` an; Antwort nur der Punkt                                                                           |
| `series_checklist_update` | `{ seriesId, item, title }` | benennt den per exaktem Titel (Trim, Groß-/Kleinschreibung) benannten Punkt um; Antwort nur der Punkt; `completed` ist kein Eingabefeld |
| `series_checklist_remove` | `{ seriesId, item }`        | entfernt den Punkt; kurze Antwort                                                                                                       |

Grenze 50 gilt auch hier (51. Punkt → Fehler mit „höchstens 50" und `(HTTP 400)`). Fremde
Serien-ID → 404, keine Wirkung (ownerScope, AK6). `series_list` braucht keine Änderung (DTO reicht).

## App (AK1, KI-UX eingearbeitet)

Der #531-Checklisten-Editor (`TaskForm.tsx:1965`, bisher per `!isSeriesMode` ausgeblendet) ist im
Serie-Modus verfügbar: Initialisierung aus `series.checklist`, Speichern über die bestehenden
Series-Save-Pfade (`seriesCreate`/`seriesUpdate` tragen `checklist`), Einträge **ohne**
Erledigt-Schalter (Zeile besteht aus Titel + Aktionen — der Switch wird nicht versteckt mitgeführt).
Umbenennen inline je Zeile (Eingabefeld statt Zweit-Modal), Umsortieren über sichtbare
Auf/ab-Buttons je Zeile (`_label` „Nach oben verschieben"/„Nach unten verschieben", icon-only mit
aria-label, am Rand deaktiviert statt versteckt) — Tastatur- und Touch-Alternative zur Geste.
Der Editor bleibt in der bestehenden „Optional"-Accordion-Sektion (#1159).

## Erwartete Ergebnisse je AK

| AK    | Erwartetes Ergebnis                                                                                                      | Tests                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| AK1   | CRUD an Checkpunkten in der App (Serie-Modal), persistsiert nach Reload; kein Erledigt-Schalter                          | `frontend/e2e/series-checklist.spec.ts`, `TaskForm.test.tsx`                     |
| AK2   | MCP `series_checklist_add/update/remove` an eigener Serie; 51. Punkt abgewiesen                                          | `server/src/mcp/tools.test.ts`                                                   |
| AK3   | `GET /series`, `GET /series/:id`, `series_list` liefern `checklist` ohne `completed`                                     | `server/src/express/series.api.test.ts`, `server/src/mcp/tools.test.ts`          |
| AK4   | generate, Auto-Job und Abruf-Instanz starten mit Serie-Checkliste, alle `completed: false`                               | `server/src/logics/series.test.ts`, `server/src/logics/seriesAutoCreate.test.ts` |
| AK5   | `completed` (REST+MCP) → 400; Instanz-Abhaken ändert Serie/Schwestern nicht; PATCH kaskadiert nicht; Modell-Default `[]` | `series.api.test.ts`, `tools.test.ts`, `models/series.test.ts`                   |
| AK6   | fremde Serien-ID → 404 (REST-PATCH und MCP-Werkzeuge), keine Wirkung                                                     | `series-dataisolation.test.ts`, `tools.test.ts`                                  |
| Migr. | `migrateSeriesChecklist`: Spalte fehlt → wird angelegt; frische DB → No-op                                               | `server/src/logics/migrate.test.ts`                                              |
