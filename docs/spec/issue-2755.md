# Spec #2755 — Ersteller-Name in Antworten auf Schreibzugriffe

## Ziel

Jede Antwort auf einen Schreibzugriff auf eine Aufgabe trägt dieselben `createdByName`- und
`forUserName`-Werte, die auch die Lese-Endpunkte (GET `/tasks/:id` bzw. GET `/tasks`) für
dieselbe Aufgabe liefern. Der Ersteller-Name darf auf Schreibwegen nicht mehr fehlen.

## Ausgangslage (Ursache)

Die Schreib-Endpunkte serialisieren per `serializeTask(withPillars)` **ohne** Namens-Kontext —
`createdByName: context.names?.get(createdBy) ?? null` liefert dadurch immer `null`, obwohl
`createdById` gesetzt ist (`server/src/express/routes/tasks.ts:215`):

- PATCH `/tasks/:id` (task_update **und** task_complete) — `tasks.ts:1221`
- POST `/tasks/:id/archive` — `tasks.ts:1249`
- POST `/tasks/:id/snooze` — `tasks.ts:1271`
- POST `/tasks/:id/unarchive` — `tasks.ts:1292`
- POST `/tasks/:id/dependencies` (task_link, antwortet 201) — `tasks.ts:1379`

Die Lese-Pfade (POST create `tasks.ts:863`, GET `/:id` `tasks.ts:881`, Liste `tasks.ts:633`)
nutzen bereits `serializeTasksFor(req, [task])` und liefern die Namen korrekt — dieses Muster
gilt es auf die Schreib-Endpunkte zu übertragen. Die MCP-Werkzeuge (task_update, task_complete,
task_link) laufen über dieselben REST-Routen und sind automatisch mitgeprüft.

## Vertrag (AK1–AK4)

Voraussetzung: Alice hat eine Aufgabe für Bob angelegt (Gruppen-Übergabe, Muster #1213 —
`createdById` = Alice, Eigentümer = Bob); Bob ist als Eigentümer schreibberechtigt.

- **AK1 (task_update):** Nach PATCH `/tasks/:id` mit Feldänderung (z. B. `title`) enthält die
  200-Antwort `createdByName` mit dem Anzeigenamen der Erstellerin — identisch zum Wert aus
  GET `/tasks/:id` für dieselbe Aufgabe. `forUserName` ebenfalls identisch zum Lese-Endpunkt.
- **AK2 (task_link):** Nach POST `/tasks/:id/dependencies` enthält die **201**-Antwort
  `createdByName` mit dem Anzeigenamen der Erstellerin (Statuscode bleibt 201).
- **AK3 (task_complete):** Nach PATCH mit `status: 'Done'` gilt AK1 ebenfalls (Statuswechsel
  selbst bleibt wie bisher, inkl. `vergebenePunkte`/`accessMailThrottled`-Spread).
- **AK4 (Spiegel zur Liste):** `forUserName` (Empfängername) ist in denselben Schreib-Antworten
  konsistent mit dem Wert aus der Aufgabenliste (GET `/tasks`); archive/snooze/unarchive
  verhalten sich wie die übrigen Schreib-Endpunkte.

## Randbedingungen

- Statuscodes und DTO-Form bleiben unverändert (PATCH 200, dependencies 201, archive/snooze/
  unarchive 200); nur die bislang `null`-Felder werden korrekt befüllt.
- Kein neuer Cache-Mechanismus — ein Sammel-Query je Schreibzugriff (wie bei `serializeTasksFor`)
  ist akzeptabel.
- Empfänger-Sicht bleibt unangetastet: `forUserId`/`forUserName` erscheinen weiterhin nur aus
  Ersteller-Sicht (Sichtbarkeitslogik `handedOff` in `serializeTask`).

## Tests

- `server/src/express/tasks-created-by.test.ts`, Describe-Block „#2755“ (node:test, API-Ebene;
  Setup „Alice Erstellerin“/„Bob Empfänger“ vorhanden): je Schreibaufruf Assert auf
  `createdByName`/`forUserName` gegen das Lese-Orakel (GET `/tasks/:id` bzw. GET `/tasks`)
  derselben Aufgabe.

## Offene Fragen

- —
