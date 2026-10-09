# MCP: Checklistenpunkte einzeln und mit wenigen Aufrufen pflegen (task_checklist_*)

**Stand:** 2026-10-10

## Ziel

Checklistenpunkte sind über MCP bisher nur als Ganzes pflegbar: `task_create`/`task_update`
verlangen die komplette Liste mit clientseitig erzeugten UUIDs (#2458). Ein LLM-Client braucht
dafür mehrere Aufrufe (task_list → Liste ändern → task_update). Neu sind drei Schreibwerkzeuge,
die genau einen Punkt per Titel ansprechen, plus eine String-Kurzschrift bei `task_create`.
Die Fachlogik bleibt in der Route: kein zweiter Validierungspfad, keine neue HTTP-Route.

## Ablauf

1. `task_create` (server/src/mcp/tools.ts) akzeptiert `checklist` zusätzlich als Liste reiner
   Strings; das Werkzeug erzeugt je Eintrag eine UUID (`crypto.randomUUID()`) und POSTet die
   Objektform `{ id, title, completed: false }`. Die #2458-Objektform mit eigener `id` bleibt
   gültig; die Voll-Ersatz-Semantik von `task_create`/`task_update` ändert sich nicht. Die
   Kombination `series` + `checklist` bleibt abgewiesen (Bestand, #2458 AK4).
2. Drei neue Schreibwerkzeuge (`write: true`) im Katalog, Punkt-Auswahl per **exaktem Titel**
   (Vergleich gegen die gespeicherten, trim-normalisierten Titel — die Route trimmt beim
   Speichern):
   - `task_checklist_add(taskId, title)` hängt einen Punkt an (`completed: false`).
   - `task_checklist_update(taskId, item, title?, completed?)` benennt um und/oder setzt
     `completed` — mindestens eines von beidem muss übergeben werden.
   - `task_checklist_remove(taskId, item)` löscht den Punkt.
     Umsetzung als Read-Modify-Write im Werkzeug: `GET /tasks/:id` (liefert die aktuelle
     Checkliste), nur den benannten Punkt ändern, `PATCH /tasks/:id` mit der Gesamtliste.
     Owner-Filter, Max-20-Grenze, Titel-Validierung (1–255 Zeichen) laufen unverändert über die
     Route — `validateChecklist` (server/src/express/routes/tasks.ts:85-108) bleibt der einzige
     Prüfpunkt.
3. Antworten knapp: `add`/`update` liefern nur den betroffenen Punkt `{ id, title, completed }`;
   `remove` liefert eine kurze Bestätigung — in keinem Fall den Aufgabenrumpf (kein
   `description`, kein `priority`, keine Punkte-Liste).
4. Titel-Fehler des Werkzeugs (vor dem PATCH, Checkliste bleibt unverändert): unbekannter Titel
   → Fehlermeldung, die den Titel als Grund nennt; mehrdeutiger Titel (mehrfach vorhanden) →
   Fehlermeldung, die die Mehrdeutigkeit mit Trefferzahl nennt.
5. Rechtestufen unverändert: ein Nur-lese-Token wird von allen drei Werkzeugen schon im
   JSON-RPC-Rahmen abgewiesen (`write: true`, Scope-Hinweis mit Ausweg), ein Schreibaufruf auf
   eine fremde Aufgabe scheitert am Owner-Filter der Route (404) ohne Wirkung.
6. Der Katalog wächst um drei Namen (35 → 38); der Hard-Count im Handshake-Test
   (#1413, server/src/express/mcp-handshake.test.ts) wird entsprechend angehoben.

## Erwartetes Ergebnis

- `task_create` mit `checklist: ["Zahnbürste", "Waschbeutel", "Drachen"]` (reine Strings) legt
  die Aufgabe mit allen drei Punkten an; `task_list` zeigt sie in Reihenfolge mit
  serverseitig erzeugten UUID-v4-Ids und `completed: false`.
- `task_checklist_update` mit `completed: true` bzw. `false` ändert genau den per Titel
  benannten Punkt mit einem Aufruf — ohne vorherigen `task_list`-Aufruf und ohne die übrigen
  Punkte zu übermitteln; diese behalten Id, Titel und Zustand.
- `task_checklist_add` fügt an, `task_checklist_update` benennt um, `task_checklist_remove`
  löscht — je ein Aufruf, alle übrigen Punkte unverändert; der 21. Punkt liefert den
  Routen-Fehler („höchstens 20", HTTP 400), die Liste bleibt unverändert.
- Unbekannter oder mehrdeutiger Titel → verständliche Werkzeug-Fehlermeldung (Grund bzw.
  Mehrdeutigkeit); die Checkliste bleibt unverändert (per `task_list` prüfbar).
- Antworten von `add`/`update` enthalten genau die Schlüssel `id`/`title`/`completed`;
  `remove` bestätigt kurz — kein `description`, kein `priority`, keine Checkliste im Antwort-
  Körper.
- Nur-lese-Token → JSON-RPC-Fehler mit „read access only" und Hinweis auf Lesen und Schreiben;
  fremde Aufgabe → Fehler („nicht gefunden"), fremde Checkliste unverändert.
- tools/list führt die drei neuen Namen; der Katalog-Count im Handshake-Test ist 38.
