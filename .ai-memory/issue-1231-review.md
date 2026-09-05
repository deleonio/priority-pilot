# Issue 1231 / PR 1232 — Review (Runde 3, Fixup-Nachweis), Stand 2026-09-05

**ERGEBNIS: VERDICT reviewed (🟢, keine offenen Findings).** Marker `<!-- ai-review -->` vorhanden (Kommentar-ID 5548968818, Runden 1+2 ebenfalls reviewed) → MODE Fixup-Nachweis. Fixup-Runde 3 lief durch: `<!-- ai-fixup-decisions -->`-Kommentar 5550621530 (08:35:03Z) mit 2 Claim-Zeilen, beide → bd810c90. Beide Claims am Diff verifiziert, nichts Neues eingeführt. Sammelkommentar in Place aktualisiert (Nits 1+2 in „Behobene Anmerkungen" verschoben), Footer weiter „Fixup-Nachweis". Keine Inline-Kommentare nötig.

## Erledigt
- MODE bestimmt: Marker vorhanden (updated_at 07:28:35Z) → Fixup-Nachweis. Claim-Checkliste = ai-fixup-decisions-Kommentar 5550621530: Finding 1 (apiError.ts:78 statusbasiert) + Finding 2 (Root.tsx:81 nur pp_silent_attempted ersetzen), je „fixed in bd810c90".
- Fixup-Diff verifiziert (`git show bd810c90`, ohne .ai-memory): genau 2 Code-Dateien.
  - Claim 1 ✔: `frontend/src/lib/apiError.ts:78` jetzt `status === 401 && message === SESSION_TEXT`. Verhaltensneutral belegt: SESSION_TEXT wird nur in 401-Zweigen gesetzt (`apiError.ts:63,75`), nie sonst — Härtung ohne Verhaltensänderung.
  - Claim 2 ✔: `frontend/src/Root.tsx:28` `shouldAttemptSilentLogin(allowRepeat = false)` — einziges Call-Site `:85` übergibt `sessionReload`; URL-Guards (`?silent=unavailable`, `?error=…`) und Logout-Guard bleiben auf dem Bonus-Pfad wirksam. Grep: keine weiteren Caller.
  - Nichts Neues: Diff enthält nur die zwei Fixes + Kommentare/Memory-Notiz.
- Commits nach Runde-2-Review (07:28:35Z): 08030722 (memory), bd810c90 (Fix), 25f304b9 (memory) — kein ungedeckter Code-Commit.
- CI-Stichprobe Head: verify + e2e (4) pass, e2e (1/2/3) pending (Neustart); Runde-2-Rot `e2e/issue-969.spec.ts:86` war main-geerbt (#1234), Dateien byte-identisch zu main — CI-Hinweis im Sammelkommentar aktualisiert.
- Titel-Gate: „feat(frontend,server): session-expired dialog with silent re-login" konform — kein Rename.

## Relevante Stellen
- Kommentar 5548968818 — der eine `<!-- ai-review -->`-Sammelkommentar (Runde 3 aktualisiert, Body-Datei `.ai-memory/issue-1232-review-body.md`).
- Kommentar 5550621530 — `<!-- ai-fixup-decisions -->` der Fixup-Runde 3 (Claim-Quelle).
- `frontend/src/lib/apiError.ts:61-84` — SESSION_TEXT-Zuweisungen (beide 401-gated) + gehärtetes Event-Gate.
- `frontend/src/Root.tsx:28-37,76-90` — Silent-Login-Guards mit `allowRepeat`-Parameter; Bonus-Marker wird vor dem Versuch konsumiert.
- Commit bd810c90 — „fix(review): session-expired guards hardened (#1231)", einzige Code-Änderung der Runde.

## Annahmen
- Fixup-Gate-Aussage (frontend-vitest 569 passed, test:scripts 274 passed, format/lint/knip grün) geglaubt, nicht lokal reproduziert — Diff ist trivial verhaltensneutral, apiError.test.ts deckt die Session-401-Fälle ab.
- e2e-Rot der Runde 2 ist auf dem neuen Head noch nicht endgültig bewertet (Checks pending) — Ursache war laut Byte-Identitäts-Beleg main-seitig (#1234), unverändert dokumentiert.

## Verworfen
- Vollständiges Re-Review des PR-Diffs — MODE Fixup-Nachweis; Skill-Kostengate (nur Claim-Verifikation + Delta seit updatedAt).
- Lokale Test-Wiederholung — Fixup-Gate dokumentiert grün, keine Gegenevidenz im Diff.

## Offen
- Wegwerf-Artefakte in `.ai-memory/` NICHT committen: `issue-1232-review-body.md` (gesendeter Body Runde 3) + Altbestand `issue-1231-review-prev.md`, `issue-1231-collected.md` aus Runde 2. Nur diese Datei hier ist die Phasen-Notiz.
- e2e (3)/issue-969-AK4 auf main: Test-Pflege-Bedarf bleibt bei main (#1234-Nachwirkung), nicht bei diesem PR.

## Nächster Schritt
- Workflow: verdict „reviewed" emittiert → gate-merge entscheidet anhand der Checks; inhaltlich ist der PR review-abschließig 🟢 (alle Findings behoben).

## Fallstricke
- Keine neue Runde ohne neuen Code/Claim: weiterer Fixup-Nachweis braucht neuen `ai-fixup-decisions`-Kommentar oder neue Commits — sonst gilt dieses Ergebnis.
- `gh api --method PATCH … --input - -f body=…` mischt sich → 422 („links/1/schema"); nur `-f body="$(cat …)"` ohne `--input` verwenden.
