# Issue 1213 — Spec (Phase 3), Stand 2026-09-04

## Erledigt
- Branch `ai/harness/1213` auf `origin/ai/harness/1213` (7b67e44f) gesetzt — Triage- + UX-Notizen lagen dort bereits; kein Draft-PR existierte (Idempotenz geprüft: `gh pr list` leer).
- Spec `docs/spec/issue-1213.md` erstellt: API-Vertrag (TaskCreate `userId?: number`; Task-DTO neu `createdById`/`createdByName`/`forUserId`/`forUserName`, alle nullable) + AK1–AK8 mit KI-UX-Anforderungen (Lade-/Fehlerzustand Select, Badge in `task-tree-badges`, Bounding-Box statt scrollWidth).
- Rote Tests geschrieben und Rot-Zustand verifiziert:
  - `server/src/express/tasks-created-by.test.ts` — 6 Tests, ALLE rot (201 statt 403 bzw. fehlende DTO-Felder). Gelaufen mit `NODE_ENV=test DATABASE_STORAGE=:memory: node --import tsx --test` im `server/`-Verzeichnis.
  - `frontend/src/components/TaskForm.test.tsx` — neuer Describe „Empfängerauswahl (#1213 AK7)“; „mit Gruppe“ rot (fehlendes `select-Empfänger`), „ohne Gruppe“ grün (Guard, bekommt Zähne erst mit der Impl). API-Mock um `listGroups`/`getGroupMembers` (leere Defaults) erweitert.
  - `frontend/src/components/QuickCaptureModal.test.tsx` — neuer Test rot (kein `kol-single-select[_label="Empfänger"]`); 3 Bestandstests grün. `vi.mock('../api')` ergänzt (vorher kein API-Mock in der Datei).
  - `frontend/e2e/groups-foreign-task.spec.ts` — 2 Tests, beide rot an der Naht `getByLabel('Empfänger')` (Gruppen-Setup, Einladung, API-Annahme laufen durch).
- Gates: prettier (2 Dateien nachformatiert), eslint (alle 4 Test-Dateien clean), tsc --noEmit frontend+server clean; Chromium für Playwright installiert (MEMORY 2026-08-20).

## Relevante Stellen
- `server/src/express/routes/tasks.ts:308-345` — GET /tasks (`ownerScope`), POST (Session-`userId`), GET/PATCH/DELETE `/tasks/:id` (findOwnTask → 404-Muster) — hier entsteht die Empfänger-Logik.
- `server/src/express/routes/groups.ts:56` (findMembership) + `:235` (displayNameOf) — Vorlagen für Gruppen-Check und E-Mail-Fallback.
- `server/src/express/routes/groups.ts:299-412` — Einladungs-API; im Server-Test umgangen (Gruppe direkt per `Group`/`GroupMember`-Modell geseedet).
- `frontend/src/api.ts:284,331` — `api.listGroups`, `api.getGroupMembers` (gemockt in beiden Komponententests).
- `frontend/src/lib/auth.ts:12` — `checkAuth` = roher fetch `/api/v1/auth/me`; Spec sagt: eigenes Konto für die Vorbelegung kommt daher (Test stubbt global fetch).
- `frontend/src/components/TaskForm.test.tsx:120-143` — KolSingleSelect-Mock als natives `<select>` mit `data-testid="select-<label>"`.
- `frontend/e2e/fixtures.ts:31` — `/auth/me` der Haupt-Page gemockt (id 1, „Test User“); Empfänger-Kontext bekommt echtes `/auth/me` über Session-Cookie.
- `frontend/e2e/series-rhythm.spec.ts:96-98` — KolSingleSelect-Interaktionsmuster (`getByLabel(...).click()` + `getByRole('option')`).

## Annahmen
- DTO-Vertrag (4 neue Felder statt nur `createdById`) ist Spec-Entscheidung: Frontend braucht Creator-Name (AK4) UND Empfänger-Name (AK5, „Für: Name“).
- „eigenes Konto vorbelegt“ = aus `GET /auth/me` (checkAuth) — TaskForm kennt sonst keine eigene Identität. Falls die Impl stattdessen eine andere Quelle nutzt, müssen die Tests mit (Vertrag ist in der Spec dokumentiert).
- QCM-Test ruft den Überspringen-Handler direkt über die `_on`-Eigenschaft am Host-Element (KoliBri in jsdom inaktiv, kein Shadow-DOM-Button) — entspricht dem Attribut-/Prop-Lesestil der Bestandstests dieser Datei.
- E2E-Annahme „Erstellt von: “-Text beim Empfänger ohne konkreten Namen (Regex) — Creator-Anzeigename im Pass-Through-Modus ist die Dev-E-Mail, nicht „Test User“.

## Verworfen
- Gruppen-Setup im Server-Test über die Einladungs-API — doppelter Aufwand; Modell-Seeding reicht (Gruppen-API ist durch #1211/#1212-Tests abgedeckt, dedup).
- AK6-Test mit `?? null`-Fallbacks — wäre pre-impl grün gewesen (undefined ?? null = null); jetzt ohne Fallback, rot bis die Felder existieren und null liefern.
- `getByRole('button', {name:'Überspringen'})` im QCM-Test — kol-button hat in jsdom keine Rolle; ersetzt durch `_on.onClick`-Direktaufruf.
- Zweiten Empfänger-375px-Test ohne UI-Flow (API-Setup) — POST mit `userId` existiert pre-Impl nicht; UI-Flow ist ohnehin der realistische Weg.

## Offen
- `.ai-memory/issue-1213-harness.md` (Harness-Kommentar-Kopie) ist Wegwarf-Artefakt, untracked, NICHT committen.

## Nächster Schritt
- Impl-Phase: Draft-PR fortführen, DTO-Felder + POST-`userId` + Lese-Scope-OR + Migration umsetzen, TaskForm/QuickCapture/TaskTree-UI, openapi.yml + Client-Typen regenerieren.

## Fallstricke
- Pre-Commit läuft tsc/knip über die Workspaces — Tests typechecken sauber; falls knip die neuen Test-Dateien moniert: `pnpm knip` über Root-Skript gegenprüfen (MEMORY 2026-09-02).
- Schreib-Scope NICHT mit öffnen: PATCH/DELETE bleiben `ownerScope` — AK5-404-Tests sichern das; Lese-Scope-OR muss NULL-sicher sein (AK6).
- Migration (Spalte `tasks.createdById`) VOR `sequelize.sync()` in `server/src/index.ts` einhängen (Triage-Notiz).
- Im QCM-Test bleibt KoliBri ungemockt — nach der Impl darf TaskForm beim Mount keine weiteren API-Aufrufe machen, die der Mock nicht abdeckt (sonst jsdom-Netzwerkfehler).
- E2E: Empfänger-Kontext braucht eigenen `page.route`-Mock NICHT — echtes `/auth/me` klappt über Session-Cookie (groups-invitations-Präzedenz).
- `_value`-Vergleich im QCM-Test als String (`'1'`) — falls die Impl number reicht, `String(...)` im Test beachten.
