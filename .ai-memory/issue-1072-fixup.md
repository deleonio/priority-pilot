# Issue 1072 — Fixup-Phase (PR #1074) (2026-08-27)

## Erledigt
- Findings-Lektüre: genau 1 Finding (F1) als Inline-Kommentar (comment id 3875709115, TaskForm.tsx:874) + Review-Sammelkommentar id 5445001332 (Verdict needs-fixup). CI auf `a3968cac` grün (verify, precheck, e2e 1–4), nur fixup-Run pending (= dieser Lauf).
- F1 behoben: `frontend/src/components/TaskForm.tsx` (~:874) — leeres `<>…</>`-Fragment im Else-Zweig des `isSeriesMode`-Ternärs aufgelöst, `KolInputDate` „Deadline (optional)" rendert direkt als Else-Wert. Serie-Zweig (:833-873) behält sein Fragment (drei Kinder) unverändert. Commit `c120e16a` „refactor(taskform): überflüssiges Fragment im Deadline-Zweig entfernen (#1072)" gepusht.
- GATE vor dem Push komplett grün: `pnpm format`, `prettier --check .`, `pnpm lint` (tsc+eslint beide Workspaces), `pnpm knip` (nur bekannte Configuration-hints, exit 0), `pnpm --filter frontend test` (421 passed / 13 skipped). Ziel-e2e `npx playwright test e2e/issue-1072-deadline-group.spec.ts` (im frontend-Verzeichnis) lokal gegen `c120e16a`: 4/4 passed (AK1–AK4 inkl. 375×812).
- Review-Thread zu F1 (PRRT_kwDONloM186c-Ten) per `resolveReviewThread` aufgelöst (isResolved=true).
- Sammelkommentar id 5445001332 gepatcht: Verdict „fixed", F1 in „✅ Behobene Anmerkungen"-Tabelle (SHA `c120e16a`), „Offene Findings" geleert, Review-Typ → Fixup-Nachweis. `<!-- ai-review -->`-Marker beibehalten.

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:833-894` — Ternär; nur der Else-Zweig wurde vereinfacht (Datei-Zeilen haben sich nach dem Edit um -2 verschoben, Alert/Checkbox darunter unverändert).
- `frontend/e2e/issue-1072-deadline-group.spec.ts` — 4 Contract-Tests, als Fixup-Abdeckung lokal nachgefahren.

## Annahmen
- Der lokale server-Testfehler (`session.test.ts:249`, „Session von Instanz 1 ist auf Instanz 2 gültig", 401 !== 200) ist env-bedingt: Test meldet selbst „Kein Redis erreichbar — Integrationstest übersprungen (CI stellt Redis als Service bereit)"; kein `redis-server` in der Sandbox installiert, Arbeitsbaum hatte außer der Frontend-Änderung nichts — kann also nicht durch den Fixup verursacht sein. In der GATE-Sammelkommentar als env-only dokumentiert.

## Verworfen
- Neue Fixup-Entscheidungs-Kommentar-Struktur (ai-fixup-decisions mit Optionen) — nicht nötig: F1 war eindeutig, kein Entscheidungs-Finding; der bestehende Sammelkommentar (id 5445001332) wurde stattdessen auf Fixup-Nachweis gepatcht (wie in issue-1072-review.md „Nächster Schritt" vorgesehen).
- Playwright-MCP-/detect.mjs-UI-Prüfung — kein UI-Finding vorhanden; das Fragment-Entfernen ist markup-neutral (Shadow-DOM-Output identisch).

## Offen
- -

## Nächster Schritt
- erledigt: Commit `c120e16a` gepusht, Thread resolved, Sammelkommentar aktualisiert. Phase abgeschlossen — nächster Schritt ist die Fixup-Verifikation durch den Review-Workflow; kein Verdict nötig (Commits zeigen den Fortschritt).

## Fallstricke
- `pnpm test` (Workspace-übergreifend) scheitert in dieser Sandbox IMMER am Redis-Integrations-Test des Servers — nicht als Fixup-Blocker werten, sondern `pnpm --filter frontend test` + gezielte e2e fahren und den env-only-Fehler dokumentieren.
- Thread-Resolve: Thread-ID per GraphQL `reviewThreads` über die Inline-Kommentar-databaseId suchen (hier 3875709115 → PRRT_kwDONloM186c-Ten), dann `resolveReviewThread(input:{threadId})` (nicht `resolvePullRequestReviewThread`, s. Memory 08-23).
