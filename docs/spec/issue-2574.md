# Spec: Wochenübersicht — erledigte Aufgaben am Tag des Abhakens (#2574)

**Stand:** 2026-10-13 · Quelle: Issue #2574 + KI-ANALYSE (Harness-Kommentar)

## Ziel

Erledigte Aufgaben erscheinen in der Wochenansicht an dem Kalendertag, an dem sie abgehakt wurden — nicht mehr an ihrem Deadline-Tag. Offene Aufgaben bleiben unverändert am Deadline-Tag.

## Verhalten

### Erledigt-Tag als Zuordnung (AK1, AK2)

- Die API liefert je Task `completedAt` (Erledigt-Zeitpunkt), abgeleitet aus `ScoreEntry.zeitpunkt` (Assoziation `Task.hasOne(ScoreEntry)`, `server/src/models/index.ts:84`) — kein neues Task-DB-Feld.
- `WeekView` ordnet eine erledigte Aufgabe (Status `Done`) dem UTC-Tag von `completedAt` zu und kennzeichnet sie wie bisher mit `week-view-done`.
- Gilt auch ohne Deadline: eine erledigte Aufgabe ohne Deadline erscheint an ihrem Erledigt-Tag (bisher: gar nicht).
- Erledigt-Tag ≠ Deadline-Tag: die Aufgabe steht ausschließlich am Erledigt-Tag.

### Offene Aufgaben unverändert (AK3)

- Offene Aufgaben bleiben an ihrem Deadline-Tag, ohne `week-view-done`. Bereits durch die bestehenden #2012-Tests in `WeekView.test.tsx` gesichert — kein neuer Test (Dedup).

### Rückgängig (AK4)

- Wird eine erledigte Aufgabe über den ADR-0024-Weg wieder geöffnet (Erledigt-Toggle „Wieder öffnen“), zerstört der Server den ScoreEntry (`server/src/express/routes/tasks.ts:1146`) → `completedAt` wird `null` → die Aufgabe erscheint nicht mehr am Erledigt-Tag, sondern wieder als offene Aufgabe am Deadline-Tag.

### API-Vertrag (AK5)

- Jeder `serializeTask`-Aufruf (GET /tasks, GET /tasks/:id, PATCH-Antwort) enthält `completedAt`:
  - ISO-Zeitpunkt = `ScoreEntry.zeitpunkt` — bei Erledigen mit nachgetragenem Input `completedAt` dieser Zeitpunkt, sonst der Zeitpunkt des Abhakens;
  - `null`, wenn kein ScoreEntry existiert (offene Aufgabe oder nach „Wieder öffnen“).
- Das Task-Schema in `openapi.yml` wird um das optionale Ausgabefeld `completedAt` erweitert (Implementierungs-PR; Namens-Kollision zum TaskUpdate-INPUT `completedAt` ist bewusst — Input = nachgetragener Zeitpunkt, Output = Erledigt-Zeitpunkt).

## Randbedingungen

- Erledigt außerhalb der angezeigten Woche → Task erscheint in dieser Woche gar nicht (die Woche zeigt, was an ihren Tagen geschafft wurde).
- Erledigt ohne ScoreEntry (theoretischer Edge, keine Bestandsdaten) → Rückfall auf den Deadline-Tag (heutiges Verhalten).
- Keine Migration, keine neue Tabellenspalte.

## Testfälle

| TF  | AK  | Ebene / Datei                                                                        | Inhalt                                                                                                                    |
| --- | --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| TF1 | AK1 | `frontend/src/components/WeekView.test.tsx`                                          | Done ohne Deadline, `completedAt` Mittwoch → Mittwoch-Karte mit `week-view-done`                                          |
| TF2 | AK2 | `frontend/src/components/WeekView.test.tsx`                                          | Deadline Freitag, erledigt Mittwoch → nur Mittwoch-Karte                                                                  |
| —   | AK3 | bestehende #2012-Tests (Dedup)                                                       | offene Aufgabe am Deadline-Tag ohne `week-view-done`                                                                      |
| TF4 | AK4 | `frontend/e2e/issue-1617-week-view.spec.ts` (erweitern)                              | Done → heutige Karte; UI-„Wieder öffnen“ → wieder offene am Deadline-Tag; 375 px                                          |
| TF5 | AK5 | `server/src/express/tasks-completed-at.test.ts` (neu, Muster `tasks-missed.test.ts`) | PATCH Done mit/ohne nachgetragenem `completedAt` ⇒ GET liefert ScoreEntry-Zeitpunkt; offen ⇒ `null`; nach Reopen ⇒ `null` |
