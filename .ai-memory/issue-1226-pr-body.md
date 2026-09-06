## Implementierung (#1226)

Gruppen-Admins erzeugen teilbare Einladungslinks (7 Tage, jederzeit widerrufbar). Wer einen Link öffnet, sieht Gruppenname + Einladenden (ohne Session) und tritt nach der Anmeldung mit einem Klick bei. Details: `docs/spec/issue-1226.md`.

**Server** (aus der Impl-Phase)
- NEU `server/src/models/groupInviteLink.ts` (token unique, expiresAt, revokedAt) + Registrierung in `models/index.ts`.
- NEU `server/src/express/routes/inviteLinks.ts` — öffentlicher Router (Mount **vor** `requireAuth`, `express/index.ts:204`): `GET /invite-links/{token}` (Feldminimierung: nur `{name, invitedByName}`; 404/410) und `POST /invite-links/{token}/redeem` (401 ohne Session via Selbstcheck, Mitglied `member` in Transaktion, 409 auch bei anderweitig entstandener Mitgliedschaft).
- `routes/groups.ts`: `POST /groups/{id}/invite-links` (nur Admin, 201, `crypto.randomBytes` hex 48 Zeichen, TTL 7 Tage), `DELETE /invite-links/{id}` (204, setzt `revokedAt`; Mitglied 403, fremd/unbekannt 404). **Bewusst KEIN GET-Listen-Endpunkt** — der Token wird nur in der Erzeugungs-Antwort übermittelt, eine Liste offener Links gibt es serverseitig nicht (siehe Frontend).
- Fixup (Kreuzverhör-Runde 1): Membership-Check in die Transaktion gezogen; ein gleichzeitiger Zweit-Redeem, der den Composite-PK verletzt, antwortet jetzt ebenfalls **409** statt 500.

**Frontend** (Fixup-Runde 1, Commit d7bac7b1)
- `openapi.yml` — alle vier Pfade ergänzt (`POST /groups/{id}/invite-links`, `GET /invite-links/{token}`, `POST /invite-links/{token}/redeem`, `DELETE /invite-links/{id}`) + Schemas `GroupInviteLink`/`InviteLinkPreview`/`InviteLinkRedeemResult`; Client-Aliase in `client/src/index.ts`, Fassadenmethoden in `frontend/src/api.ts` (`schema.d.ts`/`api.d.ts` sind generiert und unversioniert).
- NEU `components/GroupJoinPage.tsx` — vier Zustände (Laden/KolSpin, „Einladung nicht mehr gültig“ für 404+410, 409 „bereits Mitglied“ als eigener Info-Zustand, Erfolg mit „beigetreten“); Button beim Einlösen deaktiviert (Doppeltaps ignoriert); eine Spalte, Karte max. 28 rem, Primäraktion in voller Breite (AK6, Bounding-Box-Prüfung).
- `Root.tsx` — öffentliche Weiche `/gruppen/beitreten` **vor** dem Auth-Gate (Muster `/bahn`); ohne Session startet der stille Google-Login mit der Beitrittsseite als `returnTo`, der Token-Query überlebt den Roundtrip.
- `GroupDetail.tsx` — Admin-Bereich „Einladungen“ unterhalb der Nutzersuche: Link erzeugen (einmal voll sichtbar + Kopieren mit Inline-Rückmeldung „Link kopiert“, danach maskiert `abcd … wxyz` + Ablaufdatum), „Ungültig machen“ im bestehenden `Modal`-Bestätigungsmuster (Initial-Fokus „Abbrechen“). Erzeugte Links leben bewusst im Komponenten-State — es gibt keinen serverseitigen Listen-Endpunkt.

## Testergebnisse (Stand Fixup-Push d7bac7b1)
- `tsc --noEmit` grün für server und frontend; Pre-Commit-Hook (lefthook) grün: `format`, `knip`, `lint`.
- **Verifikation über CI:** e2e `groups-invite-links.spec.ts` (AK5/AK6), API-Tests AK1–AK4 und die Workspace-Suiten — lokale Läufe standen im Fixup unter Zeitdruck an; die Ergebnisse sind dem CI-Lauf zu diesem Push zu entnehmen.

## Hinweise fürs Review
- GroupDetail hält erzeugte Links session-lokal im State: nach dem einmaligen Voll-Blick (mit Kopier-Aktion) ist der Token bewusst nie wieder voll sichtbar — auch nicht nach Neuladen. Das entspricht der Feldminimierung des Specs.
- Fehlerzustände 404/410 der Join-Seite teilen sich eine freundliche Meldung („Einladung nicht mehr gültig“), 409 ist eigener Zustand — wie im KI-UX-Block empfohlen.
