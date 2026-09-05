# Issue 1224 — Spec (Phase 3), Stand 2026-09-05

## Erledigt
- Branch `ai/harness/1224` übernommen (Triage-Commit bb97a4bb), kein offener PR vorhanden → Spec-Lauf regulär.
- Spec erstellt: `docs/spec/issue-1224.md` (Vertrag: neues `server/src/logics/taskCreatedNotification.ts`, Aufruf im POST /tasks-Handler nach Commit, kind `task-created`, dedupeKey = String(Task-Id), Tasks-Router → Fabric nach createPushRouter-Vorbild).
- Rote Tests: `server/src/express/tasks-created-notification.test.ts` — TF1–TF6 für AK1–AK6, Gerüst wie `tasks-created-by.test.ts` (Alice/Bob, Gruppe direkt geseedet, `startTestServer({ pushSender: mock })`). Lauf verifiziert: 4 rot (AK1/AK4/AK5/AK6 — Mock 0 Aufrufe, korrekter Rot-Grund „Codepfad fehlt"), AK2/AK3 grün (Negativ-Assertions, Regressions-Schutz). Kein Produktivcode.
- Commit + Push + Draft-PR (Titel = Issue-Titel wörtlich, `Closes #1224`).

## Relevante Stellen
- `server/src/express/routes/tasks.ts:430-503` — POST-Handler; #1213 liefert `requester` (resolveGeoUser) + `recipientId`; Versand-Hook NACH `sequelize.transaction`-Commit einhängen, vor/von `res.status(201)` unabhängig.
- `server/src/logics/push.ts:47-92` — `sendPushToUser(userId, payload, send)`; fängt Sender-Fehler selbst (404/410→destroy, sonst `console.warn`) → AK4-Protokollierung kommt aus hier, wenn der neue Code `sendPushToUser` nutzt.
- `server/src/models/notificationLog.ts:52` — Unique-Index `kind`+`dedupeKey`; bestehende kinds `due-task`/`daily-top-tasks` unangetastet.
- `server/src/express/index.ts:49,208,244` — `AppDeps.pushSender` erreicht bisher nur createPushRouter; tasksRouter ist modulweiter Router → Fabric-Umbau ist Impl-Aufgabe (Spec-PR enthält das bewusst NICHT).
- `server/src/test/helpers.ts:119` — `startTestServer(deps)` reicht `pushSender` durch (`createApp({...deps, sessionStore})`).
- `server/src/logics/dueTaskReminders.test.ts:33-37` — Mock-Sender-Muster (SendResult-Literal) übernommen.

## Annahmen
- Payload-Text: Titel ODER body muss Aufgabentitel + `displayName` des Erstellers enthalten (Test prüft kombiniert, lässt Impl die Verteilung offen).
- dedupeKey exakt `String(taskId)` (ohne Suffix) — Analyse nannte „aus der Aufgaben-Id"; Spec fixiert das, Impl hält sich daran.
- AK4-„protokolliert" = console.warn/error-Aufruf (Test spyst beide); falls Impl stattdessen einen Logger nutzt, Test in Impl-Phase anpassen.
- „Antwort wartet nicht auf den Push" nicht timing-getestet — über AK4 abgedeckt (werfender Sender → trotzdem synchrones 201).

## Verworfen
- „Zweiter Auslöser derselben Aufgabe sendet nicht erneut" als API-Test — für dieselbe Task-Id gibt es keinen zweiten API-Auslöser (zweiter POST = neue Task); stattdessen Vertragstest: Log-Zeile mit kind+dedupeKey je Task + zweiter POST bekommt eigenen dedupeKey (fängt Globales User-Dedupe).
- Erfolgs-Log-Assertionen zu AK4-Aufräumverhalten (404/410) — durch sendPushToUser abgedeckt (push.test.ts), kein Duplikat.
- Frontend-Tests — reine Server-Logik, Issue nennt SettingsPage nur als Opt-in-Kontext; kein UI-Verhalten neu.

## Offen
- -

## Nächster Schritt
- Impl-Phase: `taskCreatedNotification.ts` nach Spec-Vertrag bauen, Tasks-Router auf `createTasksRouter(deps)` umstellen, Hook nach Commit im POST-Handler; alle TF1–TF6 grün, danach alle bestehenden Server-Tests grün halten (insbesondere tasks-created-by.test.ts und push*.test.ts).

## Fallstricke
- Testlauf braucht Env: `NODE_ENV=test DATABASE_STORAGE=:memory:` — ohne das schlägt `server.login` mit 401 fehlt (falscher Rot-Grund).
- Server-`tsc --noEmit` ist ohne generiertes `src/api.ts` grundsätzlich rot (`Cannot find module '../api'`) — kein Spec-Phase-Problem; neuer Testdatei selbst tsc-clean.
- `resetDb()` in beforeEach löscht auch PushSubscription/NotificationLog → Seeding je Test nötig; `calls`-Mock in beforeEach zurücksetzen (Modul-Scope!).
- RED: pre-existing grüne AK2/AK3-Tests dürfen durch Impl nicht rot werden (Kein-Versand-Verträge).
