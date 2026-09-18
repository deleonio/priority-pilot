# Spec #1544 — Einladungen und Einladungslinks über MCP (`group_invitation_*`, `invitation_*`, `invite_link_*`)

Teil 3 von 3 zu #1414 (Teil 1 Gruppen: #1542; Teil 2 Mitglieder: #1543).

## Ziel

Ein MCP-Client mit `readwrite`-Token verwaltet Einladungen und Einladungslinks vollständig —
gespiegelt auf die HTTP-Routen in `server/src/express/routes/groups.ts` und den öffentlichen
Link-Check in `server/src/express/routes/inviteLinks.ts`:

| Werkzeug                  | Route                                             | schreibend |
| ------------------------- | ------------------------------------------------- | ---------- |
| `group_invitation_list`   | `GET /groups/:id/invitations` (`groups.ts:335`)   | nein       |
| `group_invitation_create` | `POST /groups/:id/invitations` (`groups.ts:369`)  | ja         |
| `invitation_list`         | `GET /invitations` (`groups.ts:432`)              | nein       |
| `invitation_accept`       | `POST /invitations/:id/accept` (`groups.ts:460`)  | ja         |
| `invitation_decline`      | `POST /invitations/:id/decline` (`groups.ts:496`) | ja         |
| `invite_link_create`      | `POST /groups/:id/invite-links` (`groups.ts:775`) | ja         |
| `invite_link_delete`      | `DELETE /invite-links/:id` (`groups.ts:811`)      | ja         |

Rollenprüfung (Nicht-Admin 403), Fremdgruppe (404, kein Existenz-Leak), Duplikat-Guards (409),
Paket-Gate und Fehlertexte bleiben allein in den Routen; die Werkzeuge prüfen nichts selbst
(Muster `group_member_role_set`/`group_members_list` aus #1543, `server/src/mcp/tools.ts`).
Nur die fünf schreibenden Einträge tragen `write: true` — sonst blockiert das Scope-Gate
(`server/src/mcp/server.ts:96`) auch die beiden List-Werkzeuge für Nur-lese-Tokens.

## Vorbedingungen

- Katalogeintrag je Werkzeug mit `inputSchema`:
  - `group_invitation_list` — `{ groupId }` (Pflicht).
  - `group_invitation_create` — `{ groupId, userId }` (beides Pflicht; ungültige Werte weist
    die Route mit 400/404 ab, keine zweite Validierung im Werkzeug).
  - `invitation_list` — keine Pflichtfelder.
  - `invitation_accept` / `invitation_decline` — `{ id }` (Pflicht; nur das eingeladene Konto
    selbst kommt an die Einladung, fremde/erledigte → 404-Text der Route).
  - `invite_link_create` — `{ groupId }` (Pflicht).
  - `invite_link_delete` — `{ id }` (Pflicht; Route antwortet 204).
- Alle bisherigen 27 Werkzeugnamen und deren `inputSchema` bleiben unveraendert; der Katalog
  waechst auf 34 Namen.

## Akzeptenzkriterien und Testfaelle (Server-Integrationstests, `server/src/mcp/tools.test.ts`)

- **AK1 Katalog**: `tools/list` enthaelt alle sieben neuen Namen mit den vorgesehenen
  required-Feldern; alle bisherigen Namen inkl. deren `inputSchema` unveraendert
  (Snapshot-Liste und Namenszaehler der Bestands-Suites werden auf 34 gepflegt, s.
  Test-Pflege-Bedarf im PR).
- **AK2 Einladen, annehmen, ablehnen**: Admin A legt eine Gruppe an und lädt B per
  `group_invitation_create` ein — die Einladung steht in `group_invitation_list` der Gruppe
  und in `invitation_list` des Kontos B (mit `groupName`). Nach `invitation_accept` (durch B)
  ist B Mitglied in `group_members_list` und die Einladung ist aus `invitation_list` entfernt.
  Im zweiten Fall (`invitation_decline`) bleibt B ohne Mitgliedschaft und die Einladung ist
  erledigt (kein `pending`-Eintrag mehr in `group_invitation_list`).
- **AK3 Einladungslink**: `invite_link_create` liefert `{ id, token, expiresAt }` mit Token
  (hex, ≥ 32 Zeichen); der öffentliche Link-Check `GET /invite-links/:token` antwortet 200.
  Nach `invite_link_delete` antwortet der Route `DELETE /invite-links/:id` mit 204 (Werkzeug
  ohne Fehler) und der öffentliche Link-Check 410 — der Link ist nicht mehr nutzbar.
- **AK4 Rechte/Fremdzugriff**: Ein Mitglied ohne Adminrolle scheitert an
  `group_invitation_create` mit dem Routen-Meldungstext plus Statuscode in Klammern
  („Nur Administratoren dürfen einladen." (HTTP 403)); ein fremdes Konto ohne Mitgliedschaft
  erhaelt „Gruppe nicht gefunden." (HTTP 404); die Einladungsliste der Gruppe bleibt leer.
- **AK5 Scope-Gate**: Mit Nur-lese-Token scheitern alle fuenf schreibenden Werkzeuge am
  Scope-Gate (`read access only` … „Lesen und Schreiben …"); die beiden List-Werkzeuge
  funktionieren mit demselben Nur-lese-Token, und die Einladung bleibt unangetastet
  (weiterhin `pending`, es entsteht keine Mitgliedschaft).

## Erwartetes Ergebnis

MCP-Clients verwalten Einladungen und Einladungslinks mit derselben Berechtigungs- und
Fehlersemantik wie die Weboberflaeche; Teil 3 schließt die Gruppen-Verwaltung aus #1414 ab.
