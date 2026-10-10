# Checklisten-Done-Guard: Erledigen nur mit abgehakter Checkliste

**Stand:** 2026-10-10

## Ziel

Eine Aufgabe lässt sich nicht mehr auf „Done" setzen, solange mindestens ein Checkpunkt ihrer
Checkliste offen ist — weder über REST (`PATCH /tasks/:id`) noch über die MCP-Werkzeuge
(`task_complete`, `task_update`), die dieselbe Route spiegeln. Eine Ablehnung antwortet 409 mit
einer klaren deutschen Meldung, die auch MCP-Clients verstehen (kein REST-Jargon).

## Guard-Semantik

- Geprüft wird der **echte Übergang** auf Done: Task ist aktuell nicht „Done" **und** der Request
  fragt `status: 'Done'` an. Bereits erledigte Aufgaben bleiben frei editierbar (#1821
  Done-Edit-Guard; Pin-/Edit-PATCHs senden `status` mit).
- Geprüfte Liste ist die, die nach dem Request gilt: die mitgesendete `checklist`, sonst die
  gespeicherte. Dadurch gelingt `status: 'Done'` **zusammen mit** einer vollständig abgehakten
  Checkliste in einem Request (Erledigen-Dialog, MCP `task_update`).
- Reopen (`status: 'Open'`) bleibt ungefragt möglich; Aufgaben ohne Checkliste sind von der
  Schranke nicht betroffen. Serien-Instanzen sind gewöhnliche Tasks mit eigener Checklisten-Kopie
  und laufen über denselben PATCH. Kein Auto-Erledigen beim Abhaken des letzten Punkts — das bleibt
  Verhalten des Erledigen-Dialogs (#1583).

## Ablauf

1. **Ablehnung (AK1):** `PATCH /tasks/:id` mit Übergang auf `Done`, während mindestens ein
   Checkpunkt offen ist (gespeichert oder im selben Request mitgesendet) → 409 mit deutscher
   Meldung; Status und Checkliste bleiben unverändert.
2. **Freie Pfade (AK2):** Aufgabe ohne Checkliste und Aufgabe mit vollständig abgehakter
   Checkliste lassen sich unverändert erledigen (200). Reopen bleibt ohne Prüfung möglich;
   inhaltliche PATCHs auf bereits erledigten Aufgaben bleiben erlaubt (#1821).
3. **MCP-Spiegel (AK3):** `task_complete` und `task_update` mit `status: 'Done'` auf eine Aufgabe
   mit offenem Checkpunkt liefern eine Fehlerantwort mit derselben Meldung — allein über den
   Route-Proxy, ohne eigene Prüflogik in `tools.ts`.
4. **Kombinierter Request (AK4):** Ein PATCH, der `status: 'Done'` und eine vollständig abgehakte
   `checklist` in einem Request sendet, gelingt (200) und übernimmt die neue Checkliste.

## Erwartetes Ergebnis

- PATCH/`task_complete`/`task_update` auf offene Checkpunkte: 409 bzw. MCP-Fehler mit derselben
  Meldung, Status bleibt unverändert.
- Alle anderen Done-Pfade (ohne Checkliste, abgehakt, kombinierter Request) unverändert;
  `tasks-done-edit-guard.test.ts` (#1821) bleibt grün.

## Bausteine

Der Guard sitzt in `PATCH /tasks/:id` direkt neben dem Unteraufgaben-Done-Guard
(`server/src/express/routes/tasks.ts`); `validateChecklist` liefert die mitgesendete Liste. Die
MCP-Werkzeuge proxyen dieselbe Route über `callApi` — eine Prüfung für REST und MCP.
