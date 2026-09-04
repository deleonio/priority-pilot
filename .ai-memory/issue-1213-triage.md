# Issue 1213 — Triage (Phase 1), Stand initial

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Validator 2026-09-04T02:23:31Z, keine Entscheidung). Analyse-Block + Routing-Tabelle als neuer Harness-Kommentar erstellt (issuecomment-5541327071), Labels: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (verifiziert). Kein Ping, Titel unangetastet („Aufgabe für ein Gruppenmitglied anlegen“ — treffend), kein Auto-Close (Feature fehlt komplett: kein `createdById` im Code).

## Erledigt
- Issue + alle Kommentare geladen, Trigger = Initial-Triage bestimmt.
- Codebasis verifiziert: Gruppen-Vorläufer #1211/#1212 gemergt — `server/src/models/{group,groupMember,groupInvitation}.ts` vorhanden; `groupsRouter` mit `GET /groups` (:98), `GET /groups/:id/members` (:238, MemberDto mit displayName), Membership-Check-Muster :56 (`GroupMember.findOne`), `displayNameOf` :235 (E-Mail-Fallback).
- `ownerScope` bestätigt in `server/src/express/requireAuth.ts:34`; genutzt in `tasks.ts:121,308,340,401`.
- Migrations-Muster bestätigt (`server/src/logics/migrate.ts:232` idempotent, PRAGMA-geführt); `task.ts:66-67` nullable `userId` als Vorbild für nullable `createdById`.
- Analyse-Block via `.ai-memory/issue-1213-block.md` + `gh issue comment --body-file` erstellt; Labels gesetzt und verifiziert.

## Relevante Stellen
- `server/src/express/routes/tasks.ts:308` — GET /tasks: `where: ownerScope(...)` → Lese-Scope um `createdById` erweitern (Sequelize-OR), Creator-Name per User-Join in `serializeTask`.
- `server/src/express/routes/tasks.ts` POST — optionales `userId` + Gruppen-Teilungs-Check (Muster `groups.ts:56`), 403 ohne gemeinsame Gruppe; `createdById` = Session-User.
- `server/src/express/routes/tasks.ts:121,340,401` — Schreib-/Detail-Zugriffe: `ownerScope` unverändert lassen (nur AK5-404-Fälle für Ersteller ergeben sich automatisch, da `ownerScope` nur `userId` matcht).
- `server/src/models/task.ts:197` — userId-Spalten-Definition; darunter `createdById` analog (nullable, FK User).
- `server/src/logics/migrate.ts` — neue idempotente Funktion + Aufruf in `server/src/index.ts` vor `sequelize.sync()`.
- `openapi.yml:1719,1826` — Schemas Task/TaskCreate erweitern (`createdById`, `createdByName`, `forUserId`-Kennzeichen o. ä.; DTO-Form ist Spec-Entscheidung).
- `frontend/src/components/TaskForm.tsx` + `QuickCaptureModal.tsx` — Empfängerauswahl (nur bei ≥1 Gruppe, Default eigenes Konto; Daten aus `GET /groups` + `/groups/:id/members`).
- `frontend/src/components/TaskTree.tsx` — Hinweise „Für: Name“ (Ersteller-Sicht) / „Erstellt von: Name“ (Empfänger-Sicht).

## Annahmen
- Masterplan-Widerspruch ist vom Autor selbst aufgelöst (Ersteller behält Lesezugriff, Schreiben nur Empfänger) — als verbindlich übernommen, keine needs-human-Frage nötig.
- Ein PR für Server+Frontend+Migration (Präzedenz #1083/#1098: ein zusammenhängender AK-Satz, API-Vertrag Teil desselben Features).
- Routing-Muster wie #1083 (ux/spec sonnet/medium, impl/review sonnet/high) — „Mittel“-Komplexität laut Issue.

## Verworfen
- Split in Server-/Frontend-Issues — ein AK-Satz, ein PR.
- Titel-Änderung/Body-Copyedit — Issue sehr präzise; Body-Edit per ADR 0009 verboten.
- MEMORY.md-Eintrag — Standardlauf, kein neues Fehlermuster.

## Offen
- `.ai-memory/issue-1213-block.md` ist Wegwerf-Artefakt (gesendeter Kommentar-Body), NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Empfängerauswahl im TaskForm/QuickCaptureModal + Listen-Hinweise — KoliBri-Select/Combobox, Mobile-First 375 px.

## Fallstricke
- AK8/TF8: „kein horizontaler Scroll“ per `element.scrollWidth <= window.innerWidth` ist laut Issue-AK formuliert, aber strukturell immer grün (App-Shell `overflow-x: hidden`) → Bounding-Box-Assertions nehmen (MEMORY 2026-08-24), im Analyse-Block TF8 so vermerkt.
- GET /tasks muss Creator-Anzeigenamen liefern — `User.displayName` ist optional, Fallback E-Mail nötig (`displayNameOf`-Muster groups.ts:235).
- Lese-Scope-Erweiterung (OR `createdById`) darf Schreib-Scope nicht aufweichen — PATCH/DELETE/GET/{id} bleiben `ownerScope`-basiert; Drittkonto-404 nur gewährleistet, wenn Show/Update/Delete nicht ebenfalls geöffnet werden.
- Bestandsaufgaben ohne `createdById` (NULL) — OR-Bedingung muss NULL-sicher sein (Sequelize `Op.or` mit `null`-Werten).
- Migration vor `sequelize.sync()` in `server/src/index.ts` einhängen, sonst schlägt sync auf fehlender Spalte fehl.
- QuickCaptureModal darf nicht vergessen werden (Issue nennt es explizit als zweiten Eingang).
