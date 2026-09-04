# Issue 1213 — Implement (Phase 4), Stand 2026-09-04

## Erledigt
- Quick-Check der Analyse (SKILL Step 2): Ampel 🟢, alle 13 betroffenen Dateien vorhanden (inkl. Spec-Doc + 4 rote Test-Dateien). Branch `ai/harness/1213` ausgecheckt (HEAD d7251ec1; lokale untracked Duplikate der Triage/Spec-Notiz entfernt — identisch mit Branch-Stand).
- Draft-PR **#1218** (OPEN, isDraft, closingIssuesReferences=[1213]) identifiziert → Spec-Mode.

## Relevante Stellen
- `server/src/express/routes/tasks.ts` — GET /tasks:308 (ownerScope → OR createdById), POST:359 (userId-Empfänger + Gruppen-Check), serializeTask:90 (4 neue DTO-Felder, viewer-abhängig).
- `server/src/models/task.ts:197` — `createdById` nullable analog `userId`.
- `server/src/logics/migrate.ts` + `server/src/index.ts:191` — idempotente Spalten-Migration vor sync().
- `openapi.yml` Task/TaskCreate + Regeneration `server/src/api.d.ts`, `client/src/schema.d.ts`.
- `frontend/src/components/TaskForm.tsx` — Empfänger-Select (nur Anlegen, nur mit ≥1 Gruppe, eigene ID aus checkAuth vorbelegt).
- `frontend/src/components/TaskTree.tsx` + `frontend/src/App.tsx:692,706` — Badges „Für:“/„Erstellt von:“ + Aktionen ausblenden bei `forUserId != null`.

## Annahmen
- DTO-Regel viewer-abhängig: `forUserId`/`forUserName` nur gesetzt, wenn Requester = Ersteller UND Aufgabe für einen anderen; `createdByName` = Ersteller-Name (E-Mail-Fallback), task-level. Getragen durch AK3-Test Zeile 134 (Empfänger-Sicht: forUserId null) + AK5 (Ersteller-Sicht: forUserId gesetzt).
- Ersteller-Identität im POST über `resolveGeoUser` (bereits in tasks.ts importiert): Session-User, sonst Dev-Nutzer — nur so funktioniert der e2e-Pass-Through-Ersteller („Für:“-Assertion), Unit-Tests laufen mit aktiver Auth und bekommen die Session-ID.
- PATCH/DELETE + GET /tasks/:id bleiben reines `ownerScope` (Analyse-Block: „Schreib-/Detail-Zugriffe unverändert“); /next, /suggestions, Series-Instanzen serialisieren die 4 Felder als null (Default-Kontext, DTO erlaubt null).
- TaskTree bekommt optionalen Prop `userId` (App hat `user: AuthUser`); „Erstellt von:“ nur wenn `forUserId == null && createdById != null && createdById !== userId`.

## Verworfen
- `userId` (Owner-ID) als 5. DTO-Feld für die Badge-Logik — Spec-Vertrag nennt exakt 4 Felder; Prop statt dessen.
- Ladezustand-Select mit Ladehinweis schon VOR Gruppen-Load — hätte den „ohne Gruppe“-Unit-Test gefährdet (Select-Fehler); Select erscheint erst nach bekannter, nicht-leerer Gruppenliste.

## Offen
- -

## Nächster Schritt
- Review-Phase: PR #1218 ist ready (nicht mehr Draft); Kreuzverhoer per review-kreuzverhoer.

---

## Abschluss (gleicher Lauf)

### Erledigt (zusätzlich)
- Server: `createdById`-Spalte (Modell + `migrateTaskCreatedById` vor sync), POST /tasks mit optionalem `userId` (403 ohne gemeinsame Gruppe), Lese-Scope `taskReadScope` (Op.or userId/createdById), `serializeTask(task, context)` mit 4 DTO-Feldern (viewer-abhängig, Namen per `loadUserNames`), GET /tasks + POST + GET /tasks/:id serialisieren mit Kontext; `map(serializeTask)`-Index-Fallen in express/index.ts:276 + series.ts:545 behoben (Lambda).
- openapi.yml: Task + 4 nullable Felder, TaskCreate + optionales `userId`; `server/src/api.d.ts` + `client/src/schema.d.ts` regeneriert (beide offenbar gitignored/nicht getrackt).
- Frontend: TaskForm-Empfängerauswahl (KolSingleSelect „Empfänger", nur Anlegen + ≥1 Gruppe, eigenes Konto via checkAuth vorbelegt, Dedupe über userId, Lade-/Fehlerzustand), userId im TaskCreate nur bei fremdem Konto; TaskTree-Badges „Für:"/„Erstellt von:" (neutral, ohne Hex) + Aktionen ausgeblendet bei forUserId != null; App übergibt `userId={user.id}` an beide TaskTree.
- Gates: format/prettier/lint/knip grün; Server-Tests 818: nach Test-Pflege grün; Frontend vitest 533 passed; e2e groups-foreign-task 2/2 grün (Chromium-Install nötig gewesen).

### Test-Pflege (im PR-Body dokumentiert)
- `server/src/logics/migrate.test.ts:330` — im Legacy-Fixture des #207-Tests `migrateTaskCreatedById` zur Liste der nachgezogenen Spalten ergänzt (Konvention des Tests selbst: alle von Task.findAll mitselektierten Spalten); Assertion unverändert.

### Verworfen (zusätzlich)
- `createdById` in SERIES_COLUMNS mitziehen (Präzedenz latitude/longitude) — Analyse verlangt eigene idempotente Funktion + index.ts-Eintrag; less surprising.

### Fallstricke (zusätzlich)
- `tasks.map(serializeTask)` bricht nach Signatur-Erweiterung (map-Index als 2. Parameter) — Lambda nötig.
- Playwright-webServer-Timeouts kamen vom tsc-Fehler im Backend (nodemon crash) — erst typechecken, dann e2e.

## Fallstricke
- e2e-Artefakt: Haupt-Page hat gemocktes /auth/me (id 1) während Backend-Dev-Nutzer andere ID hat → „Erstellt von:“-Badge kann auf selbst angelegten Tasks der Pass-Through-Seite erscheinen; nur E2E-Umgebung, keine reale Session-Konstellation.
- Bestehende TaskForm-Tests mocken listGroups→[] und stubben fetch NICHT → checkAuth erst NACH nicht-leerer Gruppenliste aufrufen (sonst Netzwerkfehler-Alert in jedem Test).
- Keine Hex-Farbe für neue Badges (KI-UX: neutral/muted, keine weiteren Hex-Werte).
