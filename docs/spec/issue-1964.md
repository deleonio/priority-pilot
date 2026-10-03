# Spec: #1964 — Verpasst-Bereich, Verschiebe-Zähler, Archivieren (PO-Option O2)

## Ziel

Überfällige, nicht erledigte Aufgaben **ohne** Auto-Löschen-Häkchen erscheinen auf der
Aufgabenliste im Bereich „Verpasst“ mit drei Aktionen (neu planen / archivieren / löschen).
Jede Deadline-Verschiebung nach hinten zählt einen je Aufgabe sichtbaren Verschiebe-Zähler.
Auto-Löschen bleibt unverändert opt-in (AK5 — bestehende Cron-/Logik-Tests bleiben grün).

## Vertrag (Server)

- **Task-Modell** (`server/src/models/task.ts`): neue Spalten `postponeCount` (int, NOT NULL,
  Default 0) und `archivedAt` (Date, nullable). Die Spalten liegen am Task — Serien-Instanzen
  sind Task-Zeilen und tragen sie damit automatisch.
- **`GET /tasks?missed=1`** — Verpasst-Auswahl (abgeleitete Ansicht, kein neuer Status):
  `deadline < now` UND `status != 'Done'` UND `autoDeleteAfterDeadline = false` UND
  `archivedAt IS NULL`. Owner-scoped wie `GET /tasks`.
- **`PATCH /tasks/:id`** — wird `deadline` auf einen **späteren** Zeitpunkt gesetzt (streng
  größer als der alte Wert), steigt `postponeCount` um genau 1. Gleichbleibende/frühere
  Deadlines und Patches ohne `deadline` zählen nicht. `TaskDto` enthält `postponeCount` und
  `archivedAt`.
- **`POST /tasks/:id/archive`** — setzt `archivedAt = now`, ohne `status` zu ändern (kein
  Done-Wechsel → Score/Streak unberührt). Response 200 + TaskDto mit `archivedAt`.
  Archivierte Aufgaben erscheinen weder in der Standardliste (`GET /tasks`) noch in
  `?missed=1`; `GET /tasks/:id` liefert sie weiter (inkl. `archivedAt`).
- Kein Eingriff in `autoDeleteAfterDeadline`-Logik/Cron (AK5), keine Änderung an
  `MissedTasksCard`.

## Vertrag (Frontend)

- Aufgabenliste erhält **über** der Standardliste die Section „Verpasst“ (KI-UX: Region/Karte,
  Testanker `missed-section`, je Aufgabe `missed-item`): Titel, Deadline, Zähler-Badge
  („N× verschoben“, nur bei N ≥ 1) und drei beschriftete Aktionen: „Neu planen“ (öffnet die
  bestehende Task-Bearbeitung), „Archivieren“ (einstufig, ohne Bestätigungsdialog), „Löschen“
  (vorhandener `ConfirmDeleteDialog` inkl. Fokus-Restaurierung).
- Zählerwert 0 wird nicht angezeigt (AK3, WCAG 1.4.1: Text-Badge statt Farbsignal).
- Mobile 375 px (AK6): Zeilen als Liste statt Tabelle, Bereich inkl. aller drei Aktionen ohne
  horizontalen Scroll vollständig sichtbar, Touch-Targets ≥ 44 px (Bounding-Box-Prüfung, die
  App-Shell clippt `overflow-x: hidden`).

## AKs → Tests

| AK        | Test                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1       | `server/src/express/tasks-missed.test.ts` — ohne Häkchen in der Verpasst-Auswahl; mit Häkchen, nicht überfällig, Done und archiviert draußen |
| AK2 + AK6 | `frontend/e2e/issue-1964-missed-area.spec.ts` — Section sichtbar, drei Aktionen ausführbar sichtbar, 375 px per Bounding-Box                 |
| AK3       | `tasks-missed.test.ts` — Verschiebung 1 → 2, Nicht-Verschiebung zählt nicht; e2e zeigt Badge, 0 bleibt unsichtbar                            |
| AK4       | `tasks-missed.test.ts` — archiviert: raus aus Liste/Verpasst, GET by id mit `archivedAt`, Status unverändert                                 |
| AK5       | Regression: bestehende `autoDeleteAfterDeadline`-Tests bleiben unverändert grün (kein neuer Test)                                            |
