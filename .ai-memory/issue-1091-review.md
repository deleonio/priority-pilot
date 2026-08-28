# Issue 1091 — Review (Phase 5), Stand 2026-08-28

## Erledigt
- MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar auf PR #1093 vorhanden, geprüft via issues/1093/comments).
- PR #1093 gelesen: 2 Dateien, +39/−2 — `.ai-memory/issue-1091-implement.md` (neu, Phase-Notiz, konventionsgemäß) + `frontend/src/lib/useAddressSearch.test.ts` (Debounce-Test async gemacht, `result` destrukturiert, State-Assertions `suggestions toEqual []` + `loading toBe(false)` nach `await act`).
- AK-Quelle: Issue #1091 hat KEINEN KI-ANALYSE-Block (nur `<!-- ai-quality -->`-Kommentar) → AKs direkt aus „Woran messen wir das?": (1) Mock-Prüfung UND State-Prüfung, (2) Stabilität bei Implementierungswechsel des Debounce-Mechanismus.
- Befund: neue State-Assertion ist schwach — Mock liefert `[]`, Initial-State ist ebenfalls `[]` → Assertion kann die wahrscheinlichste Regression (State-Update bleibt aus) NICHT erkennen. Implement-Notiz kennt die Schwäche selbst („auch im Initial-State wahr"), hat sie aber nur im PR-Body dokumentiert statt zu fixen. Da das Issue exakt die Tautologie bekämpft, ist das ein needs-fixup-Finding (Mock mit Treffer füllen → Assertion bekommt Biss).
- Verdict: **needs-fixup**. Review (event COMMENT, ID 5052449769) mit 1 Inline-Finding auf `useAddressSearch.test.ts:80` gepostet; Sammelkommentar `<!-- ai-review -->` angelegt (issuecomment-5454298375) — nächste Runde = FIXUP VERIFIKATION, diesen per PATCH updaten.
- Titel-Gate: Titel war 105 Zeichen > 72 → umbenannt zu `test(frontend): assert state in useAddressSearch debounce test`. Verdict-Datei /tmp/claude-verdict = needs-fixup geschrieben.

## Relevante Stellen
- `frontend/src/lib/useAddressSearch.test.ts:60-80` — der geänderte Debounce-Test; Finding-Anker.
- `frontend/src/lib/useAddressSearch.ts` — Hook unverändert (laut Issue korrekt), kein Produktionscode im PR.
- `.ai-memory/issue-1091-implement.md` — Phase-Notiz der Impl-Phase im selben PR committed (ADR 0007).

## Annahmen
- Verdict needs-fixup (nicht needs-human): Finding ist ohne menschliche Entscheidung fixbar (Mock-Wert ändern).
- `loading toBe(false)` und `suggestions toEqual([])` können zwar failen (z. B. loading hängt), decken aber nicht die Kernregression — deshalb schwach, nicht tautologisch im strengen Sinn.
- Suite laut Impl-Notiz grün (47 passed lokal; Redis-rot in session.test.ts ist pre-existing, MEMORY 2026-08-27).

## Verworfen
- AK2-Verletzung („stabil bei setTimeout→requestIdleCallback") als eigenes Finding — Fake-Timer-Nutzung (`advanceTimersByTime(400)`) ist die einzige deterministische Art, Debounce zu testen; Beispiel im Issue ist illustrativ, keine harte Anforderung.
- Eigenes Nachfahren der Frontend-Suite im Review — Zeit (Soft-Deadline knapp), Impl-Notiz dokumentiert 447 passed, CI läuft ohnehin.

## Offen
- -

## Nächster Schritt
- Fixup-Runde: Mock auf nicht-leeren Treffer umstellen, `suggestions`-Assertion darauf zuschneiden; danach Fixup-Nachweis (MODE dann Fixup-Verifikation).

## Fallstricke
- Branch heißt `vibe/fix-issue-1091-70cd86`, Draft-PR war schon vor Impl-Phase da (Spec-Modus) — Commits nicht dem Impl-Agent zuschreiben.
- PR #1093 schließt Issue #1091 (closingIssuesReferences=[1091]) — NICHT „Review ohne Issue", aber auch ohne KI-ANALYSE-Block: AK-Quelle ist der Issue-Body-Abschnitt „Woran messen wir das?".
