# Spec: Gruppen anlegen und eigene Gruppen verwalten (#1211)

Status: rot (Spec-Phase) — Tests in `server/src/express/groups.api.test.ts`,
`server/src/express/groups-dataisolation.test.ts`, `frontend/e2e/groups.spec.ts`.

## Ziel

Angemeldete Nutzer legen Gruppen (Name Pflicht, ≤ 60 Zeichen; Beschreibung optional) an und
sind damit automatisch Admin. Sie sehen die Gruppen ihrer Mitgliedschaft mit eigener Rolle
und Mitgliederzahl, bearbeiten und löschen Gruppen, in denen sie Admin sind. Gruppen anderer
Nutzer sind weder sichtbar noch erreichbar (404, nicht 403). Ticket 2/3 aus #952
(Einladungen, Gruppen-Aufgaben) sind NICHT Scope.

## Datenmodell (Vertrag)

- `Group` (`server/src/models/group.ts`, neu): `id`, `name` (≤ 60), `description` (optional).
  Kein `userId` — Zugehörigkeit kommt ausschließlich aus `group_members`.
- `GroupMember` (`server/src/models/groupMember.ts`, neu): Komposit-PK `groupId+userId`
  (Muster `taskPillar.ts`), `role` (`'admin' | 'member'`), `joinedAt`.
- Tabellen entstehen per `sequelize.sync()` — keine `migrate.ts`-Änderung.

## API-Vertrag (hinter `requireAuth`, Router `server/src/express/routes/groups.ts` neu)

| Route                 | Verhalten                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /groups`        | Body `{name, description?}`. 201 mit `{id, name, description, role:'admin', memberCount:1}`; Ersteller wird als Admin-Mitglied eingetragen. Leerer Name oder > 60 Zeichen → 400 mit deutscher Meldung. |
| `GET /groups`         | Nur Gruppen mit Membership des angemeldeten Nutzers, je `{id, name, description, role, memberCount}`. `memberCount` = COUNT über `group_members`.                                                      |
| `GET /groups/{id}`    | Eigene Membership → 200 (gleicher Shape); fremde Gruppe → 404.                                                                                                                                         |
| `PATCH /groups/{id}`  | Nur `role='admin'` → 200; Validierung wie POST; fremde Gruppe → 404.                                                                                                                                   |
| `DELETE /groups/{id}` | Admin → 204; entfernt Gruppe UND alle `group_members`-Einträge in einer Transaktion; anschließendes `GET /groups/{id}` → 404. Fremde Gruppe → 404.                                                     |

Sichtbarkeit/Rechte immer über Membership-Lookup in `group_members` — nie über `ownerScope`
(Group hat kein userId-Feld). Pass-Through-Modus (`ownerScope(undefined)` = `{}`) darf den
Router nicht brechen (API-Tests laufen ohne Auth-Env, Isolationstests mit).

## Frontend-Vertrag

- Neuer Settings-Tab „Gruppen" unter `/settings/gruppen`:
  `SETTINGS_TABS` (`SettingsPage.tsx`) und `SETTINGS_PATH_SEGMENTS` (`App.tsx:63`) plus
  Navigation (`App.tsx:355`) wachsen synchron.
- Liste als vertikale Karten (keine Tabelle): Name, gekappte Beschreibung, Metazeile Rolle
  (Text-Badge `KolBadge`, nie nur Farbe) + „N Mitglieder". Touch-Targets ≥ 44px.
- Anlegen/Bearbeiten über Modal (`Modal.tsx`-Muster): `KolInputText` Name (Pflicht),
  `KolTextarea` Beschreibung (optional); Inline-Validierung leer/> 60 mit deutscher Meldung.
- Löschen: sequenzielle Bestätigung nach `docs/ux-pattern-sequential-confirmation.md`
  (Schritt 1 Intent, Schritt 2 Scope „inkl. aller Mitglieder-Einträge", Fokus-Management
  verbindlich). Nicht-Admin-Mitgliedschaften: keine Bearbeiten/Löschen-Aktionen (Server-`role`
  steuert).
- Zustände: Leer (`EmptyState`-Muster mit Anlegen-CTA), Laden (`KolSpin`), Fehler (`KolAlert`).

## Akzeptanzkriterien → Tests

- AK1/AK4/AK5 → `groups.api.test.ts`: 201-Shape, 400-Validierung, Cascade-Delete + 404 danach.
- AK2/AK3/AK9 → `groups-dataisolation.test.ts`: zwei Konten (Muster
  `series-dataisolation.test.ts`), Listenfilter + 404 auf GET/PATCH/DELETE.
- AK6/AK7 → `frontend/e2e/groups.spec.ts`: Tab-Route, Anlegen-Dialog, sequenzielle
  Löschen-Bestätigung.
- AK8 → e2e bei 375×812: Bounding-Box-Assertions (`x + width ≤ viewportWidth`), nicht
  `scrollWidth` (App-Shell clippt `overflow-x: hidden`).

## Offene Fragen

- -
