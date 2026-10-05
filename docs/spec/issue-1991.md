# Spec #1991 — Duo im Frontend (Duo-Karte, Einladungsfluss)

## Ziel

Eine Gruppe mit `kind='duo'` (Server seit #1974) wird im Frontend als Duo dargestellt: gemeinsamer
Streak und Säulenwerte beider Personen, ohne Aufgaben des Partners.

## Frontend-Vertrag

- `api.getGroupDuo({ id, tz?, signal? })` ruft `GET /groups/{id}/duo?tz=` und liefert
  `{ streak: { aktuell, best }, members: [{ userId, name, saeulen: [{ pillarId, name, wert }] }] }`.
- `DuoCard` (`components/DuoCard.tsx`), Props `{ groupId: number }`, lädt beim Mount per `api.getGroupDuo`.
  - Rahmen `KolCard`; je Mitglied ein Block mit Name und je Säule „Name: Wert" als Text.
  - `data-testid="duo-streak-shared"` bei `streak.aktuell > 0`: enthält beide Namen und die Streak-Zahl.
  - `data-testid="duo-streak-zero"` bei `aktuell = 0`: ermutigender Leerzustand; Bestmarke bleibt sichtbar.
  - `data-testid="duo-member"` je Person; mit nur einer Person zusätzlich Platzhalter „Noch niemand dabei".
- `GroupDetail` erhält `kind?: 'group' | 'duo'` (Default `'group'`; `GroupsSection` reicht `group.kind` durch).
  - `kind='duo'`: rendert `DuoCard`; ruft weder `getGroupTasks`, `getGroupSeries` noch `listTasks` auf (AK2).
  - Einladen („Link erzeugen") nur solange das Duo weniger als 2 Mitglieder hat (AK3).
- `GroupFormDialog`: Art „Gruppe | Duo" wählbar; `createGroup` sendet `kind` (AK3 Schritt 1, E2E).

## Akzeptanzkriterien

AK1 Duo-Karte mit Streak (`aktuell`, `best`) + Namen und Säulenwerten beider. AK2 keine Aufgabenabfrage,
keine Partner-Aufgabentitel. AK3 Anlegen als Duo, Link erzeugen, Beitritt, danach beide sichtbar, Einladen
weg. AK4 Streak > 0: gemeinsame Darstellung; 0: Leerzustand ohne Vorwurf. AK5 375 px ohne Überlauf.
