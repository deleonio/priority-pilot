# Issue 1142 — Fixup (Runde 3), Stand 2026-08-31T06:00Z

## Erledigt
- Findings SCOPED gelesen: ai-review-Kommentar (id 5474180270, 2026-08-31T05:34:08Z = Runde 2, Ampel 🟢) + 2 Review-Threads (3891951898 F1, 3891951966 F2). Beide Threads `isResolved: true` (GraphQL PRRT_kwDONloM186dnqPN / -P1) — Review-Runde 2 hat F1+F2 als behoben und keine offenen Findings hinterlassen. **Kein einziger offener Finding → kein Code-Change nötig.**
- CI auf HEAD 805b7cfa geprüft (`gh pr checks 1150`): verify ✅, e2e (1)(2)(3) ✅, **e2e (4) ❌** (run 33362012636).
- e2e (4)-Log gelesen: einziger Fehler `frontend/e2e/tasks-tab-filter.spec.ts:212` → AK4 „Titel-Filter in der erledigten Tabelle", `getByRole('button', { name: 'Erledigt' })` nach 5 s nicht sichtbar (`markTaskDoneViaUi`, :93). 126 andere Tests desselben Shards grün.
- Einstufung: FLAKY/thematisch unzugehörig — PR-Diff besteht ausschließlich aus `server/src/**/*.test.ts` + `.ai-memory/*` (`gh pr diff 1150 --name-only`), Frontend nicht berührt; gleiches Flake-Muster wie F3 in Runde 1 (e2e (3), issue-969.spec.ts:86 → Rerun grün).
- `gh run rerun 33362012636 --failed` ausgelöst → **grün** (status completed/conclusion success nach ~5 min): verify ✅, e2e (1)–(4) ✅ auf HEAD 805b7cfa. Flake-Nachweis erbracht.
- Wrap-up: ai-fixup-decisions-Kommentar gepostet, `VERDICT: already-done` (keine offenen Findings, kein Code-Commit nötig).

## Relevante Stellen
- `frontend/e2e/tasks-tab-filter.spec.ts:93,212` — Flake-Quelle (UI-Wait), NICHT Teil des PR-Diffs; bleibt unberührt.
- `server/src/test/helpers.ts` — Kern des PRs; laut Review-Runde 2 final, kein Eingriff.
- Review-Threads zu PR 1150 — beide resolved, nichts zu beantworten.

## Annahmen
- `tasks-tab-filter.spec.ts` AK4 ist ein Timing-Flake (UI-Button-Wait), kein Produktfehler; Rerun-Grün wäre der Nachweis.
- Runde 2 des Reviews ist der letzte Stand; kein neuer Review-Kommentar seit 05:34:08Z (nur 2 Issue-Kommentare insgesamt auf PR 1150, beide Bot).

## Verworfen
- Code-Änderungen am PR — Review-Runde 2 vermerkt F1/F2 als behoben, keine offenen Findings; „Only fix reported findings" gibt nichts her.
- Fix des Flake-Tests im PR — außerhalb des Scopes (Server-Test-Helper-Refactor), F3-Vorbild: Frontend-Stabilisierung = eigenes Frontend-Ticket.
- Clarification-Reply in Threads — keine offenen/ambigen Findings vorhanden.

## Offen
- `.costs/1142.json` untracked (Workflow-Artefakt) — wird NICHT committet.

## Nächster Schritt
- `-` (Phase abgeschlossen; nur falls e2e erneut flackt: Rerun --failed, kein Code-Eingriff).

## Fallstricke
- `mergeStateStatus: UNSTABLE` stammt ausschließlich vom roten e2e (4) + pending fixup-Job, nicht von Merge-Konflikten (`mergeable: MERGEABLE`).
- Review-Runde-2-Kommentar zitiert CI run 33361650704 als grün; der spätere Run 33362012636 (auf dem Memory-Commit 805b7cfa) ist der erst relevante Rerun — nicht verwechseln.
- Threads NICHT erneut resolven (schon resolved); ai-review-Kommentar des Reviews nicht anfassen.
