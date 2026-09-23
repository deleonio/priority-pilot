# Issue 1224 — Review (Phase 5), Stand 2026-09-05 (nach Soft-Deadline)

**ERGEBNIS: VERDICT reviewed (🟢), Review-Typ Kreuzverhör (Erstrunde).** PR #1240, collected comment https://github.com/deleonio/priority-pilot/pull/1240#issuecomment-5553378637. Kein Blocker, keine Entscheidungs-Findings, 3 Nits (nicht blockierend, als Inline-Kommentare 3941342112/3941342152/3941342204 gepostet). Titel-Gate: PR-Titel auf `feat(server): notify recipient when a task is created for them (#1224)` umbenannt (70 Zeichen).

## Erledigt
- MODE-Bestimmung: 0 Kommentare auf PR #1240 → kein `<!-- ai-review -->` → Kreuzverhör-Erstrunde.
- Diff komplett gelesen (1198 Zeilen); Fabrik-Umbau per `git diff -w origin/main origin/ai/harness/1224 -- server/src/express/routes/tasks.ts` auf 30 Insertions/1 Deletion echte Änderung verifiziert (restlich nur Re-Indent).
- AK1–AK6 (Harness-Kommentar) gegen TF1–TF6 gemappt: alle gedeckt, CI verify + e2e(1-4) SUCCESS, PR-Bericht 788 pass/0 fail/1 Skip (Redis).
- Test-Pflege-Behauptung empirisch verifiziert: `node -e "…typeof require('node:assert/strict').notInclude"` → `undefined` (PR-Begründung korrekt); `git diff ca51aa6dd 3906a0dc2 -- <testfile>` = genau diese eine Änderung, keine weitere Spec-Test-Verwässerung.
- Neighborhood (Subagent schlug fehl — Modell-Error 400, selbst recherchiert): kein anderer Import des alten `tasksRouter`-Exports; `AppDeps.pushSender` index.ts:49 → createTasksRouter index.ts:209 → startTestServer helpers.ts:119 (`createApp({...deps})`); `sendPushToUser(userId, payload, send=defaultSender)` fängt Fehler je Subscription selbst (push.ts, 404/410 Cleanup); NotificationLog Unique-Index kind+dedupeKey (models/notificationLog.ts:52); Spec-Vertrag `docs/spec/issue-1224.md` TF5 deckt exakt den implementierten Test (zweiter POST = neue Aufgabe), kein Widerspruch zur Issue-TF5-Formulierung.
- Collect-Artefakte: `.ai-memory/issue-1240-review-comment.md` (gesendet), `issue-1240-nit{1,2,3}.md` (Kommentar-Bodies).

## Relevante Stellen
- `server/src/express/routes/tasks.ts:494-511` — Auslöser nach Commit, nur bei `recipientId !== null`, Restfehler gefangen (tasks.ts:508 console.warn).
- `server/src/logics/taskCreatedNotification.ts:40-43` — Dedupe-Früh-Ausstieg; über POST unerreichbar (jeder POST = neue Task-Id) → Nit 1 (ungetesteter Zweig).
- `server/src/logics/push.ts` — `sendPushToUser` schluckt/protokolliert Versandfehler je Subscription → äußerer Catch in tasks.ts ist nahezu toter Code (Nit 2).
- `server/src/express/tasks-created-notification.test.ts:9,16` — Header noch „Rote Spec-Tests/Rot, bis …" (Nit 3).

## Annahmen
- CI-Status (verify + e2e SUCCESS) reicht als Grün-Nachweis; keine lokalen Server-Tests nachgefahren (startTestServer benötigt DB-Umgebung, CI lief ohnehin).
- AK1-Wortlaut „genau eine Push-Nachricht an Bs Abos" = je Abo genau ein Versand (2 Abos → 2 Aufrufe), wie Spec-Dok und Test es definieren.

## Verworfen
- Inline-Blocker/needs-fixup: keiner der Punkte hat Verhaltensrisiko → NIT-ONLY-Regel (keine ~45-Turn-Fixup-Runde).
- needs-human: Fabrik-Umbau ist Vorbild-Muster (createPushRouter), keine Produktfrage.
- MEMORY.md-Eintrag: kein neuer, wiederholbarer Fehler (Subagent-Modell-Error ist Umgebung, nicht Methode).

## Offen
- Soft-Deadline überschritten (Check lief im selben Call wie das Posten des Sammelkommentars — Kommentar war der Endstand, danach nur noch Memory + Verdict).
- Wegwerf-Artefakte in `.ai-memory/` NICHT committen: `issue-1240-review-comment.md`, `issue-1240-nit1.md`, `issue-1240-nit2.md`, `issue-1240-nit3.md`. Nur diese Datei (`issue-1224-review.md`) ist die echte Phasen-Notiz.

## Nächster Schritt
- `-` (Review abgeschlossen, verdict reviewed emittiert; Nits freiwillig für einen Folge-Commit).

## Fallstricke
- Subagent mit `model: haiku` schlug hier fehl (API 400 „model does not exist", glm-5.3-flash-Mapping) → Neighborhood-Fragen im Review-Fall direkt selbst greppen; Delegation nicht erzwingen.
- `git diff -w` zwischen main und PR-Branch ist der schnellste Beweis, dass ein Re-Indent-Wrap (Router-Fabrik) mechanisch ist.
- Issue-TF5-Formulierung („zweiter Auslöser derselben Aufgabe") vs. implementierter Test (zweiter POST = zweite Aufgabe) klingt nach Abweichung — Spec-Dok `docs/spec/issue-1224.md` (im selben PR) definiert TF5 so, wie getestet wird; erst Spec-Dok lesen, bevor man Dedupe-Abdeckung als Lücke meldet.
