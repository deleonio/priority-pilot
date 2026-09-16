# Spec: MCP-Server — Säulen anlegen, ändern, löschen und gewichten (#1413)

Status: rot (Spec-Phase) — Tests in `server/src/mcp/tools.test.ts` und
`server/src/express/mcp-handshake.test.ts`.

## Ziel

Der eingefrorene v1-Werkzeugkatalog (#1353, zuletzt erweitert in #1423 auf vierzehn Namen) bekommt
vier zusätzliche, schreibende Werkzeuge, die die vorhandenen Säulen-Routen spiegeln — ohne zweiten
Fachlogik- oder Auth-Pfad, exakt nach dem Muster von `task_create`/`task_update`/`task_delete`
(`server/src/mcp/tools.ts:252-302`):

- `pillar_create` → `POST /pillars`
- `pillar_update` → `PATCH /pillars/:id`
- `pillar_delete` → `DELETE /pillars/:id`
- `pillar_weights_set` → `PUT /pillars/weights`

## Aufsatzpunkt

- `server/src/mcp/tools.ts:242-431` — Array `mcpTools`; vier neue Einträge (Namens-Snapshot ist
  alphabetisch sortiert, direkt vor bzw. nach `pillar_list`).
- `server/src/mcp/tools.ts:115-121` `requireIntegerId` — Pflicht-Ganzzahl-Prüfung für `id`.
- Gespiegelte Routen (unverändert, keine neue Fachlogik):
  - `POST /pillars` (`server/src/express/routes/pillars.ts:228`) — 201 + Säule, Name-Kollision
    → 409 `"Eine Säule mit diesem Namen existiert bereits."`.
  - `PATCH /pillars/:id` (`server/src/express/routes/pillars.ts:267`) — 200 + Säule, fremde/
    unbekannte ID → 404 `"Säule nicht gefunden."`, Name-Kollision → 409.
  - `DELETE /pillars/:id` (`server/src/express/routes/pillars.ts:318`) — 204, fremde/unbekannte
    ID → 404 `"Säule nicht gefunden."`, renormiert Task-/Serien-Anteile und Restgewichte.
  - `PUT /pillars/weights` (`server/src/express/routes/pillars.ts:170`) — 200 + alle Säulen,
    unvollständige/fremde IDs oder Summe ≠ 100 → 400 mit dem Routen-Fehlertext.

## Vertrag

- `pillar_create`: Pflichtargument `name` (string), optional `description` (string), `write: true`.
  Ruft `POST /pillars` über `callApi` auf und liefert die neue Säule (inkl. `weight: 0`) zurück.
- `pillar_update`: Pflichtargument `id` (Ganzzahl ≥ 1), optional `name`/`description`, `write: true`.
  Ruft `PATCH /pillars/:id` auf, liefert die aktualisierte Säule zurück.
- `pillar_delete`: Pflichtargument `id` (Ganzzahl ≥ 1), `write: true`. Ruft `DELETE /pillars/:id`
  auf und liefert `null` (leerer 204-Body), wie `task_delete`.
- `pillar_weights_set`: Pflichtargument `weights` (Array aus `{ id, weight }`), `write: true`. Ruft
  `PUT /pillars/weights` auf und liefert die aktualisierten Säulen zurück.
- Fremde/unbekannte Säulen-ID bei `pillar_update`/`pillar_delete` → JSON-RPC-Fehler mit Text
  `"Säule nicht gefunden."` + `HTTP 404`, Datenbestand bleibt unverändert.
- Doppelter Name bei `pillar_create`/`pillar_update` → JSON-RPC-Fehler mit Text `"Eine Säule mit
diesem Namen existiert bereits."` + `HTTP 409`.
- Unvollständige Gewichtsliste oder Summe ≠ 100 bei `pillar_weights_set` → JSON-RPC-Fehler mit dem
  Routen-Fehlertext + `HTTP 400`, vorher gespeicherte Gewichte bleiben unverändert.
- Nur-lese-Token (`scope: read`) → für alle vier Werkzeuge derselbe Scope-Fehlertext wie bei
  `task_delete` (`server/src/mcp/server.ts:96`, Hinweis auf „Lesen und Schreiben"), der Datenbestand
  bleibt unverändert (`pillar_list` liefert denselben Stand).
- Der v1-Namens-Snapshot (`tools.test.ts`, `mcp-handshake.test.ts`) wächst von vierzehn auf achtzehn
  Namen; alle vierzehn Bestandsnamen bleiben unverändert.

## Akzeptanzkriterien → Tests

| AK  | Test                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | TF1 (`mcp-handshake.test.ts`) — `tools/list` enthält alle 18 Namen (14 bestehende + 4 neue)                                                  |
| AK2 | TF2 (`tools.test.ts`) — `pillar_create` legt eine Säule an, `pillar_list` zeigt sie danach mit `weight: 0`                                   |
| AK3 | TF3 (`tools.test.ts`) — `pillar_update` ändert Name/Beschreibung einer eigenen Säule                                                         |
| AK4 | TF4 (`tools.test.ts`) — `pillar_delete` entfernt die Säule aus `pillar_list`, Anteile der Task summieren sich wieder auf 100                 |
| AK5 | TF5 (`tools.test.ts`) — `pillar_weights_set` setzt alle Gewichte, `pillar_list` zeigt danach genau diese Werte                               |
| AK6 | TF6 (`tools.test.ts`) — unvollständige Gewichtsliste/Summe ≠ 100 → Routen-Fehlertext + `HTTP 400`, Gewichte unverändert                      |
| AK7 | TF7 (`tools.test.ts`) — fremde/unbekannte ID → `"Säule nicht gefunden."` + `HTTP 404`; doppelter Name → `"…existiert bereits."` + `HTTP 409` |
| AK8 | TF8 (`tools.test.ts`) — Nur-lese-Token scheitert an allen vier Werkzeugen mit dem Scope-Fehlertext, `pillar_list` bleibt unverändert         |
