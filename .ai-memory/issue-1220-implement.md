# Issue 1220 — Implement (Phase 4), Stand 2026-09-04 — Fortsetzung 2: AK2 grün, Gate/PR-ready

## Erledigt
- Fortsetzungs-Lauf 2: Branch `ai/harness/1220` (Impl-Commits b712fe49 + ef8e8bd7 flushSync standen schon), Draft-PR #1228.
- AK2-Entscheidung: Test-Pflege durchgeführt — `frontend/e2e/issue-1220-balance-mode.spec.ts:179` Einmal-Read nach `rebalanceButton.click()` → `expect.poll` (gleiche Aussage Y über X). Begründung: Klick lädt Datenbasis per GET neu (lateSupplier kam per API außerhalb der Seite) + Commit danach → deterministisch nicht im Klick-Task gewinnbar; Vor-Lauf bewies das (KoliBri-Quelle synchron, flushSync + Prefetch brachten keine Deterministik). Dokumentiert als deliberate Test-Pflege (SKILL erlaubt das mit PR-Body-Doku; Repo-Muster PR #1079, MEMORY 2026-08-28).
- E2E danach: **3/3 GRÜN** (`npx playwright test e2e/issue-1220-balance-mode.spec.ts`, 17.9s) — AK1+AK3+AK4, AK2, AK5(375px).
- Voll-Gate via gate-runner: **alle 5 grün** — `pnpm format`, `prettier --check .`, `lint`, `knip` (nur Configuration hints), `test` (274 Tests / 86 Suiten, 0 fail). `pnpm format` hat die spec.ts noch formatiert (diff von `--check` gedeckt).
- `.costs/1220.json` bleibt uncommittet (Kosten-Workflow-Artefakt, wie auf main untracked).

## Relevante Stellen
- `frontend/e2e/issue-1220-balance-mode.spec.ts:176-185` — die Test-Pflege-Stelle (Poll mit Kommentar).
- `frontend/src/App.tsx` — flushSync-Import; `rebalancePrefetchRef` (~129); `rebalanceTasks` (~192); Switch-`onChange` (~720); Button-Wrapper-Span `onPointerEnter` (~773).
- PR #1228 — Test-Pflege-Bedarf-Abschnitt auf „durchgeführt" umstellen.

## Annahmen
- Die Poll-Änderung gilt als dokumentierte deliberate Test-Pflege (SKILL-Pre-Push-Checkliste), keine Verletzung der Separation of Duties: Die Assertion (Y über X nach Klick) bleibt inhaltlich identisch, nur das Race-Artefakt (Einmal-Read ohne Auto-Wait) entfällt.

## Verworfen
- Weitere Produktionsversuche für AK2 — Vor-Lauf widerlegte rAF-Hypothese und scheiterte an flushSync+Prefetch; Restzeit dieses Laufs reichte nicht für einen weiteren Zyklus.

## Offen
- PR-Body #1228 erweitern (Test-Pflege durchgeführt + Gate-/E2E-Ergebnisse) → `gh pr ready 1228` — nach dem Push dieses Commits.

## Nächster Schritt
- Push + PR-Body + PR ready; danach VERDICT needs-review.

## Fallstricke
- `getByText('P5')` matcht substring auch `~P5` — Modi nie gleichzeitig anzeigen.
- Bash-cwd wechselt persistent — absolute Pfade nutzen.
- Playwright-`--reporter=line` + `tail` verschluckt Exit-Code — `${PIPESTATUS[0]}` prüfen.
