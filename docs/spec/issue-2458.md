# MCP: Checklistenpunkte einer Aufgabe über task_create/task_update verwalten

**Stand:** 2026-10-10

## Ziel

Die MCP-Werkzeuge `task_create` und `task_update` können das bereits von der HTTP-Route und dem
Modell unterstützte Feld `checklist` setzen — dieselben Punkte, dieselben Regeln wie in der App
(#531-Vertrag), kein zweiter Fachlogik-Pfad.

## Ablauf

1. `taskFieldProperties` (server/src/mcp/tools.ts) bekommt einen Eintrag `checklist` vom Typ
   `array` mit Objektschema `{ id, title, completed }`; die Beschreibung dokumentiert, dass jeder
   Eintrag eine clientseitig erzeugte UUID-v4-`id` braucht und dass `task_update` die Liste
   **vollständig ersetzt** (nicht additiv).
2. `pickTaskFields` nimmt `checklist` in die Allowlist auf — ohne diesen Eintrag würde das Feld
   trotz Schema-Deklaration im POST/PATCH-Body still herausgefiltert.
3. Beide Werkzeuge reichen das Feld unverändert an die bestehende Route durch; deren Validierung
   (`validateChecklist`, server/src/express/routes/tasks.ts:77-110) bleibt der einzige Prüfpunkt:
   höchstens 20 Einträge, UUID-`id`, `title` 1–255 Zeichen, `completed` Boolean (Default `false`).
4. `task_create` weist die Kombination `series` **und** `checklist` mit einem Werkzeugfehler ab
   (`POST /series` kennt kein `checklist` — stiller Verlust wäre ein Datenverlust-Täuschung);
   es entsteht weder Serie noch Aufgabe.
5. `task_list` gibt die Checkliste bereits über den GET-/tasks-Serializer mit (bestehendes
   Verhalten, als Spiegel gesichert): je Aufgabe `checklist` mit `id`, `title`, `completed`.

## Erwartetes Ergebnis

- `tools/list`: beide Werkzeuge deklarieren `checklist` als optionales Array-Feld (nicht in
  `required`) mit Objektschema; Beschreibung nennt UUID-`id` und Voll-Ersatz.
- `task_create` mit gültiger `checklist` → Antwort enthält die übernommenen Punkte; `task_list`
  zeigt sie.
- `task_update` mit `checklist` ersetzt die Liste vollständig (Text ändern, Punkt entfernen,
  `completed` setzen und zurücksetzen); ohne das Feld bleibt sie unverändert.
- Ungültige `checklist` → Werkzeugfehler mit der Routen-Fehlermeldung (HTTP 400); nichts entsteht
  oder ändert sich.
- `series` + `checklist` → Werkzeugfehler, keine Serie, keine Aufgabe.
- Schreibaufruf mit `checklist` auf fremde Aufgabe → Fehler (404, ownerScope), fremde Checkliste
  unverändert.

## Bausteine

Serverseitig bereits vorhanden: `validateChecklist` + Anwendung über `validateTaskFields`
(tasks.ts:496-502), Serializer-Feld (tasks.ts:186), Modell-Typ `ChecklistItem`
(models/task.ts:20). Diese Spec ändert ausschließlich den MCP-Werkzeugkatalog
(server/src/mcp/tools.ts), keine Route/kein OpenAPI.
