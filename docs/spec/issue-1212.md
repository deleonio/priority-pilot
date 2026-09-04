# Spec: Gruppenmitglieder über Nutzersuche einladen und Mitgliedschaft pflegen (#1212)

Status: rot (Spec-Phase) — Tests in `server/src/express/users-search.test.ts`,
`server/src/express/groups-invitations.api.test.ts`,
`server/src/express/groups-dataisolation.test.ts` (Erweiterung),
`frontend/src/components/GroupDetail.test.tsx`, `frontend/e2e/groups-invitations.spec.ts`.

Teil 2 der Gruppen-Epic #952 (Teil 1: #1211, Gruppen-CRUD).

## Ziel

Admins suchen aus dem Gruppendetail heraus Konten (volle E-Mail oder Namensfragment ab
3 Zeichen) und laden sie ein. Der Eingeladene sieht offene Einladungen in einer eigenen Ansicht,
nimmt an oder lehnt ab; Annahme macht ihn zum `member`. Admins entfernen Mitglieder; Mitglieder
verlassen eine Gruppe über denselben Endpunkt mit der eigenen `userId`. Die letzte Admin-Position
bleibt unantastbar (409).

## Datenmodell (Vertrag)

- `GroupInvitation` (`server/src/models/groupInvitation.ts`, neu): `id` (Autoincrement-PK),
  `groupId`, `invitedUserId`, `invitedByUserId`, `status` (`'pending' | 'accepted' | 'declined'`),
  `createdAt`. Kein DB-Unique-Constraint auf `(groupId, invitedUserId)` — die Anwendungsschicht
  prüft auf ein **bestehendes `pending`**, damit nach `declined` eine neue Einladung möglich
  bleibt (offene Frage der Analyse, hier entschieden: 409 nur für doppelte `pending`).
- Tabelle `group_invitations` entsteht per `sequelize.sync()` — keine `migrate.ts`-Änderung.

## API-Vertrag (hinter `requireAuth`)

| Route                                  | Verhalten                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /users/search?query=`             | Treffer bei vollständiger E-Mail-Adresse (Exact-Match) ODER `displayName`-Fragment ab 3 Zeichen (case-insensitive, Teiltreffer). Antwort je Treffer nur `{id, displayName}` — nie E-Mail. `query` < 3 Zeichen und keine vollständige E-Mail → 200 mit `[]` (kein 400). Kein Treffer → 200 `[]`.                                                                                                                                        |
| `POST /groups/{id}/invitations`        | Body `{userId}`. Absender muss `role='admin'` der Gruppe sein. Legt `pending`-Einladung an → 201 `{id, groupId, userId, status:'pending'}`. Zweiter Aufruf für dasselbe `(groupId, userId)` **während `pending` existiert** → 409. Bereits Mitglied → 409. Nach `declined` ist ein neuer Aufruf zulässig (neue `pending`-Zeile). Nicht-Admin-Mitglied → 403. Nicht-Mitglied (auch unbekannte Gruppe) → 404. Unbekannte `userId` → 404. |
| `GET /groups/{id}/members`             | Eigene Membership (admin oder member) → 200 `[{userId, displayName, role}]`. Fremde Gruppe → 404.                                                                                                                                                                                                                                                                                                                                      |
| `GET /groups/{id}/invitations`         | Nur `role='admin'` → 200 mit offenen (`pending`) Einladungen der Gruppe `[{id, userId, displayName, status}]`. Nicht-Admin-Mitglied → 403. Nicht-Mitglied → 404.                                                                                                                                                                                                                                                                       |
| `GET /invitations`                     | Offene (`pending`) Einladungen des angemeldeten Nutzers, gruppen-übergreifend: `[{id, groupId, groupName, invitedByName}]`.                                                                                                                                                                                                                                                                                                            |
| `POST /invitations/{id}/accept`        | Nur der Eingeladene selbst → 200 `{groupId}`; legt `GroupMember` mit `role='member'` an, Einladung verschwindet aus `GET /invitations` (Status `accepted` oder gelöscht — Implementierungsdetail, Vertrag ist „taucht nicht mehr in GET /invitations auf"). Fremde Einladung (anderer Nutzer) → 404.                                                                                                                                   |
| `POST /invitations/{id}/decline`       | Nur der Eingeladene selbst → 200; Mitgliederliste bleibt unverändert, Einladung verschwindet aus `GET /invitations`. Fremde Einladung → 404.                                                                                                                                                                                                                                                                                           |
| `DELETE /groups/{id}/members/{userId}` | Admin entfernt ein beliebiges Mitglied, oder ein Mitglied entfernt sich selbst (`userId` = eigene ID) → 204. Ein einfaches Mitglied, das ein **anderes** Konto entfernen will → 403. Würde die Entfernung den letzten verbleibenden Admin der Gruppe beseitigen → 409 mit erklärender deutscher Meldung, nichts wird verändert. Fremde Gruppe → 404.                                                                                   |

Sichtbarkeit/Rechte laufen wie in #1211 über Membership-Lookup in `group_members`
(`findMembership`, `server/src/express/routes/groups.ts:55`) — nie über `ownerScope`.

## Frontend-Vertrag

- Neue Komponente `GroupDetail` (`frontend/src/components/GroupDetail.tsx`, neu): Mitgliederliste
  (Anzeigename + Rollen-`KolBadge`), darunter offene Einladungen mit `KolBadge _label="Ausstehend"`.
  Nur bei eigener Rolle `admin`: Nutzersuche (`KolInputText`, Debounce, Ergebnisliste mit
  „Einladen"-Button je Treffer) und „Entfernen"-Aktion je Mitglied.
- Empfangene Einladungen: eigener Abschnitt in `GroupsSection` (sichtbar sobald ≥ 1 `pending`),
  mit „Annehmen"/„Ablehnen"-Buttons je Einladung.
- Zustände wie #1211: Laden (`KolSpin`), Leer bei Suche „Keine Konten gefunden" (kein `KolAlert`,
  AK2 ist kein Fehler), Fehler (`KolAlert`), 409 „letzter Administrator" als `KolAlert` mit der
  Server-Meldung.
- Entfernen (fremdes Konto) und Gruppe verlassen (eigenes Konto): sequenzielle Bestätigung nach
  `docs/ux-pattern-sequential-confirmation.md`, Muster `GroupDeleteDialog.tsx` (#1211).
- 375px: Mitgliederliste als vertikale Liste, Annehmen/Ablehnen full-width gestapelt
  (Bounding-Box-Assertions statt `scrollWidth` — App-Shell clippt `overflow-x: hidden`).

## Akzeptanzkriterien → Tests

- AK1/AK2 → `users-search.test.ts`: volle E-Mail, displayName ab 3 Zeichen, nur `{id,displayName}`,
  keine E-Mail-Teiltreffer, 0 Treffer → 200 `[]`.
- AK3/AK4 → `groups-invitations.api.test.ts`: POST 201 pending, Duplikat-pending → 409,
  Nicht-Admin → 403, Nicht-Mitglied → 404.
- AK5 → `groups-invitations.api.test.ts`: `GET /invitations` mit Gruppenname + Einladenden-Namen.
- AK6/AK7/AK8 → `groups-invitations.api.test.ts`: accept → Member-Eintrag + Gruppe in
  `GET /groups`; decline → unverändert/weg; fremde Einladung → 404.
- AK9/AK10 → `groups-invitations.api.test.ts`: Admin-DELETE entfernt; Mitglied-DELETE fremdes
  Konto → 403; letzten Admin → 409 mit Meldung.
- Dataisolation → `groups-dataisolation.test.ts` (Erweiterung): fremde Gruppe/Einladung leakt
  nichts über die neuen Routen.
- AK11 → `frontend/src/components/GroupDetail.test.tsx`: Mitgliederliste Name+Rolle, offene
  Einladungen „Ausstehend".
- AK12 → `frontend/e2e/groups-invitations.spec.ts`: Suche, Annehmen/Ablehnen bei 375px,
  Bounding-Box-Assertion.

## Offene Fragen

- Erneutes Einladen eines bereits vorhandenen Mitglieds und nach `declined`: hier entschieden
  (siehe Datenmodell) — 409 nur für doppelte `pending` bzw. bestehende Mitgliedschaft, nach
  `declined` ist eine neue Einladung zulässig. Keine Rückfrage nötig (Analyse-Block erlaubt der
  Spec-Phase die Wahl).
