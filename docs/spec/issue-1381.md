# Spec: MCP-Server — Gruppen und Gruppenmitglieder auslesen (#1381)

Status: rot (Spec-Phase) — Tests in `server/src/mcp/tools.test.ts`.

## Ziel

Der eingefrorene v1-Werkzeugkatalog (#1353) bekommt zwei zusätzliche, rein lesende Einträge:
`group_list` und `group_members_list`. Ein MCP-Client kann damit mit einem Nur-lese-Token seine
eigenen Gruppen auflisten und zu einer davon die Mitglieder abrufen — ohne zweiten Fachlogik- oder
Auth-Pfad, exakt wie die bestehenden Werkzeuge (`pillar_list`, `task_links`).

## Aufsatzpunkt

- `server/src/mcp/tools.ts:187-322` — Array `mcpTools`; neue Einträge nach `category_list`
  (Namens-Snapshot ist alphabetisch sortiert).
- `server/src/mcp/tools.ts:92` `requireTaskId` — Pflicht-Ganzzahl-Prüfung; wird für `groupId`
  wiederverwendet bzw. verallgemeinert (Fehlertext muss weiterhin den Schlüsselnamen nennen).
- Gespiegelte Routen (unverändert, keine neue Fachlogik):
  - `GET /groups` (`server/src/express/routes/groups.ts:111`) → `{id, name, description, imageUrl,
role, memberCount}[]`, gefiltert auf Mitgliedschaften des Token-Besitzers.
  - `GET /groups/:id/members` (`groups.ts:301`) → `{userId, displayName, role}[]`; fremde Gruppe →
    404 `"Gruppe nicht gefunden."`.

## Vertrag

- `group_list`: keine Argumente, kein `write`. Liefert genau die Nutzlast von `GET /groups`.
- `group_members_list`: Pflichtargument `groupId` (Ganzzahl ≥ 1), kein `write`. Liefert genau die
  Nutzlast von `GET /groups/:id/members`. Fremde/unbekannte Gruppe → derselbe JSON-RPC-Fehler wie
  die gespiegelte Route (Text + HTTP-Status im Fehlertext, Muster `task_links`/`callApi`).
- Ungültige oder fehlende `groupId` → Fehler, der den Schlüsselnamen `groupId` nennt, ohne dass ein
  Loopback-Request abgesetzt wird.
- Beide Werkzeuge funktionieren mit einem Token der Rechtestufe `read` (kein `write: true`).
- Datenisolation: `group_list` von Nutzer A enthält keine Gruppe, in der nur Nutzer B Mitglied ist.
- Der v1-Namens-Snapshot (`tools.test.ts`) wächst von zehn auf zwölf Namen; alle zehn Bestandsnamen
  (inkl. `task_unlink`) bleiben unverändert. (Die Akzeptanzkriterien-Liste im Analyse-Block nennt an
  dieser Stelle nur elf Namen und lässt `task_unlink` aus — das ist eine Auslassung des
  Analyse-Blocks, nicht eine Anweisung, das Werkzeug zu entfernen; der Snapshot-Test sichert weiterhin
  alle zehn eingefrorenen Bestandswerkzeuge plus die zwei neuen.)

## Akzeptanzkriterien → Tests

- AK1 → TF1 (`group_list` liefert `GET /groups`-Nutzlast).
- AK2 → TF2 (`group_members_list` liefert `GET /groups/:id/members`-Nutzlast).
- AK3 → TF3 (fremde Gruppe → JSON-RPC-Fehler, kein `result`).
- AK4 → TF4 (fehlende/ungültige `groupId`).
- AK5 → TF5 (Nur-lese-Token, kein 403).
- AK6 → TF6 (Datenisolation `group_list`).
- AK7 → TF7 (Namens-Snapshot auf zwölf Namen erweitert, inkl. `task_unlink`).

Rot, bis `group_list` und `group_members_list` in `server/src/mcp/tools.ts` existieren. KEIN
Produktivcode in dieser Phase.
