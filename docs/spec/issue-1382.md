# Spec: MCP-Server — Aufgaben für andere Gruppenmitglieder anlegen (#1382)

Status: rot (Spec-Phase) — Tests in `server/src/mcp/tools.test.ts`.

## Ziel

`task_create` bekommt ein optionales Argument `userId`, mit dem der Aufrufer eine Aufgabe direkt
für ein Mitglied einer gemeinsamen Gruppe anlegen kann — ohne eigene Fachlogik im Werkzeug: der
Wert reist unverändert an `POST /tasks` weiter, wo `resolveRecipientId`
(`server/src/express/routes/tasks.ts:219`, #1213/#1222/#1252) die Gruppenmitgliedschaft bereits
prüft. `task_update` bleibt davon unberührt, weil es dieselbe Feld-Whitelist (`pickTaskFields`)
benutzt wie `task_create`.

## Aufsatzpunkt

- `server/src/mcp/tools.ts:275-284` — Eintrag `task_create` im Katalog `mcpTools`; `userId` als
  eigene Property NUR in `task_create.inputSchema.properties`, nicht in `taskFieldProperties`
  (`tools.ts:219`, geteilt mit `task_update`) und nicht in `pickTaskFields` (`tools.ts:147`).
- `server/src/mcp/tools.ts:556` `group_invitation_create` — Muster für eine `userId`-Property
  (`{ type: 'integer', description: '... (from ...)' }`).
- `server/src/express/routes/tasks.ts:219` `resolveRecipientId` — validiert bereits: fehlendes
  `userId` → Owner (`recipientId: null`), `userId` = Aufrufer selbst → Owner, `userId` keine
  Ganzzahl → 400, `userId` ohne gemeinsame Gruppe → 403.

## Vertrag

- `task_create` mit `userId` eines Mitglieds einer gemeinsamen Gruppe legt die Aufgabe mit diesem
  Nutzer als Empfänger an (DTO-Feld `userId` zeigt den Empfänger, nicht den Token-Owner,
  `tasks.ts:172`).
- `task_create` mit `userId` eines Nutzers ohne gemeinsame Gruppe liefert einen Werkzeugfehler
  (403 der Route, Text `Der Empfänger teilt keine Gruppe mit dir.` + `HTTP 403`), es entsteht keine
  Aufgabe.
- `task_create` ohne `userId` legt die Aufgabe wie bisher für den Token-Owner an (unverändertes
  Verhalten, `userId: null` im DTO).
- `tools/list` zeigt im `inputSchema` von `task_create` die Property `userId` mit `type: 'integer'`,
  nicht in `required` (nur `title` bleibt Pflichtfeld); die Werkzeugbeschreibung nennt das Anlegen
  für Gruppenmitglieder.
- `task_update` bleibt unverändert: sein `inputSchema` enthält kein `userId`, und ein
  mitgegebenes `userId` wird nicht an `PATCH /tasks/:id` durchgereicht (Empfänger bleibt gleich).
- Werkzeuganzahl im v1-Katalog bleibt unverändert (kein neues Werkzeug, nur ein neues Feld).

## Akzeptanzkriterien → Tests

- AK1 → TF1 (`task_create` mit `userId` eines Gruppenmitglieds legt die Aufgabe für dieses
  Mitglied an).
- AK2 → TF2 (`task_create` mit `userId` ohne gemeinsame Gruppe → 403-Werkzeugfehler, keine Aufgabe
  entsteht).
- AK3 → TF3 (`task_create` ohne `userId` unverändert für den Token-Owner).
- AK4 → TF4 (`tools/list`: `task_create.inputSchema.properties.userId.type === 'integer'`,
  `required` bleibt `['title']`).
- AK5 → TF5 (`tools/list`: `task_update.inputSchema` ohne `userId`; `task_update` mit `userId`
  ändert den Empfänger nicht).

Rot, bis `task_create` in `server/src/mcp/tools.ts` das `userId`-Argument entgegennimmt und
durchreicht. KEIN Produktivcode in dieser Phase.
