# Spec #2210 — Kalender-Oberfläche (ICS verbinden, Termine in der Wochenansicht)

Server-API steht (#2209): `GET/POST /calendar-sources`, `DELETE /calendar-sources/:id`, `GET /calendar-events`.
Dieses Ticket baut die Oberfläche. Quelle der Akzeptanzkriterien: Harness-Kommentar, KI-UX-Block.

## Vertrag Frontend

- `api.listCalendarSources()` -> `{id, name}[]`, `api.createCalendarSource({url, name?})` -> `{id, name}`,
  `api.deleteCalendarSource({id})`, `api.listCalendarEvents()` -> `{sourceId, start, end, title, allDay}[]`
  (`start`/`end` ISO-UTC-Strings).
- `CalendarSourcesSection` (Einstellungen, Muster `PlaceFavoritesSection`): Liste der Kalendernamen, Formular
  „Kalender-Adresse (ICS)" + optional „Name", Knopf „Verbinden"; die Adresse wird nie angezeigt.
- `WeekView` bekommt die optionale Prop `calendarEvents` (Default leer; bestehende Aufrufer unverändert).

## Ablauf

| Schritt                 | Erwartung                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 Verbinden           | `createCalendarSource({url, name})` mit getrimmter Adresse; Kalender erscheint in der Liste, Adresse steht nirgends im DOM                        |
| AK2 400                 | Server-Meldung als Alert, Liste unverändert                                                                                                       |
| AK2 403 `plan_required` | Paket-Hinweis (Meldung aus `toApiError`) als Alert, Liste unverändert                                                                             |
| AK3 Termine             | Tageskarte des **lokalen** Starttags, `HH:MM–HH:MM`; ganztägig mit Text „ganztägig"; mehrtägig nur am Starttag; Zuordnung nicht über UTC-Tag      |
| AK4 Entfernen           | Eintrag verschwindet aus der Liste; die Termine der Quelle verschwinden aus der Wochenansicht (App lädt Termine neu bzw. filtert nach `sourceId`) |
| AK5 375 px              | kein horizontales Scrollen (e2e, siehe PR „Offene Fragen")                                                                                        |
