# Spec #2209 — Kalender per ICS-Adresse lesend abrufen und speichern

Server-only. Teil von #1973. Tests: `server/src/logics/calendar-ics.test.ts`, `server/src/express/calendar.test.ts`.

## Vertrag

**Logik** `server/src/logics/calendar-ics.ts`

- `parseIcsEvents(ics: string, now: Date): ParsedEvent[]` — liefert nur Termine mit Start im Fenster
  `[heute 00:00 UTC, now + 14 Tage]`; je Termin nur `{ start: Date, end: Date, title: string, allDay: boolean }`.
  `DTSTART;VALUE=DATE` = ganztägig.
- `fetchIcs(url: string, fetchImpl?: typeof fetch): Promise<string>` — sendet ausschließlich GET (AK6).
- `CALENDAR_SYNC_INTERVAL_MS = 30 * 60 * 1000` — Intervall des Scheduler-Jobs (AK6).

**API** (hinter `requireAuth`, je Nutzer isoliert)

| Aufruf                         | Verhalten                                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /calendar-sources`       | Body `{ url, name? }`; legt die Quelle an, ruft die ICS-Adresse sofort ab und speichert die Termine. 201 `{ id, name }` — die Adresse steht nie in der Antwort (geheim). Free: zweite Quelle → 403 `plan_required`; Plus/Pro: bis zum Limit (5). |
| `GET /calendar-sources`        | Eigene Quellen `[{ id, name }]` (ohne Adresse).                                                                                                                                                                                                  |
| `DELETE /calendar-sources/:id` | 204; löscht die Quelle und ihre Termine; fremde Quelle → 404.                                                                                                                                                                                    |
| `GET /calendar-events`         | Eigene Termine `[{ sourceId, start, end, title, allDay }]`, `start`/`end` ISO-Strings.                                                                                                                                                           |

Erneuter Abruf ersetzt den Bestand der Quelle (keine Dubletten, AK2).
