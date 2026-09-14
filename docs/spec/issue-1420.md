# MCP: autoDeleteAfterDeadline über task_create/task_update setzbar

**Stand:** 2026-09-13

## Ziel

Die MCP-Werkzeuge `task_create` und `task_update` können das bereits von der HTTP-Route unterstützte Boolean-Feld `autoDeleteAfterDeadline` setzen, wie schon `pillars` (#1379).

## Ablauf

1. `taskFieldProperties` (server/src/mcp/tools.ts) bekommt einen zusätzlichen Eintrag `autoDeleteAfterDeadline` vom Typ `boolean`; die Beschreibung nennt eine gesetzte `deadline` als Voraussetzung, ohne die der Cron-Job (`autoDeleteAfterDeadline.ts`) nicht greift.
2. `pickTaskFields` nimmt `autoDeleteAfterDeadline` in die Allowlist auf — ohne diesen Eintrag würde das Feld trotz Schema-Deklaration beim POST/PATCH-Body still herausgefiltert.
3. Beide Werkzeuge reichen den Wert unverändert an die bestehende Route (`POST /tasks`, `PATCH /tasks/:id`) durch; deren Validierung (`tasks.ts:347-352`, Boolean-Check) bleibt der einzige Prüfpunkt — kein zweiter Validierungspfad im MCP-Layer.
4. `task_update` ohne das Feld lässt einen zuvor gesetzten Wert unverändert (Allowlist übernimmt nur gesetzte Felder — bestehendes Verhalten, unverändert für dieses Feld).

## Erwartetes Ergebnis

- `tools/list`: `task_create` und `task_update` deklarieren `autoDeleteAfterDeadline` als optionales Boolean-Feld (nicht in `required`), Beschreibung erwähnt `deadline`.
- `task_create` mit `autoDeleteAfterDeadline: true` und gesetzter `deadline` → Antwort enthält `autoDeleteAfterDeadline: true`.
- `task_update` kann den Wert nachträglich auf `true` und wieder auf `false` setzen; ein Update ohne das Feld ändert einen bestehenden Wert nicht.
- Ein nicht-boolescher Wert führt zu einem JSON-RPC-Fehler mit der Routen-Fehlermeldung (`autoDeleteAfterDeadline muss ein Boolean sein.`, HTTP 400); es wird nichts angelegt/geändert.
- Der eingefrorene Katalog-Namens-Snapshot (13 Namen) bleibt unverändert grün.

## Bausteine

Serverseitig bereits vorhanden: Route-Validierung `server/src/express/routes/tasks.ts:347-352`, Response-Feld `:145`, OpenAPI-Schema. Diese Spec ändert ausschließlich den MCP-Werkzeugkatalog (`server/src/mcp/tools.ts`), keine Route/kein OpenAPI.
