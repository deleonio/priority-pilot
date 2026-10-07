# Spec #1990 — Freie Zeit: Aufgaben für Kalender-Lücken vorschlagen

Grundlage: PO-Entscheidung 2026-10-07 (Harness-Kommentar). Kalenderdaten kommen aus #2209 (`CalendarEvent`).

## Vertrag (Reine Logik) — `server/src/logics/freeSlots.ts`

- `effortToMinutes(effort: number): number` — linear `15 + (effort - 0.1) / 0.9 * 105`, gerundet; 0.1 → 15, 1.0 → 120.
- `findFreeSlots({ events, now, minMinutes, endHour = 22 })` → `{ start: Date; end: Date }[]`, aufsteigend.
  Fenster: `now` bis `endHour`:00 (lokale Serverzeit, Tag von `now`). Ganztägige Termine blockieren nicht,
  überlappende/anliegende Termine werden zusammengefasst, Lücken kürzer als `minMinutes` entfallen.
- `fitTasksToSlots(slots, tasks, maxPerSlot = 3)` — `tasks` kommen bereits in `find.ts`-Score-Reihenfolge
  (`{ id, title, estimatedEffort }`); je Lücke nur Aufgaben mit `effortToMinutes(effort) ≤ Lückenlänge`, Reihenfolge bleibt;
  eine Aufgabe erscheint nur in der ersten passenden Lücke; Lücken ohne Aufgabe entfallen.

## API

- `GET /free-slot-config` / `PUT /free-slot-config` — `{ freeSlotMinMinutes }` pro Nutzer, Default 30, Grenzen 10–240 (ganzzahlig), sonst 400.
- `GET /tasks/free-slots` — `[{ start, end, tasks: [{ id, title }] }]`; ohne Kalenderquelle oder bei Fehler 200 `[]`.

## UI

Dashboard-Karte „Freie Zeit" (`FreeTimeCard`, `data-testid="free-time-card"`), unter „Nächste Aufgabe", vor „In der Nähe".
Eintrag „17:30–18:00" + Aufgabentitel; leere Liste → nichts gerendert. Einstellung „Mindestdauer freier Lücken" im Kalender-Block
(nur bei verbundenem Kalender). Bei 375 px kein Überlauf (Bounding-Box), Touch-Ziele ≥ 44 px.
