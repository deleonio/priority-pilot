# Spec #2756 — MCP `task_update`: Deadline per `null` entfernen

## Ziel

`task_update` (MCP) akzeptiert `deadline: null` und entfernt damit die Deadline derselben Weg wie
die App über `PATCH /tasks/:id` (dort ist `null` bereits zugelassen). Das deklarierte
`inputSchema` darf MCP-Clients nicht mehr mit `type: "string"` allein abweisen.

## Voraussetzungen

- Aufgabe mit gesetzter Deadline existiert (per `task_create` angelegt).
- `autoDeleteAfterDeadline` greift nur bei `deadline != null` (bestehendes Verhalten, unverändert).

## Schritte und erwartetes Ergebnis

### AK1 — Deadline per `task_update` auf `null` setzen

- **Schritt:** `task_update { id, deadline: null }` auf einer Aufgabe mit Deadline.
- **Erwartet:** kein `error` in der Antwort; `task_list` zeigt für die Aufgabe danach
  `deadline: null`.

### AK2 — Schema-Deklaration

- **Schritt:** `tools/list` für `task_update` lesen.
- **Erwartet:** `inputSchema.properties.deadline.type` ist ein Array, das `"string"` und `"null"`
  enthält; die Beschreibung erwähnt das Entfernen per `null` („null removes the deadline“).

### AK3 — Zusammenspiel mit `autoDeleteAfterDeadline`

- **Schritt:** Aufgabe mit Deadline + `autoDeleteAfterDeadline: true`, dann `task_update
{ id, deadline: null }`, dann `runDeadlineAutoDelete(now)` mit weit in der Zukunft liegendem
  `now`.
- **Erwartet:** kein `error`; `runDeadlineAutoDelete` löscht die Aufgabe nicht (`deleted: 0`),
  Aufgabe existiert weiter, `autoDeleteAfterDeadline` bleibt `true`, `deadline` bleibt `null`.

## Testfälle

- TF1 (AK1): `server/src/mcp/tools.test.ts` — task_create mit Deadline, task_update `deadline: null`
  ohne error, task_list mit `deadline === null`.
- TF2 (AK2): `server/src/mcp/tools.test.ts` — Schema-Spiegel: `deadline.type` enthält
  `["string", "null"]`, Beschreibung nennt Entfernen per null.
- TF3 (AK3): `server/src/mcp/tools.test.ts` — Aufgabe mit Deadline + Auto-Delete-Flag, Deadline per
  task_update auf null, `runDeadlineAutoDelete` löscht sie nicht, Flag unverändert.

## Randbedingungen

- Keine zweite Validierungsschicht im MCP-Layer; die Route bleibt die einzige Entscheidungsinstanz.
- `autoDeleteAfterDeadline` bleibt am Task unverändert; der Job greift nur bei gesetzter Deadline.
- Die Property `deadline` teilen sich `task_create`/`task_update`/`series_instantiate` — die
  Änderung gilt für alle drei (dort ist `null` harmlos, die Route akzeptiert `null` ebenfalls).
