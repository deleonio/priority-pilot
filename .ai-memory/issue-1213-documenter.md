# Issue 1213 — Documenter (Phase 6), Stand 2026-09-04

## Erledigt
- PR #1218 analysiert (`gh pr view --json title,body,files,labels,author`, voller Diff via `gh pr diff 1218 > /tmp/full.diff`; per-Pfad-Filter-Args funktionieren mit dieser gh-Version nicht — `accepts at most 1 arg(s)`).
- Diff von `server/src/express/routes/tasks.ts` im Detail gelesen: `serializeTask(task, context)` mit `TaskSerializeContext` (requesterId/names), `loadUserNames` (Sammel-Query, displayName ?? email), `taskReadScope` (`Op.or: [{userId}, {createdById: requesterId}]`, NULL-sicher), `serializeTasksFor` über `resolveGeoUser`, POST-Empfängerprüfung (userId integer, sonst 400; fremde ID nur bei geteilter Gruppe via `GroupMember`, sonst 403 ohne Create).
- `/tmp/doc.json` geschrieben und mit `jq -e .` verifiziert (jq OK). Struktur exakt nach SKILL.md → Output.
- Einstufung: `new` (neuer Endpunkt-Parameter + DTO-Felder + UI), Titel leer gelassen (compliant = true, `feat(server): …` passt), `migration_en` leer (nicht breaking: neue Spalte nullbar, idempotente Migration, DTO-Felder additiv).
- `files`: 8 Einträge (tasks.ts, models/task.ts, logics/migrate.ts, TaskForm.tsx, TaskTree.tsx, openapi.yml, tasks-created-by.test.ts, groups-foreign-task.spec.ts). `issues`: `Closes #1213`.
- Kein `gh pr edit/comment/label` — nur lesend.

## Relevante Stellen
- `server/src/express/routes/tasks.ts:85-180` — serializeTask/Context, taskReadScope, serializeTasksFor (Kern der Server-Änderung).
- `server/src/express/routes/tasks.ts:445-487` — POST-Empfängerprüfung + `Task.create({userId: recipientId ?? userId, createdById: requesterId})`.
- `server/src/models/task.ts` / `server/src/logics/migrate.ts` — neue nullbare Spalte + `migrateTaskCreatedById`.
- `frontend/src/components/TaskForm.tsx` / `TaskTree.tsx` — Empfängerauswahl (AK7) bzw. Listen-Badges + ausgeblendeter Schreib-Popover (AK5, KI-UX).
- `openapi.yml` — DTO-/Create-Erweiterung (30 Zeilen additiv).

## Annahmen
- PR-Body-Abschnitte (Spec-Phase + Implementierung, Autor app/my-github-action-bot) stimmen mit dem Diff überein — Diff-Stichprobe (tasks.ts) bestätigt.
- Frontend-Detailaussagen (KolSingleSelect, Deduplizierung, Badge-Texte) aus dem PR-Body übernommen, nicht zeilenweise im Diff verifiziert.
- Titel-Compliance und type/scope (feat/server) wie vom aufrufenden Prompt vorgegeben übernommen.

## Verworfen
- Titelumbenennung — vorhandener Titel konventionskonform und typrichtig → `title` leer.
- `breaking` — DTO nur additive Felder, Spalte nullbar + idempotente Migration, kein Vertragsbruch.
- `internal` — klare Nutzerfunktion (Aufgabe für Gruppenmitglied), When-in-doubt-NOT-internal greift nicht.
- `.ai-memory/*`- und `docs/spec/issue-1213.md` in `files` — Harness-/Dok artefakte, nicht relevanter Code (SKILL: 3-8 relevanteste).

## Offen
- Wegwerf-Artefakte: `/tmp/doc.json`, `/tmp/full.diff` (außerhalb des Repos, kein Commit-Bedarf).

## Nächster Schritt
- `-` (Phase abgeschlossen; Output liegt unter `/tmp/doc.json`, Abholung durch den aufrufenden Workflow).

## Fallstricke
- `gh pr diff <nr> -- pfad1 pfad2` wird von der installierten gh-Version nicht unterstützt → kompletten Diff in eine Datei holen und per awk über die `diff --git`-Grenzen schneiden.
- `forUserId`/`forUserName` sind bewusst nur aus Sicht des Erstellers gesetzt (`handedOff`-Bedingung requesterId === createdById und userId !== createdById) — Zusammenfassungen, die beidseitige Sicht behaupten, wären falsch.
- Schreib-Scope bleibt `ownerScope` (Ersteller → 404 bei PATCH/DELETE); nur der LISTE-Scope wurde erweitert — nicht als allgemeine "Creator-Zugriffe" formulieren.
