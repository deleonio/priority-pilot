# PR 1244 — Kreuzverhör (Review-Phase), Stand 2026-09-06

**ERGEBNIS: VERDICT reviewed, 🟢 mit 2 Nits (nicht blockierend).** Modus Kreuzverhör (kein `<!-- ai-review -->`-Marker vorhanden), kein Closing-Issue (length 0) → „Review ohne Issue — PR-Beschreibung ist massgebend" (steht in Zeile 2 des Sammelkommentars). Titel per Titel-Gate umbenannt (war deutsch) → `feat(frontend): separate balance switch from recompute button (#1220)`.

## Erledigt
- Vollständigen Diff gelesen (6 Dateien, +277/−114): App.tsx-Entflechtung, balancePriority.ts (+`balancePrioritiesEqual`), 5 neue Unit-Fälle, E2E AK2/AK6/Veraltet/AK5 erweitert, docs/spec/issue-1220.md nachgezogen.
- Modus über Marker-Suche bestimmt (kein Treffer → Kreuzverhör); Closing-Issue-Check: 0.
- CI verifiziert: e2e (1)–(4), precheck, label, verify = SUCCESS; „review"-Check = dieser Lauf selbst.
- Umfeld-Recherche an recherche-Subagent (haiku) delegiert: 0 Reste von `Ausbalancieren`/`activateBalanceMode`/`rebalancePrefetchRef`/`applyBalanceSnapshot`; `useRef` (App.tsx:13→111,376,379) und `flushSync` (:14→740) lebendig; `sortTasksByBalance` extern nur TaskTree.tsx:8,270 (unverändert); Balance-UI nur e2e-abgedeckt (kein Unit-Test — OK); 5 `test(` in der Spec-Datei = matches PR-Body „5/5".
- Review (event COMMENT, ID 5123516190) mit 2 Inline-Nits gepostet; Sammelkommentar einmalig angelegt (ID 5555675295).

## Relevante Stellen
- `frontend/src/App.tsx:174` — `liveBalance`-useMemo, einzige Rechenstelle; `:184` Effect: Modus aus → Snapshot läuft mit; `:192` `balanceStale`; `:203-215` `rebalanceTasks` (fetch → ersetzt Stand, `_disabled={rebalancing}` :790); `:818` `balancePriorities={balanceMode ? balanceSnapshot : null}`.
- `frontend/src/lib/balancePriority.ts:75` — `balancePrioritiesEqual` (Vergleich: ID → score+virtualPriority); `:105` Tie-Break `b.priority - a.priority` aus aktuellen Task-Objekten (Nit-1-Quelle).
- `frontend/e2e/issue-1220-balance-mode.spec.ts` — Tests :124 (AK1+AK3+AK4 kombiniert), :165 (AK2), :200 (Veraltet-Hinweis), :233 (AK6, Netzwerk-Mitschnitt), :270 (AK5 375px).

## Annahmen
- PR-Body als informelle Spec (AK-Nummern aus docs/spec/issue-1220.md, das im selben PR nachgezogen wurde — bewusstes Test-Pflege im Nachbesserungs-PR, kein Separation-of-duties-Verstoß, da keine Issue-Phase lief).
- „274 pass / 0 fail" aus dem PR-Body nicht selbst gezählt — durch CI-verify SUCCESS gedeckt.

## Verworfen
- Blocker „Balance-UI ohne Unit-Tests" — Verdrahtung (Einfrieren/Veraltet/Aufgabenteilung) ist deterministisch per E2E abgedeckt, Rechenkern per Unit; deckungsgleich mit #1220-Präzedenz.
- Nit als Fixup-Runde werten — Kosten-Gate (SKILL Schritt 4): ~45 Turns rechtfertigen keinen Randfall.

## Offen
- Nits 1+2 (siehe Sammelkommentar) — abhakbar durch späteren Fixup oder Menschen, kein `ai:needs-fixup` ausgelöst.

## Nächster Schritt
- Workflow übernimmt (Labels automatisch); bei menschlich angeordneter Fixup-Runde: Fixup-Nachweis-Modus (Marker vorhanden → nur Claim-Checkliste + Delta seit Updated prüfen).

## Fallstricke
- Nächster Review-Lauf: MODE = FIXUP VERIFICATION (Marker `<!-- ai-review -->` jetzt vorhanden, ID 5555675295, Updated 2026-09-06).
- Finding-Nummerierung: Nits sind als 1/2 im Sammelkommentar verankert — bei Fixup-Runde diese IDs beibehalten, nicht neu nummerieren.
- Titel wurde von mir geändert (feat statt refactor per Workflow-Hinweis) — nicht als Finding werten.
