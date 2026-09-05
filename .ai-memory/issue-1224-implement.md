# Issue 1224 — Implement (Phase 4), Stand 2026-09-05

## Erledigt
- Draft-PR #1240 (Branch `ai/harness/1224`) übernommen; Spec-Tests `tasks-created-notification.test.ts` zunächst 5/6 grün.
- Neues Modul `server/src/logics/taskCreatedNotification.ts` — `notifyTaskCreated(task, creator, send?)`: Dedupe-Claim via `NotificationLog.findOne({kind:'task-created', dedupeKey:String(task.id)})`, Versand über `sendPushToUser`, Log-Create nur bei `sent > 0` (Muster `dailyTopTasks.ts:99-105`).
- `server/src/express/routes/tasks.ts`: `tasksRouter` → Factory `createTasksRouter({ pushSender })` (mechanischer Wrap, alle Routen unverändert, +1 Tab); POST-Handler ruft `notifyTaskCreated` nach dem Transaction-Commit nur bei `recipientId !== null`, Restfehler → `console.warn` (AK2/AK4).
- `server/src/express/index.ts:209` — `app.use(createTasksRouter({ pushSender: deps.pushSender }))` (AK6).
- Test-Pflege (dokumentiert im PR-Body): `assert.notInclude` existiert in `node:assert/strict` nicht (Test-Datei Z.190 crashte unabhängig von der Implementierung) → `assert.ok(![...].includes(...))`, Botschaft unverändert.
- Gate komplett grün: `pnpm format`, `prettier --check .`, `pnpm lint`, `pnpm knip`, `pnpm test` (789 Tests, 788 pass, 0 fail — 1 skip Redis). e2e übersprungen (keine UI-Änderung), im PR-Body vermerkt.
- Server-Suite separat vorab: `NODE_ENV=test DATABASE_STORAGE=:memory: npx tsx --test src/**/*.test.ts` aus `server/` → 788 pass / 0 fail.

## Relevante Stellen
- `server/src/logics/taskCreatedNotification.ts` — neuer Auslöser, `KIND = 'task-created'`.
- `server/src/express/routes/tasks.ts:~495-510` — Hook im POST-Handler nach `sequelize.transaction`; `pushSender` aus den Factory-Deps.
- `server/src/express/index.ts:209` — Fabric-Verdrahtung.
- `server/src/logics/push.ts:47-92` — `sendPushToUser` behandelt Sender-Fehler je Subscription selbst (404/410 → destroy, sonst `console.warn`) — davon lebt AK4.

## Annahmen
- Versand wird vor der 201-Antwort abgewartet (Fehler gefangen) — bewusste Abweichung von „Antwort wartet nicht auf den Push“: Fire-and-Forget machte TF4 (Warn-Assertion nach `await postTask`) zur Race; im PR-Body begründet.
- `requester.displayName` ist im Handler stets vorhanden (Test setzt displayName beim Login); `null`-Fallback `'Jemand'` nur für Dev-Pass-Through.

## Verworfen
- Tests umschreiben über die notInclude-Stelle hinaus — nur die kaputte Assert-Zeile ersetzt (Test-Trennung, Pflege im PR-Body dokumentiert).
- Fire-and-Forget-Versand (`void notify...`) — TF4 wäre nicht-deterministisch; s. Annahmen.

## Offen
- -

## Nächster Schritt
- Review-Phase (`ai:needs-review`): PR #1240 ist review-ready; Kreuzverhör prüft insbesondere die Await-Abweichung und den Wrap-Diff.

## Fallstricke
- `tasks.ts` hat Hilfsfunktionen NACH den Routen-Registrierungen — der Wrap hat sie mit eingerückt (Factory-Scope); Referenz aus Handlern bleibt gültig (Laufzeit nach Definition), tsc/lint grün.
- Untracked `.ai-memory/issue-1224-*.md` auf main kollidieren mit dem auf dem Branch getrackten Pendant → vor `git switch` beiseitekopieren und zurückspielen.
- AK5-Test enthielt `assert.notInclude` (kein node:assert-API) — bei roten Spec-Tests zuerst prüfen, ob der Rot-Grund die Implementierung überhaupt erreicht.
