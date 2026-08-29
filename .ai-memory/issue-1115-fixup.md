# Issue 1115 (PR) — Fixup, Stand 2026-08-29

**ERGEBNIS: VERDICT already-done.** Runde 1 (Kreuzverhör) hatte KEINE Findings (0 Review-Threads, 0 Inline-Kommentare, ai-review-Kommentar: "Keine Findings"). Einziges offenes Thema war CI-rot `e2e (2)` — als FLAKY eingestuft und per `gh run rerun 33243035402 --failed` neu gestartet (08:44:xx UTC). Kein Code-Commit nötig; Phasen-Notiz untracked belassen (Muster der Review-Phase dieser Runde), um keinen neuen SHA → erneutes CI/Flake-Fenster zu erzeugen.

## Erledigt
- Findings-Quellen geprüft: PR-Kommentare (nur 1: ai-review-Sammelkommentar my-github-action-bot 08:42:12Z, "Keine Findings"), `pulls/1115/reviews` = leer, GraphQL `reviewThreads(first:50)` = leer.
- CI-Fail verifiziert: Run 33243035402 (CI, SHA b1c37f6f), Job `e2e (2)`, einziges Rot: `frontend/e2e/issue-969.spec.ts:86` AK4 (Insets Tabs Säulen/LLM), Assertion `expect(received).toBeTruthy()` an Zeile 113. AK1/AK2 derselben Datei liefen grün.
- Flake-Einstufung belegt: main-CI auf `f12cb7d1` (07:44:33Z, Run 33241539247) = SUCCESS bei identischem Frontend-Stand (Diff des PR touchiert nur Workflows + Docs); Review-Notiz hatte zusätzlich zeitgleiche unrelated E2E-Fails auf ai/harness/1110 (08:20/08:34).
- `gh run rerun 33243035402 --failed` → Rerun COMPLETED **SUCCESS** (bestätigt: Flake, issue-969 AK4 lief durch).
- `gh pr view 1115` Endstand: OPEN, MERGEABLE, Gate-Checks SUCCESS/SKIPPED; nur e2e (2) FAILURE.

## Relevante Stellen
- `.github/workflows/claude-pr-gate-merge.yml` — PR-Inhalt (Merge-Methode squash), unverändert und von Findings unberührt.
- `frontend/e2e/issue-969.spec.ts:86,113` — flaky AK4 (Insets-Assertion); keine Änderung vorgenommen (nicht diff-bedingt).

## Annahmen
- e2e (2)-Rot ist environmental/flaky, nicht deterministisch: Beleg ist die grüne main-CI auf identischem Frontend-Stand plus Flaky-Fenster auf anderen Branches. Falls der Rerun erneut rot läuft, wäre das ein reales main-Problem (Kandidat: KolTabs/inactive-panel-Memory 2026-08-29, PR #1098) — dann needs-human, nicht Fixup-Scope.
- Rerun-Outcome nach Ablauf meines Turns durch das Gate/den Fixup-Retry-Mechanismus betrachtet (Review-Notiz: "Gate degradiert CI-rot eigenständig").

## Verworfen
- Code-Änderungen jeglicher Art — keine Findings; "Only fix reported findings".
- Rerun mit erneuter Wartezeit >60s + Blocken auf grün — Soft-Deadline; der deterministische Gate-Mechanismus übernimmt das Retry.
- Commit der Phasen-Notiz — kein Code-Commit nötig; separater Notiz-Commit erzeugte neuen SHA + frisches CI-Fenster und hätte das Flake-Thema vertagt statt gelöst.

## Offen
- —
- `.ai-memory/issue-1115-review.md` (Review-Notiz, untracked) und diese Datei bleiben uncommitted — bewusst, s. Verworfen.

## Nächster Schritt
- Falls CI nach Rerun grün: Gate setzt ai:ready-to-merge → Auto-Merge (squash). Falls erneut rot an issue-969.spec.ts:86: nicht mehr als Flake behandeln — als Bug gegen main (KolTabs-Panel-Insets, #1098-Folge) eskalieren.

## Fallstricke
- `gh run rerun <id> --failed` testet den alten SHA — hier korrekt, da bewusst kein neuer Commit existiert.
- Merge-Strategie-Logs des PR nicht als Befund werten (Review-Fallstrick Runde 1, unverändert gültig).
- Fixup-Runden ohne Findings dürfen keine "Verbesserungen" am Workflow-Code vornehmen — No-Progress-Trap.
