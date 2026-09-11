# MCP: Säulenzuordnung und Gewichtung bei Aufgaben setzen

**Stand:** 2026-09-11

## Ziel

`task_create` und `task_update` (MCP-Werkzeuge, `server/src/mcp/tools.ts`) akzeptieren ein optionales `pillars`-Array, mit dem ein MCP-Client dieselbe Säulenzuordnung setzen kann wie über `POST /tasks` bzw. `PATCH /tasks/:id`.

## Vorbild (unverändert, wird nicht neu gebaut)

- `server/src/logics/pillarContributions.ts`: `validatePillars` (Strukturprüfung: `pillarId` Ganzzahl ≥ 1 ohne Dubletten, `share`/`confidence` in `[0, 100]`, `confidence` optional mit Default 100, Summe der `share` = 100 bei nicht-leerer Liste) und `arePillarsExistent` (DB-Prüfung gegen das Zielkonto).
- `server/src/express/routes/tasks.ts`: Route ist die einzige Entscheidungsinstanz. Bei ungültiger Struktur: 400 „Ungültige Säulen-Beiträge.“; bei unbekannter/fremder `pillarId`: 400 „pillars verweist auf eine nicht existierende Säule.“ `pillars` fehlt im Body → Beiträge unverändert; `pillars` gesetzt (auch `[]`) → vollständig ersetzt.
- `server/src/mcp/tools.ts:63-86` (`callApi`): reicht den Fehlertext der Route unverändert als `"<message> (HTTP <status>)"` durch.

## Ablauf

1. Der MCP-Client ruft `task_create` oder `task_update` mit `pillars: [{ pillarId, share, confidence? }, …]` auf.
2. Das Werkzeug reicht `pillars` unverändert im Request-Body an `POST /tasks` bzw. `PATCH /tasks/:id` durch (`pickTaskFields` muss das Feld übernehmen, statt es zu verwerfen).
3. Die Route validiert und antwortet wie gewohnt; das Werkzeug liefert die Route-Antwort (inkl. serialisiertem `pillars`-Feld) unverändert an den MCP-Client zurück.
4. Ein Validierungsfehler der Route erscheint als `error.message` der JSON-RPC-Antwort (Text der Route + `(HTTP <status>)`); die Aufgabe bleibt unverändert bzw. wird nicht angelegt.
5. Das `inputSchema` beider Werkzeuge deklariert `pillars` als `type: "array"` mit `items`-Objektschema (`pillarId`, `share`, `confidence`) inkl. Beschreibung der 100-%-Regel und der Ersetzungs-Semantik.

## Erwartetes Ergebnis

- `task_create` mit gültigem `pillars` → angelegte Aufgabe enthält genau diese Beiträge (fehlende `confidence` auf 100 aufgefüllt).
- `task_update` mit gültigem `pillars` → ersetzt die bestehende Zuordnung vollständig; `pillars: []` entfernt alle Beiträge; ohne das Feld bleiben vorhandene Beiträge unverändert.
- Ungültige Eingabe (Summe ≠ 100, `confidence`/`share` außerhalb 0–100, unbekannte/fremde `pillarId`) → JSON-RPC-`error` mit dem Routentext + HTTP-Status, keine Änderung an der Aufgabe.
- `tools/list` liefert für `task_create` und `task_update` ein `inputSchema.properties.pillars` vom Typ `array` mit `items`-Objektschema; der eingefrorene Namens-Snapshot (#1353 AK8) bleibt unverändert grün.

## Bausteine

Keine neue Fachlogik — reines Durchreichen im MCP-Werkzeug (`pickTaskFields`) plus Schema-Erweiterung (`McpInputSchema`/`taskFieldProperties`). Die Route bleibt die einzige Entscheidungsinstanz (#1353 AK3/AK6, Kopfkommentar `tools.ts:1-10`).
