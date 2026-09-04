# Issue 1220 — Review (Phase 5, PR #1228), Stand 2026-09-04

**ERGEBNIS: VERDICT reviewed, Ampel 🟢, nit-only.** Kreuzverhör-Erstreview (kein `<!-- ai-review -->`-Marker
vorhanden → voller Diff-Check). Collected Comment erstellt (Marker erste Zeile), Review als COMMENT mit
einem gebündelten Nit-Inline-Kommentar (Review-ID 5117220144). PR-Titel via Gate auf Conventional Commits
umbenannt: `feat(frontend): virtual balance prioritization for the task list (#1220)`.

## Erledigt
- MODE bestimmt (Marker-Suche über Issue-Kommentare: kein ai-review → Kreuzverhör), Issue #1220 +
  Harness-Kommentar 5544221911 (AK1–AK5, KI-UX-Block, Routing) + PR-Body + kompletter Diff gelesen.
- Separation-of-Duties verifiziert: `git diff e64c37a7 HEAD -- frontend/src/lib/balancePriority.test.ts`
  = leer (Unit-Spec-Tests unverändert); E2E seit Spec-Commit nur +5/−1 = dokumentierte AK2-Test-Pflege
  (Einmal-Read → `expect.poll`, Commit `be366ac2`, Begründung im PR-Body, Muster #1079) → akzeptiert.
- Verträge geprüft: `buildPillarSummaries(pillars, tasks, valueByTaskId)` (`frontend/src/lib/pillar.ts:161`,
  Feld `doneEstimatedEffort` :131) — App übergibt leere Map als Value-Beitrag (dokumentiert);
  `priorityBadge` (`frontend/src/lib/task.ts:139`) range-sicher; Server erzwingt share-Summe 100 +
  share ∈ 0–100 (`server/src/express/api.test.ts:329,357`) → balanceScore ∈ [0,1], virtuelle Prio nie >5.
- CI: verify + e2e(1–4) pass auf letztem Run (be366ac2). TaskTree-Zweit-Call-Site (App.tsx:807) ist der
  Empty-State-Zweig (leere Liste) — ohne `balancePriorities` korrekt.
- Beitragende Artefakte: `.ai-memory/issue-1220-review-body.md`, `-review-inline.md`, `-review-payload.json`,
  `-collected.md`, `issue-1220-body-review.md`, `issue-1220-pr-meta.json`, `issue-1220-harness.md`,
  `issue-1220-diff.txt` — Wegwerf, NICHT committen.

## Relevante Stellen
- `frontend/src/lib/balancePriority.ts` — Rechenkern (Defizit nach find.ts, Score, `1 + round(score·4)`), rein.
- `frontend/src/App.tsx:123-135` `buildDoneEffortByPillar`; :554-560 Zustand/Prefetch-Ref; :571-605
  Snapshot/activate/rebalance; :724-746 Switch + aria-live-Hinweis; :770-800 Button + PointerEnter-Span.
- `frontend/src/components/TaskTree.tsx:268-276` `visibleLeaves` (Balance-Sortierung), :91-96 Badge-Label.
- `frontend/e2e/issue-1220-balance-mode.spec.ts` — AK1–AK5; :464 der gepollte AK2-Read.

## Annahmen
- „reviewed“ trotz 3 Nits: keine betrifft AC-Abdeckung/Korrektheit im Praxisfenster (SKILL-Kostengate:
  Fixup-Runde +45 Turns rechtfertigt kein Nit).
- flushSync in KoliBri-onChange/onClick ist legitim (Event-Kontext, kein Render) — React-Warnung nicht beobachtet.

## Verworfen
- Blocker „badge > P5 möglich“ — Server-Share-Validierung (Summe 100) schließt score >1 aus.
- Blocker „getByText('P5') matcht '~P5'“ — im ausgeschalteten Zustand existiert nur das Original-Badge im Item;
  Tests grün, keine strict-mode-Kollision.
- Test-Pflege-Bedarf-Meldung — einzige Änderung ist bereits im PR-Body begründet dokumentiert.
- MEMORY.md-Eintrag — kein neues Fehlermuster (Poll-Timing steht seit 2026-08-28 drin).

## Offen
- -

## Nächster Schritt
- Workflow übernimmt (Labels automatisch); Merge-Entscheidung beim Menschen. Nits können freiwillig in
  einem Folge-Fixup aufgenommen werden (Optionen im Sammelkommentar beschrieben).

## Fallstricke
- NIT-Nummern/Zeilen im Sammelkommentar sind stabil benannt (App.tsx:740/778, TaskTree.tsx:268) — bei
  Fixup-Runde dran denken, dass Zeilen im weiteren Diff driftet.
- Der Sammelkommentar ist der EINZIGE `<!-- ai-review -->`-Kommentar — Folge-Runden müssen ihn patchen, nicht neu anlegen.
