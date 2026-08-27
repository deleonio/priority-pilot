# Issue #1049 / PR #1048 — Fixup-Phase (F9/F10 aus Runde-2-Review)

## Erledigt
- Offene Threads ermittelt: genau zwei unresolved Review-Threads (GraphQL reviewThreads), beide vom my-github-action-bot 2026-08-27T01:15:43Z gepostet (Review #5036411673): F9 (PRRC_kwDONloM187mjHpZ) und F10. Alle Threads F1–F8 sind isResolved.
- F9 gefixt: frontend/e2e/search-modal.spec.ts:64 — `expect(...).toBeFocused({timeout:150}).catch(() => undefined)` → nacktes `await expect(modalSearchInput(page)).toBeFocused();` (Repo-Norm quick-capture.spec.ts:151).
- F10 gefixt: frontend/src/components/SearchModal.tsx:49 — `prev + (prev.endsWith(' ') ? text : ' ' + text)` → `(prev ? `${prev} ${text}` : text)` wie TaskForm.tsx:726/QuickCaptureModal/PillarAdvisorModal.
- Beide Threads beantwortet (Replies 3868037195 / 3868037877) und per resolveReviewThread-Mutation aufgelöst (isResolved true ×2).
- Fixup-Commit **968324825216905fadc3c7c50fed70b11b366266** gepusht (`fix(frontend): review findings F9-F10 aus PR-Review`, lefthook pre-commit format/knip/lint ✔).
- Lokale GATE-Ergebnisse: format/prettier/lint/knip = 0; `pnpm test` Exit 1, aber `fail 0 pass 684 skipped 1` — bekanntes Sandbox-Problem ohne Redis (siehe MEMORY.md 2026-08-25), NICHT durch den Fix verursacht, CI-verify hat redis-Service und lief grün.
- Geänderte e2e-Spec lokal verifiziert: `npx playwright test e2e/search-modal.spec.ts` → 3 passed inkl. nackter Autofokus-Assertion (16 s).
- Sammelkommentar (ai-review, ID 5427008006) NICHT fortgeschritten — kein Entscheidungs-Finding, kein needs-human.
- CI zum neuen Head: verify + e2e(1)–(4) im Lauf 33030458639 pending.

## Relevante Stellen
- frontend/e2e/search-modal.spec.ts:60–76 — Flow-Test; F9-Zeile steht im Block „Toolbar-Button öffnet das Such-Modal".
- frontend/src/components/SearchModal.tsx:44–51 — VoiceField-Wrap um KolInputText; F10 im onTranscript-Callback.
- frontend/e2e/quick-capture.spec.ts:151 — Norm für F9 (nackte Assertion, default 5s-Timeout).
- frontend/src/components/TaskForm.tsx:724–728 — Norm-Merge `${prev} ${text} : text`.

## Annahmen
- Die beiden Bot-Threads sind die einzigen offenen Findings für PR #1048 (GraphQL listet keine weiteren unresolved Threads).
- F6-Entscheidung aus Runde 1 (kein View-Mode-Reset) bleibt gültig — nicht erneut angerührt.
- Kein neuer Sach-Review nötig: Nur gemeldete Findings fixen (Auftrag).

## Verworfen
- detect.mjs / Playwright: Finding betrifft Test-Assertion + String-Merge, kein Layout/UI-Bruch.
- Prettier-Risiko-Check entbehrlich: Zeilen bleiben einzeilig unter Line-Length.

## Offen
- — (CI auf 96832482 komplett grün: verify 2m59s, e2e(1)–(4) je pass, Lauf 33030458639; beide Threads resolved)

## Nächster Schritt
- Nichts mehr offen für diese Phase. Falls ein erneuter Review-Lauf neue Findings bringt → nächster Fixup-Nachweis-Runde 3 mit laufender Finding-Nummerierung (ab F11).

## Fallstricke
- F10-Vorschlag aus dem Thread wörtlich übernehmen (`(prev) => (...)`) — ohne Parens um Objekt-/Ternary-Body gibt Pfeilfunktion-Prettier-Fehler? Nein: Ternary braucht keine Klammern, aber Klammern sind der repoübliche Stil; Vorschlagsform genutzt.
- `cd frontend` persistiert im Bash-Tool — absolute Pfade verwenden bzw. zurückwechseln.
- gh-Installations-API kann 403 liefern trotz vollem core-Kontingent (Rate-Limit der App) — nicht blind retry.
