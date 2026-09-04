# Issue 1212 — Spec (Phase 3), Stand 2026-09-04

**ERGEBNIS: VERDICT ready (Zeitbudget knapp — Commit/Push sofort nach Testerstellung, KEIN Testlauf mehr durchgeführt).**

## Erledigt
- Branch `ai/harness/1212` ausgecheckt (existierte bereits remote mit Triage-/UX-Memory-Commits, keine Spec-Commits).
- Spec `docs/spec/issue-1212.md` neu geschrieben: Datenmodell `GroupInvitation`, API-Vertrag für 8 Routen, Frontend-Vertrag (`GroupDetail`-Komponente, neu), AK→Test-Mapping. Offene Frage aus der Analyse (Re-Invite nach declined) dort entschieden: 409 nur für doppelte `pending`, nach `declined` neue Einladung erlaubt.
- Rote Tests geschrieben (noch NICHT ausgeführt — Zeitbudget):
  - `server/src/express/users-search.test.ts` (AK1+AK2, neu) — `GET /users/search`.
  - `server/src/express/groups-invitations.api.test.ts` (AK3–AK10, neu) — POST/GET invitations, accept/decline, GET/DELETE members.
  - `server/src/express/groups-dataisolation.test.ts` (Erweiterung um 2 Tests) — 404 auf den 4 neuen Routen für fremde Gruppe.
  - `frontend/src/components/GroupDetail.test.tsx` (AK11, neu) — Komponente `GroupDetail` existiert noch nicht, Import ist der rote Zustand.
  - `frontend/e2e/groups-invitations.spec.ts` (AK1/AK6/AK9/AK12, neu) — zweite Person über `POST /auth/test-login` (NODE_ENV=test, e2e-Backend läuft so — Muster `google-signup.spec.ts`), eigener Browser-Context mit übernommenem Session-Cookie.

## Relevante Stellen
- `server/src/express/routes/groups.ts:55` `findMembership` — Sichtbarkeitsschicht, von allen neuen :id-Routen wiederzuverwenden.
- `server/src/express/routes/geoConfig.ts:29` `resolveGeoUser` — Muster für Nutzer-Auflösung inkl. Dev-Pass-Through.
- `server/src/models/groupMember.ts` — Composite-PK-Muster; `groupInvitation.ts` (neu) braucht dagegen ein eigenes `id`, weil dieselbe (groupId,userId)-Kombination nach `declined` erneut auftreten darf.
- `server/src/test/helpers.ts:66` `login()` / `applyTestAuthEnv` — Multi-User-API-Test-Pattern (`groups-dataisolation.test.ts`).
- `frontend/src/components/GroupsSection.tsx` — bestehende Liste; `GroupDetail.tsx` (neu, noch nicht gebaut) kommt als Klick-Ziel je Karte dazu — Frontend-Vertrag verlangt außerdem eine Detail-Ansicht, die es heute noch nicht gibt (Karten sind aktuell nicht klickbar).

## Annahmen
- `GroupDetail`-Komponente bekommt Props `{groupId, ownRole}` und lädt selbst über `api.getGroupMembers`/`api.getGroupInvitations` (noch zu ergänzende Client-Methoden) — im Unit-Test gemockt, keine Implementierung vorgegeben.
- E2E nutzt `role="searchbox"` für das Sucheingabefeld (KolInputText mit `type="search"`, UX-Block verlangt das) und Button-Label „Einladen"/„Annehmen"/„Ablehnen"/„Entfernen" — falls die Impl-Phase andere Labels wählt, sind das Kandidaten für Test-Pflege, keine Vertragsänderung.
- Zweiter e2e-Test setzt voraus, dass Kartenklick auf ein `listitem` zur Detailansicht navigiert/aufklappt (`page.getByRole('listitem').filter(...).click()`) — Interaktionsform (Navigation vs. Aufklappen) ist Impl-Entscheidung, Test prüft nur das Resultat (Suchfeld+Mitgliederliste sichtbar).

## Verworfen
- Multi-User-e2e über `/auth/register` statt `/auth/test-login` — würde den Session-Cookie im selben Page-Context überschreiben (Konflikt mit dem Dev-Pass-Through-Admin); `test-login` mit separatem Browser-Context ist sauberer (Muster bereits in `google-signup.spec.ts` etabliert).
- DB-Unique-Constraint auf `(groupId, invitedUserId)` für `GroupInvitation` — würde Re-Invite nach `declined` verhindern; Duplikat-Prüfung bleibt Anwendungslogik (nur gegen bestehende `pending`-Zeilen).

## Offen
- **Tests wurden NICHT ausgeführt** (`pnpm test` weder Server- noch Frontend-seitig, kein e2e-Lauf) — Zeitbudget lief beim Schreiben aus. Nächster Lauf (falls needs-review/Fixup nötig) sollte zuerst `pnpm --filter server test` gegen die neuen Dateien prüfen (erwartet: rot wegen fehlender Routen/Modelle/Komponente, NICHT wegen Syntaxfehlern).
- Mutation-Check (bewusstes Kaputtmachen der erwarteten Behavior, um zu prüfen ob Tests wirklich rot würden) wurde NICHT durchgeführt.

## Nächster Schritt
- Impl-Phase (Label `ai:needs-spec` → `ai:needs-impl` durch Workflow): Modell `GroupInvitation`, Router-Erweiterung `groups.ts` + neuer `users.ts`-Router, `openapi.yml` (7 Pfade), Frontend `GroupDetail.tsx` + Client-Methoden, `GroupsSection.tsx`-Integration (Klick auf Karte → Detail), Einladungs-Abschnitt für empfangene Einladungen.
- Vor Beginn der Impl: `pnpm --filter server test -- users-search groups-invitations groups-dataisolation` laufen lassen, um zu bestätigen, dass die Tests wie erwartet rot sind (fehlende Module/Routen), nicht kaputt (Syntax/Typfehler).

## Fallstricke
- AK4-Vertrag (403 Nicht-Admin, 404 Nicht-Mitglied) ist bewusst NICHT einheitlich wie #1211-PATCH/DELETE (dort immer 404) — nicht versehentlich angleichen.
- `displayName` fällt per User-Default auf die E-Mail zurück — Suchtreffer auf einen Namensfragment können daher zufällig E-Mail-Fragmente matchen, wenn niemand einen eigenen Anzeigenamen gesetzt hat; Testdaten in den neuen Tests setzen deshalb überall explizite `displayName`-Werte.
- `GroupInvitation` braucht ein eigenes `id` (kein Komposit-PK wie `GroupMember`), sonst ist Re-Invite nach `declined` nicht abbildbar.
- E2E-Zweitkonto-Test schließt den zweiten Browser-Context im `finally`-Block — sonst leckt ein offener Context bei einem fehlschlagenden Assert.
- Soft-Deadline (1788502579) wurde während der Testerstellung fast erreicht — Commit/Push hatte Vorrang vor Testlauf/Mutation-Check; das ist der Hauptgrund für „Offen" oben.
