# Issue 1168 / PR #1170 — Review (Fixup-Nachweis, Runde 3), Stand 2026-09-02T14:09:04Z

**ERGEBNIS: VERDICT reviewed (🟢).** Marker `<!-- ai-review -->` vorhanden (Kommentar-ID 5506004907, updatedAt 2026-09-02T13:40:18Z) → Fixup-Verification, kein neues Kreuzverhör. Delta seitdem = 3 reine `.ai-memory`-Commits (06041ce8, f557df58, ac2fede5, per `git log --stat` verifiziert) → **kein Code-Delta**. 0 neue Issue-/Review-Kommentare seit updatedAt (beide `--jq length`-Counts = 0). Sammelkommentar per PATCH auf Runde 3 aktualisiert, Verdict `reviewed` nach `/tmp/claude-verdict`.

## Erledigt
- MODE-Bestimmung: Marker-Suche → 1 Treffer (ID 5506004907, 🟢 reviewed Runde 2).
- Delta-Review: `git log 06041ce8^..ac2fede5 --stat` — nur `.ai-memory/issue-1168-fixup.md` bzw. `-review.md`, kein frontend/-Pfad.
- Runde-3-Fixup-Notiz (f557df58) gelesen: kein Code-Fix nötig (Threads PRRT_…Z6W-/Z6XC isResolved), einziges Problem `e2e (3)` rot in Run 33637299033 (HEAD 06041ce8) bei `issue-969.spec.ts:86` — Settings-Tab-Padding, NICHT im PR-Diff → korrekt als unrelated/flaky eingeordnet, nicht im PR gefixt.
- Flake-Rerun-Ausgang geprüft: Run 33637299033 = `cancelled` (e2e (3) cancelled, Rest success) — der `gh run rerun --failed` wurde vom frischen Lauf 33639930870 auf HEAD abgelöst (Concurrency-Muster, MEMORY 2026-08-23). Aktueller PR-Check-Stand: verify + e2e 1–4 `pending`, precheck pass — pending ≠ rot.
- Repräsentanz-Argument geprüft: HEAD-Code = 324fe706 + nur-.ai-memory-Commits; vollständiger Run 33635957687 auf 324fe706 war grün (Fixup-Notiz Runde 2) → CI-Vertrauen gerechtfertigt; gate-merge prüft ohnehin noch einmal.
- Titel-Gate: `feat(frontend): replace dashboard start button with done dialog` — konform (feat(frontend):, Englisch, lowercase, ≤72), kein Rename.
- Sammelkommentar 5506004907 per PATCH mit Runde-3-Stand aktualisiert (Body-Datei `.ai-memory/issue-1168-review-round3.md`), Footer `Review-Typ: Fixup-Nachweis`, Updated 2026-09-02. Keine Labels gesetzt.

## Relevante Stellen
- `.ai-memory/issue-1168-fixup.md` — Runde-3-Protokoll (Flake-Analyse, Rerun-Entscheidung, Nächster-Schritt-Zeile).
- `frontend/e2e/issue-969.spec.ts:86` — der Flake-Treiber (Settings-Tab-Padding AK4), #969-Scope, nicht #1168.
- GitHub-Run-IDs: 33635957687 (grün auf 324fe706), 33637299033 (Flake + cancellter Rerun), 33639930870 (frisch, pending, ausgelöst durch diesen Review-Lauf).

## Annahmen
- „Kein Code-Delta seit 324fe706" basiert auf Commit-`--stat` (nur .ai-memory-Pfade) — nicht auf Byte-Vergleich; für Verdict-Zwecke ausreichend.
- Grüner Run 33635957687 auf 324fe706 wird aus der Fixup-Notiz übernommen (nicht selbst neu getriggert); gate-merge validiert CI auf HEAD nach.

## Verworfen
- Neues Kreuzverhör des ganzen PR-Diffs — MODE Fixup-Verification verbietet es (Skill Schritt 5, Diff-Scoping); kein Code-Delta vorhanden.
- Warten auf den ausstehenden Lauf 33639930870 — pending ≠ rot; der deterministische gate-merge-Schritt übernimmt die CI-Prüfung (Skill: 🟢 nur nicht bei rotem CI).
- MEMORY.md-Eintrag — kein neuer Fehler; das „Rerun wird von neuem Lauf gecancelt"-Muster steht bereits seit 2026-08-23 dort. Aufnahmekriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1168-review-round3.md` (Body-Datei für den PATCH) ist Wegwarf-Artefakt — NICHT committen; `rm` braucht Freigabe (Muster früherer Läufe).

## Nächster Schritt
- Keiner für diese Phase. Workflow übernimmt: gate-merge prüft CI auf HEAD (Lauf 33639930870) und setzt `ai:ready-to-merge`, sobald e2e/verify grün sind.

## Fallstricke
- Sammelkommentar NIE neu anlegen, solange ID 5506004907 existiert — immer PATCH (Marker-Suche zuerst).
- Sollte `e2e (3)` im Lauf 33639930870 erneut in `issue-969.spec.ts` rot sein: unrelated (#969-Scope), NICHT in diesem PR fixen — in ai-fixup-decisions dokumentieren (steht so auch in der Fixup-Notiz).
- e2e-Dialoginhalts-Assertions: `.modal-body` (Light DOM), nicht `getByRole('dialog')` (KolDialog-Shadow-DOM-textContent-Falle).
