# Dashboard: „Kurz zurückstellen" an der Karte „Nächste Aufgabe"

**Stand:** 2026-10-05

Ein Uhr-Button an der Karte „Nächste Aufgabe" blendet die vorgeschlagene Aufgabe für 3 Stunden aus
dem Vorschlag aus. Das ist kein Verschieben: `postponeCount` (#1964) und die Bewertung bleiben
unverändert.

## Vertrag Server

- Neue nullable Spalte `Task.snoozedUntil`, idempotent nachgezogen durch `migrateTaskSnoozeColumn`
  (Muster `migrateTaskMissedColumns`; frische DB: No-op).
- `POST /tasks/:id/snooze` (eigener Endpunkt, kein PUT): setzt `snoozedUntil = jetzt + ZURUECKSTELLEN_STUNDEN`
  (Konstante, 3). Der Client sendet keine Zeit. Antwort 2xx; fremde oder unbekannte Aufgabe → 404, nichts
  ändert sich.
- `ladeFreieTasks` (`logics/find.ts`) lässt Aufgaben mit `snoozedUntil > now` aus. Gilt damit für `GET /next`,
  `GET /suggestions` und MCP `next_task`. Abgelaufene Frist: Aufgabe erscheint wieder, Score unverändert.
- Gibt es keine weitere freie Aufgabe, liefert `GET /next` `null`.

## Vertrag Frontend

- `Dashboard`: neue optionale Prop `onSnoozeTask?: (task: Task) => void`. Bei `nextTask` und gesetzter Prop
  rendert die Aktionszeile (`.dashboard-next-task-actions`) nach „Bearbeiten" einen Icon-only-`KolButton`
  (`_label="Kurz zurückstellen"`, `_hideLabel`, Icon `fa-regular fa-clock`). Klick ruft `onSnoozeTask(nextTask)`.
- `App.tsx` verdrahtet den Handler: API-Aufruf, danach `/next` und `/suggestions` neu laden; die Karte zeigt
  den nächsten Kandidaten bzw. den Leerzustand.
- Label als i18n-Key in allen 10 Sprachen (Gleichstand prüft `locales.test.ts`, kein eigener Test nötig).

## Layout (mobile-first, 375 px)

Touch-Target ≥ 44×44 px, per Tastatur erreich- und auslösbar, Aktionszeile bleibt einzeilig ohne Überlauf.

## Testabdeckung

| AK                 | Test                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| AK1–AK5            | `server/src/express/task-snooze.test.ts`                                |
| AK6                | `frontend/src/components/Dashboard.test.tsx` (Button, Klick, ohne Prop) |
| AK1, AK4, AK6, AK7 | `frontend/e2e/issue-2244-snooze-next-task.spec.ts`                      |
| AK8                | `server/src/logics/migrate.test.ts` (`migrateTaskSnoozeColumn`)         |
