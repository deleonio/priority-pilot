# Spec: Erledigte Tasks vor inhaltlicher Bearbeitung schützen (#1438)

Status: rot (Spec-Phase) — Tests in `server/src/express/tasks-done-edit-guard.test.ts`,
`server/src/mcp/tools.test.ts`.

## Ziel

Ein erledigter Task (`status: 'Done'`) ist inhaltlich eingefroren. `PATCH /tasks/:id` lehnt jede
inhaltliche Änderung (Titel, Beschreibung, Priorität, Aufwand, Deadline, Säulen, Kategorie,
Übergabe per `userId`, …) an einem erledigten Task mit `409` ab, solange derselbe Request den
Status nicht gleichzeitig von `Done` wegändert. Reopen — allein oder zusammen mit inhaltlichen
Feldern im selben Request — bleibt möglich; nach dem Reopen ist die Bearbeitung wieder normal
erlaubt. Gilt identisch für die HTTP-API und für MCP (`task_update`/`task_complete` rufen dieselbe
Route auf, kein separater Guard nötig).

## Aufsatzpunkt

- `server/src/express/routes/tasks.ts:612-827` — `PATCH /tasks/:id`. Der neue Guard sitzt direkt
  nach der Feldvalidierung (`tasks.ts:620-623`) und **vor** der Empfänger-/Säulen-Prüfung
  (`tasks.ts:627-689`), damit eine gesperrte Änderung keine Nebenwirkungen (Gruppen-/
  Säulen-Abfragen) mehr auslöst.
- Vorbild für die Guard-Bauform: Unteraufgaben-Done-Guard (`tasks.ts:698-709`, #246) —
  Vorbedingung prüfen, `sendError(res, 409, '<Meldung>')`, `return` vor der Transaktion.
- `server/src/mcp/tools.ts` bleibt unverändert: `task_update`/`task_complete` rufen ausschließlich
  `PATCH /tasks/{id}` auf; der Guard wirkt für MCP automatisch mit.
- `openapi.yml` (PATCH `/tasks/{id}`) bekommt die Antwort `409` (`$ref: '#/components/responses/
Conflict'`) dokumentiert — reine Doku, kein Testfall (ADR 0001).

## Guard-Regel

Ein `PATCH /tasks/:id` ist gesperrt (→ 409), wenn **alle** drei Bedingungen zutreffen:

1. Der Task ist aktuell (laut DB, nicht laut Body) `status === 'Done'`.
2. Der Request ändert den Status **nicht** weg von `Done` (`status` fehlt im Body, oder
   `status === 'Done'`).
3. Der Request enthält mindestens ein inhaltliches Feld: irgendein validiertes Attribut außer
   `status` (`validation.attrs`), oder `pillars`, oder `userId` (Übergabe).

Ein Request ohne inhaltliche Felder bleibt erlaubt (z. B. `{status:'Done'}` auf einen bereits
erledigten Task) — sonst bricht die Idempotenz-Erwartung aus `score.test.ts` (Done→Done ohne
zweiten `ScoreEntry`).

## Akzeptanzkriterien → Tests

- **AK1** — nur inhaltliche Felder, kein `status`, auf `Done`-Task → 409; `GET /tasks/:id` zeigt
  unveränderten Titel. → `tasks-done-edit-guard.test.ts` AK1.
- **AK2** — `{status:'Open'}` (analog `'In process'`) auf `Done`-Task → 200, neuer Status. →
  AK2.
- **AK3** — `{status:'Open', title:'Neu', priority:...}` auf `Done`-Task → 200, **beide**
  Änderungen übernommen (Statuswechsel im selben Request hebt die Sperre auf). → AK3.
- **AK4** — `{status:'Done', title:'Neu'}` auf bereits erledigten Task → 409, Titel unverändert
  (kein Statuswechsel trotz genanntem `status: 'Done'`). → AK4.
- **AK5** — `{status:'Done'}` ohne inhaltliche Felder auf bereits erledigten Task → weiterhin 200,
  kein zweiter `ScoreEntry`. → AK5.
- **AK6** — `{userId:<Gruppenmitglied>}` (Übergabe) auf `Done`-Task ohne Statuswechsel → 409;
  Eigentümer/Ersteller unverändert. → AK6.
- **AK7** — Tasks mit `status !== 'Done'` unverändertes Verhalten — kein neuer Testfall, der
  Bestandslauf (`api.test.ts`, `tasks-checklist.test.ts`, `tasks-address.test.ts`,
  `tasks-handover.test.ts`, `tasks-reopen-score.test.ts`, `score.test.ts`,
  `tasks-subtask-status-guard.test.ts`) muss grün bleiben.
- **AK8** — MCP `task_update` mit inhaltlichem Feld auf `Done`-Task → Fehler im MCP-Ergebnis;
  `task_complete` und Reopen per `task_update({status})` bleiben funktionsfähig. →
  `mcp/tools.test.ts`.
- **AK9** — `openapi.yml` dokumentiert `409` für `PATCH /tasks/{id}`. Kein Testfall (Doku, ADR
  0001); Prüfung im Review per Diff.
