# Spec: MCP-Server — eigene Aufgabe löschen (#1396)

Status: rot (Spec-Phase) — Tests in `server/src/mcp/tools.test.ts`.

## Ziel

Der eingefrorene v1-Werkzeugkatalog (#1353, zuletzt erweitert in #1381 auf zwölf Namen) bekommt ein
zusätzliches, schreibendes Werkzeug `task_delete`: Ein MCP-Client mit `readwrite`-Token kann eine
eigene Aufgabe endgültig löschen — ohne zweiten Fachlogik- oder Auth-Pfad, exakt nach dem Muster von
`task_unlink` (`server/src/mcp/tools.ts:295-307`).

## Aufsatzpunkt

- `server/src/mcp/tools.ts:187-322` — Array `mcpTools`; neuer Eintrag (Namens-Snapshot ist
  alphabetisch sortiert).
- `server/src/mcp/tools.ts:102` `requireIntegerId` — Pflicht-Ganzzahl-Prüfung für `id`.
- Gespiegelte Route (unverändert, keine neue Fachlogik): `DELETE /tasks/:id`
  (`server/src/express/routes/tasks.ts:813-823`) — Eigentümer-Filter über `findOwnTask`, fremde
  Aufgabe → 404 `"Task nicht gefunden."`, Erfolg → 204 (leerer Body).

## Vertrag

- `task_delete`: Pflichtargument `id` (Ganzzahl ≥ 1), `write: true`. Ruft `DELETE /tasks/:id` über
  `callApi` auf und liefert dessen (leere) Nutzlast als `null`, wie `task_unlink`.
- Fremde Aufgabe → derselbe JSON-RPC-Fehler wie die gespiegelte Route (Text `"Task nicht
gefunden."` + `HTTP 404` im Fehlertext, Muster `task_links`/`group_members_list`); die Aufgabe
  bleibt für ihren Eigentümer unverändert erhalten.
- Nur-lese-Token (`scope: read`) → Fehler mit dem Scope-Hinweis des Rahmens (`server/src/mcp/
server.ts:100`, Text „schreibt, dieser Token erlaubt nur lesenden Zugriff"); die Aufgabe bleibt
  erhalten.
- Ungültige oder fehlende `id` → Fehlertext `id muss eine Ganzzahl >= 1 sein.`, ohne dass ein
  Loopback-Request abgesetzt wird.
- Der v1-Namens-Snapshot (`tools.test.ts`) wächst von zwölf auf dreizehn Namen; alle zwölf
  Bestandsnamen bleiben unverändert.
- Alle bestehenden Werkzeuge (`task_create`, `task_update`, `task_complete`, `task_link`,
  `task_unlink`, alle List-Werkzeuge) verhalten sich unverändert.

## Akzeptanzkriterien → Tests

| AK  | Test                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------- |
| AK1 | TF1 — `tools/list` enthält `task_delete` mit `inputSchema.required = ['id']`, Katalog wächst auf dreizehn Namen |
| AK2 | TF2 — `readwrite`-Token löscht eigene Aufgabe, `task_list` enthält sie danach nicht mehr                        |
| AK3 | TF3 — fremde Aufgabe löschen → JSON-RPC-Fehler mit `HTTP 404`, Aufgabe bleibt beim Eigentümer erhalten          |
| AK4 | TF4 — Nur-lese-Token → Scope-Fehlertext, Aufgabe bleibt erhalten                                                |
| AK5 | TF5 — fehlende/ungültige `id` → Fehlertext `id muss eine Ganzzahl >= 1 sein.`, nichts gelöscht                  |
| AK6 | TF6 — bestehende Suite `tools.test.ts` bleibt (bis auf die Katalog-Assertion) grün                              |
