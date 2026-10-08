# Spec: #2427 — Verpasst-Filter: Deadline gilt einschließlich des Fälligkeitstags

## Ziel

`GET /tasks?missed=1` listet eine offene Aufgabe erst ab dem **Folgetag** des Fälligkeitstags — nicht schon am Fälligkeitstag selbst. Verpasst-Ansicht und Dashboard-Badge folgen damit derselben UTC-Kalendertag-Semantik.

## Voraussetzung

- Deadlines werden als Datum mit 00:00 UTC gespeichert.
- Eine „verpasste" Aufgabe ist offen (`status !== 'Done'`), nicht archiviert, ohne Auto-Löschen-Häkchen (Bestand #1964, unverändert).

## Erwartetes Ergebnis

- **AK1:** Deadline = heutiger UTC-Kalendertag → Aufgabe erscheint **nicht** in `?missed=1`, unabhängig von der Uhrzeit des Abrufs. Der Filter vergleicht gegen den **Beginn des heutigen UTC-Tags** (Muster `syncWindow`, `server/src/logics/calendar-ics.ts`), nicht gegen die aktuelle Uhrzeit.
- **AK2:** Deadline = gestriger UTC-Kalendertag oder älter → Aufgabe erscheint in `?missed=1`.
- **AK3:** Verpasst-Ansicht und Dashboard-Badge widersprechen sich an keinem Tag. Kein Frontend-Eingriff: `formatRelativeDeadline` (`frontend/src/lib/task.ts`) zählt 0 Tage als „heute fällig", nie als überfällig — AK3 ist durch AK1/AK2 gegeben und bekommt bewusst keinen eigenen Test.

## Ausdrücklich nicht Teil des Tickets

- Auto-Delete-Cron (`runDeadlineAutoDelete`) und `GET /scores/missed` behalten ihre bisherige Semantik.

## Tests

- `server/src/express/tasks-missed.test.ts` — AK1 (rot bis zur Umsetzung) und AK2 (Grenz-Spiegel, vor der Umsetzung bereits grün).
