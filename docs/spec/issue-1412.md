# Spec: MCP-Server — Kategorien anlegen, ändern und löschen (#1412)

Status: rot (Spec-Phase) — Tests in `server/src/mcp/tools.test.ts`.

## Ziel

Der eingefrorene v1-Werkzeugkatalog (`server/src/mcp/tools.ts`, zuletzt erweitert in #1423 auf
vierzehn Namen) bekommt drei zusätzliche, schreibende Werkzeuge: `category_create`,
`category_update`, `category_delete`. Ein MCP-Client mit `readwrite`-Token kann eigene Kategorien
anlegen, umbenennen/umfärben und löschen — ohne zweiten Fachlogik- oder Auth-Pfad, exakt nach dem
Muster von `task_create`/`task_update`/`task_delete` (`server/src/mcp/tools.ts:252-301`).

## Aufsatzpunkt

- `server/src/mcp/tools.ts:242-431` — Array `mcpTools`; drei neue Einträge (Namens-Snapshot ist
  alphabetisch sortiert, `category_list` steht bereits an Position 410).
- `server/src/mcp/tools.ts:115-121` `requireIntegerId` — Pflicht-Ganzzahl-Prüfung für `id`.
- Gespiegelte Routen (unverändert, keine neue Fachlogik): `POST /categories`,
  `PATCH /categories/:id`, `DELETE /categories/:id` (`server/src/express/routes/categories.ts:143,
168, 207`) — Eigentümer-Filter über `ownerScope`, Namenskollision → 409, fremde/unbekannte ID →
  404 `"Kategorie nicht gefunden."`, ungültiger Name/Farbe → 400, Löschen setzt `categoryId` von
  Task/Series in einer Transaktion auf `null` (`categories.ts:225-227`).
- `server/src/models/categoryColors.ts:11` `CATEGORY_COLORS` — Palette für gültige Farbwerte, im
  Test bereits importiert (`tools.test.ts:5`).

## Vertrag

- `category_create`: Pflichtargumente `name` (String), `color` (Palettenwert), `write: true`. Ruft
  `POST /categories` über `callApi` auf und liefert die angelegte Kategorie (inkl. `id`).
- `category_update`: Pflichtargument `id` (Ganzzahl ≥ 1), optional `name`/`color`, `write: true`.
  Ruft `PATCH /categories/:id` auf.
- `category_delete`: Pflichtargument `id` (Ganzzahl ≥ 1), `write: true`. Ruft
  `DELETE /categories/:id` auf, liefert die leere Nutzlast als `null` (Muster `task_delete`).
- Namenskollision (`category_create` und `category_update`) → derselbe JSON-RPC-Fehler wie die
  gespiegelte Route (Text `"Eine Kategorie mit diesem Namen existiert bereits."` + `HTTP 409`); es
  entsteht keine zweite Kategorie bzw. der Name bleibt unverändert.
- Fremde/unbekannte `id` (`category_update`, `category_delete`) → Fehlertext
  `"Kategorie nicht gefunden."` + `HTTP 404`; die fremde Kategorie bleibt unverändert (Name, Farbe,
  Existenz).
- Nur-lese-Token (`scope: read`) → Fehler mit dem Scope-Hinweis des Rahmens
  (`server/src/mcp/server.ts:96-104`, Text „writes data, but this token allows read access only");
  `category_list` bleibt mit demselben Token erfolgreich, die Kategorienliste ändert sich nicht.
- Ungültige Eingaben (leerer Name, Name > 40 Zeichen, Farbe außerhalb der Palette) → derselbe
  400-Fehlertext der Route; es entsteht/ändert sich nichts (Route ist die einzige
  Validierungsinstanz, kein zweiter Prüfpfad im Werkzeug).
- Löschen: eine Aufgabe mit dieser `categoryId` bleibt erhalten und hat danach `categoryId: null`
  (geerbtes Routenverhalten, keine neue Fachlogik).
- Der v1-Namens-Snapshot (`tools.test.ts:886-913`, `:946`, `:1157`) wächst von vierzehn auf
  siebzehn Namen; alle vierzehn Bestandsnamen bleiben unverändert. Diese drei bestehenden
  Assertions werden in diesem Spec-Commit auf 17 angehoben (Test-Pflege, kein Verhaltenswechsel —
  s. PR-Body).
- Alle bestehenden Werkzeuge verhalten sich unverändert.

## Akzeptanzkriterien → Tests

| AK  | Test                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | TF1 — `tools/list` liefert 17 Namen inkl. der drei neuen mit den in AK1 genannten `required`-Feldern; Bestands-Snapshots auf 17 gezogen |
| AK2 | TF2 — `readwrite`-Token legt Kategorie per `category_create` an, `category_list` enthält sie danach                                     |
| AK3 | TF3 — `category_update` ändert Name und Farbe einer eigenen Kategorie, `category_list` zeigt beides                                     |
| AK4 | TF4 — `category_delete` entfernt aus `category_list`; zugeordnete Aufgabe bleibt mit `categoryId: null` erhalten                        |
| AK5 | TF5 — Namenskollision bei `category_create` und `category_update` → 409-Fehlertext, keine Änderung                                      |
| AK6 | TF6 — fremde/unbekannte `id` bei `category_update`/`category_delete` → 404-Fehlertext, fremde Kategorie unverändert                     |
| AK7 | TF7 — Nur-lese-Token scheitert bei allen drei Werkzeugen am Scope-Hinweis, `category_list` bleibt erfolgreich                           |
| AK8 | TF8 — leerer Name, zu langer Name, Farbe außerhalb der Palette → 400-Fehlertext der Route, nichts angelegt                              |
