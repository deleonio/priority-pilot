# MCP: task_list listet standardmäßig nur offene Aufgaben (#2144)

**Stand:** 2026-10-07

## Ziel

KI-Gespräche über MCP sehen standardmäßig nur offene Aufgaben. Erledigte erscheinen nur auf ausdrücklichen Wunsch (`includeDone`) oder als Suchfallback (`query`).

## Ablauf

1. `task_list` bekommt zwei optionale Argumente: `includeDone` (boolean, Default `false`) und `query` (string).
2. Der Filter sitzt im MCP-Layer auf dem Ergebnis von `GET /tasks`; die REST-Route bleibt unverändert.
3. „Offen“ = jeder Status außer `Done` (auch `In process`).
4. Ohne Argumente: nur offene Aufgaben. Mit `includeDone: true`: offene und erledigte.
5. Mit `query`: offene Aufgaben, deren Titel den Suchtext enthält (ohne Groß-/Kleinschreibung). Gibt es keinen offenen Treffer, kommen die erledigten Aufgaben mit passendem Titel (Fallback); ohne jeden Treffer ein leeres Array. Rückgabe bleibt ein Array, am `status` erkennt der Client den Fallback.
6. Nicht-boolesches `includeDone` oder Nicht-String als `query` wird mit Fehler abgelehnt.
7. `inputSchema.properties` von `task_list` enthält genau `includeDone` und `query`; die Beschreibung nennt Default (nur offene) und Fallback.

## Erwartetes Ergebnis

Katalog bleibt bei gleicher Namenszahl; `task_links`/`next_task` bleiben unverändert.
