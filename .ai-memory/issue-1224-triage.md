# Issue 1224 — Triage (Phase 1), Stand 2026-09-05T16:03:37Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar vorhanden; einziger Kommentar = github-actions-Qualitätscheck `IC_kwDONloM188AAAABSnROgQQ` 2026-09-04T17:22:28Z, keine Entscheidungen). Harness-Kommentar neu erstellt (https://github.com/deleonio/priority-pilot/issues/1224#issuecomment-5553038698) mit KI-ANALYSE-Block (stand=2026-09-05T16:03:37Z) + Routing-Tabelle. Labels: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (Endstand verifiziert). Kein Ping, Titel unverändert („Benachrichtigung, wenn jemand eine Aufgabe für mich anlegt" — treffend), kein Body-Edit (ADR 0009), kein Split (ein PR: Logik-Modul + Handler-Hook + Router-Fabric + Tests), kein Auto-Close (Anforderung nicht implementiert — kein taskCreatedNotification-Code auf main).

## Erledigt
- Issue geladen, Trigger als Initial-Triage bestimmt (nur Bot-Qualitätskommentar, keine Entscheidungen im Thread).
- Alle Issue-Code-Referenzen verifiziert (s. Relevante Stellen); Issue ist außergewöhnlich gut vorbereitet (Teil von #952, baut auf gemergtem #1213 auf).
- Analyse-Block + Routing-Tabelle via `.ai-memory/issue-1224-comment.md` + `gh issue comment --body-file` erstellt.

## Relevante Stellen
- `server/src/express/routes/tasks.ts:430-494` — POST /tasks: #1213-Logik liefert `requester` (Session-Nutzer via `resolveGeoUser`) und `recipientId` (Body-`userId`, 403 ohne geteilte Gruppe, Transaktion um `Task.create` mit `createdById`). Hook-Punkt: nach Commit/201 — Versand darf Transaktion und Antwort nicht blockieren.
- `server/src/express/routes/tasks.ts:368` + `server/src/express/index.ts:8,208` — `tasksRouter` ist modulweiter Router OHNE Deps (`app.use(tasksRouter)`); `AppDeps.pushSender` (index.ts:49) erreicht nur `createPushRouter` (index.ts:244). → Fabric-Umstellung `createTasksRouter(deps)` nach createPushRouter-Vorbild nötig (AK6, im Analyse-Block verankert).
- `server/src/logics/push.ts:31,39,56` — `PushSender`-Typ, `sendPushToUser(userId, {title, body?, url?}, send)` mit 404/410-Selbstheilung; injizierbarer `send`-Param.
- `server/src/models/notificationLog.ts:52` — Unique-Index `['kind','dedupeKey']`; Dedupe-Claim-Muster in `server/src/logics/dailyTopTasks.ts:99-105` (findOne → senden → create), KIND-Konstanten bisher: `'due-task'` (dueTaskReminders.ts:13), `'daily-top-tasks'` (dailyTopTasks.ts:15).
- `server/src/models/user.ts:13,40` — `displayName` (fällt auf E-Mail zurück) = „Anzeigename von A" für den Nachrichtentext.
- `server/src/test/helpers.ts:119-123` — `startTestServer(deps: AppDeps)` → `createApp({...deps, sessionStore})`: PushSender-Mock-Injektion für API-Tests steht bereit.
- `server/src/express/tasks-created-by.test.ts` — Test-Gerüst-Vorbild: Rollen Alice (admin)/Bob (member)/Carol, GroupMember-Seeding am Modell, `server.login`, `postTask(..., {userId})`; neue Test-Datei `tasks-created-notification.test.ts` daneben.
- `frontend/src/components/SettingsPage.tsx` — nur Kontextangabe des Issues (Push-Opt-in existiert dort); KEINE UI-Änderung → ux=nein.

## Annahmen
- `kind='task-created'` (Name nicht vom Autor vorgegeben; im Analyse-Block als „z. B." markiert — Spec-Phase kann final benennen).
- Dedupe-Key = Task-Id (Issue: „dedupeKey aus der Aufgaben-Id") — reicht, weil Task genau einen Empfänger hat; Erstellungs-Retries erzeugen neue Task-Ids (neue Nachricht legitim).
- Auslöser ausschließlich POST /tasks (Issue nennt ihn explizit); Series-Generierung/Subtask-Pfade sind NICHT Scope.
- Routing (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) folgt dem etablierten Muster (#1083, #1101: reines Backend-Feature).

## Verworfen
- UX-Lauf — kein UI-Bezug; SettingsPage nur als Bestands-Kontext genannt.
- Split — Logik + Hook + Fabric + Tests bilden einen zusammenhängenden AK-Satz, ein PR.
- Titel-/Body-Edit — Issue präzise; Body-Edit verboten (ADR 0009).
- `recherche`-Subagent (ADR 0008) — API-Fehler 400 „modelCode does not exist" (glm-5.3-flash); Direktrecherche per Grep/Read erledigt (gleiche Informationen, kein Qualitätsverlust).
- MEMORY.md-Eintrag — kein neues dauerhaftes Learning (Subagent-Fehler war einmaliger Umgebungs-Blip; im Zweifel kein Eintrag).

## Offen
- `.ai-memory/issue-1224-comment.md` ist Wegwerf-Artefakt (gesendeter Kommentar-Stand) — NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests TF1–TF6 in neu `server/src/express/tasks-created-notification.test.ts` (Gerüst aus tasks-created-by.test.ts kopieren, `startTestServer({pushSender: mock})`), Draft-PR auf Branch `ai/harness/1224`.

## Fallstricke
- Versand erst NACH der Transaktion auslösen — ein Push-Fehler darf den Commit nicht zurückrollen (AK4) und die 201-Antwort nicht aufhalten (Issue-Randbedingung).
- `tasksRouter`→Fabric berührt alle anderen Tasks-Routen nur mechanisch (Wrap, Semantik unverändert) — vorhandene Tests tasks-*.test.ts müssen grün bleiben.
- Dedupe-Claim-Reihenfolge (vor/nach Versand) ist Spec-Entscheidung; Unique-Index fängt Race, `findOne`-Check im dailyTopTasks-Muster ist der Vorlagenweg.
- Kein Scheduler-Eintrag — Auslöser ist der Route-Call; `startScheduler`/`PUSH_REMINDERS_ENABLED` bleiben unberührt.
- Push-Payload-Vertrag `{title, body?, url?}` einhalten (push-sw.js liest genau diese Felder); `url?` kann auf die Aufgabe zeigen — Detail der Spec.
- node:t.skip-Muster: nach `t.skip()` immer `return` (MEMORY 2026-08-25); server-Tests lokal ohne Redis rot (session.test.ts) — Gates auf frontend beschränken, CI hat Redis (MEMORY 2026-08-29).
