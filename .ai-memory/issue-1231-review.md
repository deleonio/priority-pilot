# Issue 1231 / PR 1232 — Review (Runde 2, Fixup-Nachweis), Stand 2026-09-05

**ERGEBNIS: VERDICT reviewed (🟢, Nit-only).** Marker `<!-- ai-review -->` vorhanden (Kommentar-ID 5548968818, Runde 1 ebenfalls reviewed) → MODE Fixup-Nachweis. Fixup-Lauf 33941537547 war gecrasht (429 usage limit, Crash-Notice = Kommentar 5549199557, KEIN `ai-fixup-decisions`-Kommentar, kein Code-Commit). Sammelkommentar in Place aktualisiert (Review-Typ: Fixup-Nachweis), keine Inline-Kommentare (keine neuen Findings).

## Erledigt
- MODE bestimmt: Marker vorhanden → Fixup-Nachweis. Claim-Checkliste leer (kein ai-fixup-decisions-Kommentar; Crash-Notice stattdessen).
- Delta seit Runde 1 (Review 03:13Z): Commit f7a9d53759→f7a28f68 (nur .ai-memory, Crash-Notiz) + Merge `main` a4960747 07:21Z. `git diff --stat 19d53759..a4960747` (ohne .ai-memory): nur `SettingsPage.tsx`, `settings-action-buttons.spec.ts`, `settings-switch-layout.spec.ts`, `package.json` — **null Überschneidung** mit PR-1232-Dateien (Root.tsx, apiError.ts, auth.ts, SessionExpiredDialog, session-reload/silent-login-e2e).
- CI auf Head geprüft: `e2e (3)` rot — `e2e/issue-969.spec.ts:86` AK4 (Settings-Tab-Insets). Ursache: main-seitig aus #1234 (KolDialog-Umbau SettingsPage); Beleg: `git diff origin/main..a4960747 -- SettingsPage.tsx issue-969.spec.ts settings-*.spec.ts` = leer (byte-identisch zu main bd0c2b82). Nicht PR-1232-verursacht → als „CI-Hinweis"-Sektion im Sammelkommentar dokumentiert, kein Finding gegen diesen PR.
- Sammelkommentar 5548968818 per PATCH in Place aktualisiert (Body in `.ai-memory/issue-1231-collected.md`); Nits 1+2 unverändert übernommen (Stabilität der Nummern), keine Behobene-Anmerkungen (Fixup crashte).
- Titel-Gate: „feat(frontend,server): session-expired dialog with silent re-login" konform (67 Zeichen, lowercase, Englisch) — kein Rename.

## Relevante Stellen
- Kommentar 5548968818 — der eine `<!-- ai-review -->`-Sammelkommentar (weiterhin die einzige Instanz).
- Kommentar 5549199557 — Crash-Notice des Fixups (429); menschliche Checkliste drin (Label-Entscheidung ai:needs-fixup vs. needs-human).
- `frontend/e2e/issue-969.spec.ts:86` — der rote Test (AK4 Tab-Insets); gehört main/#1234, nicht #1232.
- Merge a4960747 — „Merge branch 'main' into ai/harness/1231"; bringt #1234 + Release v0.1.709 (bd0c2b82).

## Annahmen
- Fixup hat nichts geleistet: Crash-Notice nennt HEAD vor/nach = 19d53759; f7a28f68 (memory: fixup) ist nur die Workflow-Phasen-Notiz, kein Code (Diff-Beleg s.o.).
- e2e-Rot ist main-geerbt, nicht Merge-Auflösungsfehler: PR-Branch hatte keine eigenen Änderungen an den Settings-Dateien, also kann die Merge-Auflösung sie nicht verändert haben (Diff zu main leer).
- Runde-1-Grundaussagen (AK1–AK5 grün, KoliBri-first ok) brauchen keine Neu-Prüfung — Diff-seitig unverändert.

## Verworfen
- Vollständiges Re-Review des PR-Diffs — MODE Fixup-Nachweis + leerer Fixup-Delta; Skill-Kostengate.
- needs-fixup wegen rotem e2e (3) — Ursache liegt auf main (#1234), nicht im PR-Diff; das deterministische merge-gate degradiert ohnehin, bis CI grün ist. Verdict ist die inhaltliche Aussage.
- Lokales Playwright-Reproduktion des issue-969-Failures — Byte-Identitäts-Beleg reicht als Kausalitätsnachweis.

## Offen
- Wegwerf-Artefakte in `.ai-memory/` NICHT committen: `issue-1231-review-prev.md` (Runde-1-Kommentar-Backup), `issue-1231-collected.md` (gesendeter Body Runde 2). Nur diese Datei hier ist die Phasen-Notiz.
- e2e (3) rot auf main-Geerbtem: menschliche/fixup-Seite Entscheidung, ob #969-AK4-Test auf main gepflegt wird (Test-Pflege-Bedarf bei main, nicht bei diesem PR).

## Nächster Schritt
- Workflow/gate entscheidet: CI rot → degrade zu ai:needs-changes (mechanisch) oder menschlich entblockt; inhaltlich ist der PR review-abschließig 🟢.

## Fallstricke
- Keine neuen Runden ohne neuen Code: weiterer Fixup-Nachweis braucht einen `ai-fixup-decisions`-Kommentar oder neue Commits — sonst gilt dieses Ergebnis weiter.
- issue-969-AK4-e2e bleibt rot, solange main den #1234-Stand hat — nicht als #1232-Regression fehlinterpretieren.
