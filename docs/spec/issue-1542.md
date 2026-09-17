# Spec #1542 — Gruppen verwalten über MCP (`group_create`, `group_update`, `group_delete`)

Teil 1 von 3 zu #1414 (Gruppen über MCP; Teil 2 Mitglieder, Teil 3 Einladungen).

## Ziel

Ein MCP-Client mit `readwrite`-Token kann Gruppen anlegen, ändern und löschen — gespiegelt auf die
HTTP-Routen `POST /groups`, `PATCH /groups/:id`, `DELETE /groups/:id`
(`server/src/express/routes/groups.ts`). Validierung, Rollen und Fehlertexte bleiben allein in der
Route; die Werkzeuge prüfen nichts selbst (Muster `category_create`/`category_update`/
`category_delete`, `server/src/mcp/tools.ts`).

## Vorbedingungen

- Katalogeintrag je Werkzeug mit `write: true` (sonst greift das Scope-Gate nicht), `inputSchema`
  und `run` via `callApi`.
- Alle bisherigen Werkzeugnamen und deren `inputSchema` bleiben unveraendert (Katalog-Snapshot in
  `tools.test.ts` friert sie ein); der Katalog waechst von 22 auf 25 Namen.

## Akzeptanzkriterien und Testfaelle (Server-Integrationstests, `server/src/mcp/tools.test.ts`)

- **AK1 Katalog**: `tools/list` enthaelt `group_create`, `group_update`, `group_delete`;
  alle bisherigen Namen inkl. deren `inputSchema` unveraendert (Snapshot-Listen/-Zaehler in der
  Bestands-Suite werden auf 25 Namen gepflegt, s. Test-Pflege-Bedarf im PR).
- **AK2 Anlegen**: Mit `readwrite`-Token legt `group_create` ({ name, description }) eine Gruppe
  an; sie erscheint mit Rolle `admin` in `group_list`.
- **AK3 Aendern/Loeschen**: `group_update` ({ id, name, description }) aendert Name und
  Beschreibung, nachweisbar in `group_list`; `group_delete` ({ id }) entfernt die Gruppe aus
  `group_list`.
- **AK4 Rechte/Fremdzugriff**: Mitglied ohne Adminrolle bei `group_update` → JSON-RPC-Fehler mit
  exakt dem Routen-Meldungstext plus Statuscode in Klammern („Nur Administratoren dürfen die
  Gruppe bearbeiten." (HTTP 403)); fremdes Konto bei `group_delete` → „Gruppe nicht gefunden."
  (HTTP 404); die Gruppe bleibt unveraendert.
- **AK5 Scope-Gate**: Mit Nur-lese-Token scheitern alle drei Werkzeuge am Scope-Gate
  (`read access only` … „Lesen und Schreiben …"); es aendern sich keine Daten.

## Erwartetes Ergebnis

MCP-Clients verwalten Gruppen mit derselben Berechtigungs- und Fehlersemantik wie die
Weboberflaeche; Teil 2/3 (#1414) bauen Mitglieder- und Einladungs-Werkzeuge auf diesem Katalog auf.
