# Issue 1162 — Fixup (Runde 1), Stand 2026-09-02

**ERGEBNIS: VERDICT already-done.** Review-Runde 1 (issue-1162-review.md) hatte 🟢 mit NULL Findings — keine Threads (`pulls/1162/comments` leer, GraphQL reviewThreads leer), keine Inline-Kommentare, keine Entscheidungs-Findings. Einziger offener Punkt: CI `e2e (3)` rot.

## Erledigt
- Konflikte geprüft: keine (Branch `renovate/github-actions`, clean, nur untracked `.ai-memory/issue-1162-review.md`).
- Findings SCOPED gelesen: ai-review-Kommentar 5504919198 (🟢, leer ✅-Tabelle) + Review-Threads (0) + CI.
- CI rot: `e2e (3)` — `e2e/issue-969.spec.ts:86` (AK4 Settings-Tab-Insets, expect toBeTruthy). PR-Diff umfasst NUR `.github/workflows/cron.{arc42,security-scan,update-dependencies}.yml` (Action-SHA-Pins, kein Frontend-Code) → thematisch unmöglich verursacht → FLAKY-Pfad: `gh run rerun 33594821790 --failed` → Run **success**, alle 4 e2e-Shards grün (verifiziert).
- ai-fixup-decisions-Kommentar NEU angelegt (issuecomment-5505075248), Status already-done, Flaky-Nachweis in ✅-Tabelle.
- **Unfall behoben:** `gh pr comment --edit-last` hatte versehentlich den ai-review-Kommentar 5504919198 überschrieben (er WAR der letzte) → Original per PATCH aus `.ai-memory/issue-1162-review-restore.md` (=`review-comment.md` ohne gh-Newline, head -c -1) wiederhergestellt, Fixup-Kommentar dann als NEUER Kommentar gepostet. Endstand verifiziert: 3 Kommentare, ai-review intakt (Zeile 1 Marker + Zeile 2 Review-Status), ai-fixup-decisions separat.
- Kein Commit/Push nötig (nichts zu fixen); Labels nicht angefasst (Workflow-Verantwortung).

## Relevante Stellen
- `.ai-memory/issue-1162-review-comment.md` — Sicherungskopie des ai-review-Bodies (Retter beim Unfall).
- Run 33594821790 (e2e-Matrix), Job 100136050388 — der flaky-Shard-3-Lauf; Rerun grün.
- `frontend/e2e/issue-969.spec.ts:86` — der flaky Test (nur Referenz, NICHT angefasst).

## Annahmen
- e2e (3)-Fail war flaky (Bounding-Box-Messung jener Specs ist timing-anfällig); Rerun-Grün + thematische Unabhängigkeit (kein Frontend-Diff) als Nachweis ausreichend.
- already-done ohne Commit ist korrekt: kein Finding, keine Code-Änderung; Präzedenz issue-1162-review.md (ebenfalls untracked geblieben).

## Verworfen
- Fix am issue-969-Test — nicht Scope dieses PRs, Rerun grün.
- Commit nur der Phasen-Notiz — würde CI neu triggern ohne Nutzen.

## Offen
- Wegwarf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1162-review-comment.md`, `issue-1162-review-restore.md`, `issue-1162-fixup-decisions.md`. Echte Phasen-Notizen: `issue-1162-review.md` + `issue-1162-fixup.md`.

## Nächster Schritt
- Keiner — Fixup abgeschlossen (already-done). Merge-Lauf übernimmt.

## Fallstricke
- `gh pr comment --edit-last` editiert den LETZTEN Kommentar — wenn das der ai-review-Sammelkommentar ist, zerstört es ihn. Fixup-Kommentare immer explizit per `gh api -X PATCH .../issues/comments/<id>` (nach ID-Lookup) oder ohne --edit-last anlegen, wenn der Ziel-Kommentar nicht der letzte ist.
