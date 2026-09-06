# Spec: Gruppe über einen Einladungslink beitreten (#1226)

Status: rot (Spec-Phase) — Tests in `server/src/express/groups-invite-links.api.test.ts` und
`frontend/e2e/groups-invite-links.spec.ts`.

## Ziel

Gruppen-Admins erzeugen teilbare Einladungslinks (Token, 7 Tage gültig, jederzeit ungültig
machbar). Wer einen Link öffnet, sieht Gruppenname und Anzeigename des Einladenden — ohne
angemeldet zu sein — und tritt nach der Anmeldung mit einem Klick der Gruppe als `member` bei.
Der Linkpreisgabe ist bewusst minimal: keine Mitgliederliste, keine E-Mails.

## Datenmodell (Vertrag)

- `GroupInviteLink` (`server/src/models/groupInviteLink.ts`, neu, Registrierung in
  `server/src/models/index.ts`): `id` (Autoincrement-PK), `groupId`, `token` (String,
  **unique**, aus `crypto.randomBytes`, hex ≥ 32 Zeichen), `createdByUserId`, `expiresAt`
  (Erzeugung + 7 Tage), `revokedAt` (null bis Ungültigmachung), `createdAt`. `sequelize.sync()`
  — keine `migrate.ts`-Änderung.
- „Gültig“ heißt: nicht abgelaufen (`expiresAt` > jetzt) und nicht widerrufen (`revokedAt` null).

## API-Vertrag

| Route                               | Verhalten                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /groups/{id}/invite-links`    | Nur `role='admin'` der Gruppe (hinter `requireAuth`). → 201 mit `token` (String, Länge ≥ 32) und `id`; jeder Aufruf erzeugt einen **neuen, anderen** Token. Nicht-Admin-Mitglied → 403. Nicht-Mitglied (auch unbekannte Gruppe) → 404.                                                                                                                        |
| `GET /invite-links/{token}`         | **Öffentlich** — vor `app.use(requireAuth)` gemountet (`express/index.ts:201`, Muster `/api/transit` :198). Gültiger Link → 200 `{name, invitedByName}` (Gruppenname, Anzeigename des Erzeugers) — **nur** diese zwei Felder, insbesondere kein `members`, keine `email`. Unbekanntes Token → 404. Abgelaufenes oder widerrufenes Token → 410.                |
| `POST /invite-links/{token}/redeem` | Hinter `requireAuth`. Ohne Session → 401 (globales Gate). Gültiger Link + noch kein Mitglied → 200 mit `groupId`; Anrufer wird `GroupMember` mit `role='member'` (Transaktion, keine Doppel-Zeile). Anrufer ist bereits Mitglied — ob durch früheres Einlösen desselben Links oder anderweitig — → 409. Unbekanntes Token → 404, abgelaufen/widerrufen → 410. |
| `DELETE /invite-links/{id}`         | Nur `role='admin'` der Gruppe. → 204, setzt `revokedAt`; anschließend ist sowohl das Einlösen als auch das öffentliche GET 410. Nicht-Admin-Mitglied → 403. Fremde Gruppe → 404.                                                                                                                                                                              |

**Spec-Entscheidung (Randbedingung der Analyse):** „Redeem durch bereits anderweitig Mitglied
gewordenes Konto“ = 409 wie Zweit-Einlösen — kein stiller Erfolg, kein Duplikat in `group_members`.

## Frontend-Vertrag

- Öffentliche Route `/gruppen/beitreten?token=…` als Weiche **vor** dem Auth-Gate in
  `frontend/src/Root.tsx` (Muster `/bahn`, `Root.tsx:145`); der Token-Query überlebt den
  Login-Roundtrip (returnTo, `Root.tsx:109-113`). Unangemeldet: erst Login, dann automatisch
  zurück auf die Beitrittsseite.
- Beitrittsseite (`frontend/src/components/GroupJoinPage.tsx`, neu): ein Screen, eine Aufgabe —
  Gruppenname + Einladender als Kontext, genau eine Primäraktion „Gruppe beitreten“. Vier
  gestaltete Zustände (KI-UX-Block): Laden (`KolSpin` mit `_label`), Fehler (unbekannt/abgelaufen/
  widerrufen → gemeinsame freundliche `KolAlert`-Meldung „Einladung nicht mehr gültig“ mit
  Handlungshinweis, nie ein nackter Statuscode), Erfolg nach dem Einlösen, Sonderfall 409
  („Du bist bereits Mitglied dieser Gruppe“) als eigener Zustand statt Fehler-Alarm. Beim Einlösen
  Button deaktivieren/spinnen, Doppeltaps ignorieren.
- Nach erfolgreichem Beitritt: Weiterleitung in die Gruppenansicht (UX-Empfehlung im KI-UX-Block,
  advisory).
- Admin-Bereich in `frontend/src/components/GroupDetail.tsx` („Einladungen“, unterhalb der
  Nutzersuche): „Link erzeugen“ → der frische Link ist einmal voll sichtbar mit Kopieren-Aktion
  (Clipboard, Inline-Rückmeldung „Link kopiert“), danach in der Liste der offenen Links nur noch
  maskiert/Ausschnitt + Ablaufdatum. „Ungültig machen“ ist destruktiv → Bestätigungsdialog nach
  dem bestehenden `Modal`-Muster (`pendingRemoval`, `GroupDetail.tsx:212-236`, Initial-Fokus auf
  „Abbrechen“).
- Mobile (AK6): eine Spalte, Karte voll breit, Inhaltsbreite begrenzt; Primäraktion im unteren
  Drittel in voller Breite; Touch-Targets ≥ 44 px (`--a11y-min-size`).

## Akzeptanzkriterien → Tests

| AK                                                   | Test                                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| AK1 (201 + Token ≥ 32, Nicht-Admin 403)              | `groups-invite-links.api.test.ts` „POST …/invite-links“ (2 Tests)                                                          |
| AK2 (öffentliches GET, Feldminimierung, 404/410)     | `groups-invite-links.api.test.ts` „GET /invite-links/{token}“ (3 Tests)                                                    |
| AK3 (redeem 401/Member/409)                          | `groups-invite-links.api.test.ts` „POST …/redeem“ (2 Tests)                                                                |
| AK4 (DELETE invalidiert → 410)                       | `groups-invite-links.api.test.ts` „DELETE /invite-links/{id}“                                                              |
| AK5 (Beitrittsseite angemeldet: Kontext + Beitreten) | `groups-invite-links.spec.ts` (e2e)                                                                                        |
| AK6 (375 px ohne horizontales Scrollen)              | `groups-invite-links.spec.ts` (e2e, Bounding-Box — bewusst **nicht** `scrollWidth`, App-Shell clippt `overflow-x: hidden`) |

Rein visuelle KI-UX-Forderungen (Fokus-Ring, Kontraste, Dunkelmodus, Daumen-Zone) sind in AK6
nicht messbar vertragbar und werden visuell verifiziert — kein Testzwang laut SKILL.

## Offene Fragen

- Keine blockingen; die 4 UX-Fragen des KI-UX-Blocks sind im Frontend-Vertrag mit den
  Empfehlungen entschieden (Landung → Gruppenansicht, gemeinsame Meldung für 404/410/widerrufen,
  Link einmal voll + danach maskiert, 409 als eigener Zustand). Der Autor kann sie dort
  abweichend entscheiden, ohne die roten Tests zu berühren.
