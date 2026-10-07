# MCP: Anpinnen über task_update

**Stand:** 2026-10-07

## Ziel

Das MCP-Werkzeug `task_update` kann das von der HTTP-Route bereits unterstützte Boolean-Feld `pinned` setzen (Anpinnen und Lösen).

## Ablauf

1. `task_update.inputSchema.properties` (server/src/mcp/tools.ts) bekommt `pinned` vom Typ `boolean`, nicht in `required`. `task_create` und `taskFieldProperties` bleiben unberührt.
2. `pickTaskFields` nimmt `pinned` in die Allowlist auf, sonst würde das Feld still aus dem PATCH-Body gefiltert.
3. Die Route (`PATCH /tasks/:id`) bleibt einziger Prüfpunkt: nicht-boolescher Wert → 400 `pinned muss ein Boolean sein.`; `pinnedAt` leitet der Server ab, es steht nicht im Schema.

## Erwartetes Ergebnis

- `tools/list`: `task_update` deklariert `pinned` als optionales Boolean-Feld.
- `pinned: true` → Antwort und `task_list` zeigen `pinned: true` mit gesetztem `pinnedAt`.
- `pinned: false` → `pinned: false`, `pinnedAt: null`.
- Update ohne `pinned` lässt einen gesetzten Pin unverändert.
- `pinned: "yes"` → Fehler (HTTP 400), Pin-Zustand unverändert.
- Katalog-Namens-Snapshot (33 Namen) bleibt gleich.
