# Issue 1231 — Fixup (PR #1232), Stand 2026-09-05

## Erledigt
- Findings der Review-Runde 3 (Fixup-Nachweis) gelesen: 🟢, keine Blocker, keine Entscheidungs-Findings, 2 Nits mit konkreten Vorschlägen + CI-Hinweis (main-seitig, s. Verworfen).
- Nit 1 behoben: `frontend/src/lib/apiError.ts:78` — Event-Gate jetzt `status === 401 && message === SESSION_TEXT` (rein defensiv; beide SESSION_TEXT-Zuweisungen im File stehen ohnehin unter `status === 401`, kein Verhaltenswechsel).
- Nit 2 behoben: `frontend/src/Root.tsx` — `shouldAttemptSilentLogin(allowRepeat = false)` parametrisiert; der `SESSION_RELOAD_KEY`-Bonus (`Root.tsx:81`) ersetzt nur noch den `pp_silent_attempted`-Flag, NICHT mehr alle Guards. URL-Guards (`?silent=unavailable`, `?error=…`) und `pp_just_logged_out` greifen jetzt auch im Bonus-Pfad — vorher widersprach der Code den eigenen Kommentaren („Loop-Guards bleiben unverändert wirksam"), jetzt stimmen Code + Kommentare überein.
- Gate grün (gate-runner, 6/6): format, prettier --check, lint, knip (nur Config-Hints = bekannt), frontend vitest 569 passed/13 skipped, test:scripts 274 passed.
- Commit + Push auf `ai/harness/1231`, beide Review-Threads (apiError.ts:78, Root.tsx:81) per GraphQL aufgelöst, ai-fixup-decisions-Kommentar am PR mit ✅-Tabelle erstellt.

## Relevante Stellen
- `frontend/src/Root.tsx:24-35` — `shouldAttemptSilentLogin(allowRepeat)` mit neuem JSDoc-Absatz zum Bonus.
- `frontend/src/Root.tsx:77-88` — Bonus-Konsum + Aufruf mit `sessionReload` als Argument.
- `frontend/src/lib/apiError.ts:78` — gehärtetes Event-Gate für `SESSION_EXPIRED_EVENT`.

## Annahmen
- Nits sind „reported findings" und gehören in den Fixup (Review nannte konkrete Vorschläge; beide minimal & ohne Verhaltenswechsel für die geteste Journey).
- `pp_just_logged_out` im Bonus-Pfad aktiv zu lassen ist im Sinne des Reviews (Kommentare behaupten genau das; Logout-Guard war explizit mit aufgeführt).

## Verworfen
- CI-rot `e2e (3)` / `e2e/issue-969.spec.ts:86` fixen — laut Review main-seitige Nachwirkung aus #1234; `SettingsPage.tsx`, `issue-969.spec.ts`, settings-e2e-Spezis sind auf dem PR-Head byte-identisch zu main. Test-Pflege gehört zu main, nicht zu #1232. Kein Rerun versucht (echtes, kein Flake-Signatur-Rot).
- e2e-Lauf — Änderung betrifft Auth-Logik vor App-Mount; bestehende specs decken die Journey ab (frontend vitest grün), Review verlangte kein e2e.

## Offen
- -

## Nächster Schritt
- Nächste Review-Runde liest die ✅-Tabelle im ai-fixup-decisions-Kommentar als Claim-Checkliste.

## Fallstricke
- Die Bonus-Semantik ist jetzt: Bonus ≠ „skip alle Guards", sondern „ein Repeat erlaubt". Wer künftig einen Guard im Bonus-Pfad ausnehmen will, muss das in BOTH Kommentaren (JSDoc + Aufrufstelle) ändern.
- `.costs/1231.json` (untracked) bleibt uncommittet.
