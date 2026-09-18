# Spec #1543 — Gruppenmitglieder verwalten über MCP (`group_member_role_set`, `group_member_remove`)

Teil 2 von 3 zu #1414 (Teil 1 Gruppen: #1542; Teil 3 Einladungen).

## Ziel

Ein MCP-Client mit `readwrite`-Token ändert die Rolle eines Gruppenmitglieds und entfernt
Mitglieder — gespiegelt auf die HTTP-Routen `PATCH /groups/:id/members/:userId` und
`DELETE /groups/:id/members/:userId` (`server/src/express/routes/groups.ts:532,580`). Der
Selbstaustritt läuft über `group_member_remove` mit der eigenen `userId` (die Route erlaubt
Admin oder self); ein eigenes `group_leave`-Werkzeug gibt es bewusst nicht. Rollenprüfung,
Letzter-Admin-Guard (`isLastRemainingAdmin`, 409) und Fehlertexte bleiben allein in der
Route; die Werkzeuge prüfen nichts selbst (Muster `group_create`/`group_update`/
`group_delete`, `server/src/mcp/tools.ts`).

## Vorbedingungen

- Katalogeintrag je Werkzeug mit `write: true` (sonst greift das Scope-Gate nicht):
  - `group_member_role_set` — Argumente `{ groupId, userId, role }`, alle Pflicht
    (`role`: `"admin"` oder `"member"`; ungültige Werte weist die Route mit 400 ab, keine
    zweite Validierung im Werkzeug).
  - `group_member_remove` — Argumente `{ groupId, userId }`, beide Pflicht.
- Alle bisherigen 25 Werkzeugnamen und deren `inputSchema` bleiben unveraendert
  (Katalog-Snapshot in `tools.test.ts` friert sie ein); der Katalog waechst auf 27 Namen.

## Akzeptenzkriterien und Testfaelle (Server-Integrationstests, `server/src/mcp/tools.test.ts`)

- **AK1 Katalog**: `tools/list` enthaelt `group_member_role_set` und `group_member_remove`
  mit den vorgesehenen required-Feldern; alle bisherigen Namen inkl. deren `inputSchema`
  unveraendert (Snapshot-Liste und Namenszaehler der Bestands-Suite werden auf 27 gepflegt,
  s. Test-Pflege-Bedarf im PR).
- **AK2 Rolle aendern / entfernen / selbst austreten**: Gruppe per `group_create` anlegen,
  zweites Konto als `member` aufnehmen. `group_member_role_set` auf `admin` — nachweisbar in
  `group_members_list`; `group_member_remove` (durch den Admin) entfernt das Mitglied —
  nachweisbar in `group_members_list`. `group_member_remove` mit der eigenen `userId`
  bewirkt den Austritt: das eigene Konto taucht in `group_members_list` nicht mehr auf und
  die Gruppe verschwindet aus `group_list`.
- **AK3 Letzter-Admin-Guard**: Der letzte verbleibende Admin degradiert sich selbst
  (`group_member_role_set`, role `member`) bzw. traegt sich selbst aus
  (`group_member_remove`) — beides liefert den 409-Text der Route („Die Gruppe braucht
  mindestens einen Administrator — ernenne zuerst eine andere Person."); die Rolle bleibt
  `admin`.
- **AK4 Rechte/Fremdzugriff**: Ein Mitglied ohne Adminrolle scheitert an
  `group_member_role_set` und an `group_member_remove` (auf ein anderes Mitglied) je mit
  dem Routen-Meldungstext plus Statuscode in Klammern („Nur Administratoren dürfen Rollen
  ändern." (HTTP 403), „Nur Administratoren dürfen andere Mitglieder entfernen." (HTTP
  403)); ein fremdes Konto ohne Mitgliedschaft erhaelt auf beide Werkzeuge „Gruppe nicht
  gefunden." (HTTP 404); die Mitgliederliste bleibt unveraendert.
- **AK5 Scope-Gate**: Mit Nur-lese-Token scheitern beide Werkzeuge am Scope-Gate
  (`read access only` … „Lesen und Schreiben …"); es aendern sich keine Daten
  (`group_members_list` bleibt abrufbar und unveraendert).

## Erwartetes Ergebnis

MCP-Clients verwalten Gruppenmitglieder mit derselben Berechtigungs- und Fehlersemantik wie
die Weboberflaeche; Teil 3 (#1414) baut die Einladungs-Werkzeuge auf diesem Katalog auf.
