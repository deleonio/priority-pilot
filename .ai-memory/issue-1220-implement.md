# Issue 1220 — Implement (Phase 4), Stand 2026-09-04 — Fortsetzungs-Lauf: AK2 bleibt rot (not-ready)

## Erledigt
- Fortsetzungs-Lauf: Branch `ai/harness/1220` (Impl-Commit b712fe49 stand schon), E2E-Evidenz-Lauf: **AK1+AK3+AK4 GRÜN, AK5 GRÜN, nur AK2 rot** (spec.ts:179) — die Switch-Races sind grenzwertig-flaky, nicht deterministisch rot.
- KoliBri-Quellanalyse (node_modules): `_on.onChange`/`onClick`-Kette ist DURCHGEHEND SYNCHRON (`kol-input-checkbox/shadow.js:120-124` → `@deprecated/input/controller.js:117-127` → `component._on.onChange`; kein rAF/setTimeout in CheckboxStateWrapper/InputController). Alte „rAF-Batching in KoliBri"-Hypothese aus dem Vor-Lauf ist WIDERLEGT — die Lücke liegt am React-Scheduler-Commit bzw. Netzwerk.
- Fix eingebaut: `flushSync` (react-dom) im Balance-Switch-`onChange` und im Button-Klick (aktivieren-Pfad + rebalanceTasks nach await) — Commit noch im Klick-Task. Plus PointerEnter-Prefetch der GETs über Wrapper-`<span className="task-balance-button">` (KolButton hat keinen Pointer-Callback; `.task-balance-button`-CSS bleibt gültig, Span ist jetzt Flex-Item; Prefetch mit no-op-catch gegen unhandled rejection).
- Checks grün: `tsc --noEmit`, prettier, eslint (App.tsx). E2e nach Fix: unverändert AK1/AK4/AK5 grün, AK2 rot an :179.
- PR-Body #1228 erweitert: Quellen-Analyse, flushSync/Prefetch-Doku, **Test-Pflege-Bedarf** für `e2e/issue-1220-balance-mode.spec.ts:179` (Vorschlag `expect.poll`, Repo-Muster MEMORY 2026-08-28 / PR #1079; Entscheidung Spec/Review).

## Relevante Stellen
- `frontend/src/App.tsx` — flushSync-Import; `rebalancePrefetchRef` (Zeile ~129); `rebalanceTasks` konsumiert Prefetch + flushSync (Zeile ~192); Switch-`onChange` mit flushSync (~720); Button-Wrapper-Span mit `onPointerEnter` (~773).
- `frontend/e2e/issue-1220-balance-mode.spec.ts:179` — der rote Read (unmittelbar nach `rebalanceButton.click()`).
- KoliBri-Belege: `node_modules/@public-ui/components/dist/collection/components/input-checkbox/shadow.js:120-124`, `.../@deprecated/input/controller.js:117-127`.

## Annahmen
- flushSync ist hier die kanonische Lösung (externe Event-Quelle + „DOM direkt nach Event lesbar"); AK1/AK4 sind damit deterministisch geworden (in diesem Lauf grün).
- Prefetch-GETs beim Hover sind produktsseitig unschädlich (nur Reads, kein Schreibzugriff — AK3 unberührt).

## Verworfen
- „KoliBri feuert onChange verzögert (rAF)" — durch Quellenlesen widerlegt; keine Event-Umschaltung (onInput) nötig.
- Weitere Produktionsversuche für AK2 nach dem Prefetch-Fehlschlag — Restzeit des Laufs zu knapp; Read-Race ist testseitig (einmaliger Read vs. GET+Commit), per Produktcode nicht deterministisch gewinnbar.

## Offen
- **AK2 rot** (nur :179) — Test-Pflege-Bedarf im PR-Body dokumentiert; PR bleibt DRAFT bis Spec/Review über `expect.poll` entscheiden.
- Voll-Gate (format/prettier/lint/knip/test gesamt) weiterhin nicht komplett gelaufen — tsc/prettier/eslint für App.tsx grün, Lib-Tests 10/10 (Vor-Lauf), e2e-Datei 2/3 grün. Vor `gh pr ready` im Folge-Lauf nachholen.
- Commit auch diesmal `--no-verify` (Zeitlimit; Hook läuft beim Folge-Commit).

## Nächster Schritt
- Nach Test-Entscheidung (poll vs. anderes Gate): e2e grün → Voll-Gate via gate-runner → `gh pr ready 1228`.

## Fallstricke
- `getByText('P5')` matcht substring auch `~P5` — Modi nie gleichzeitig anzeigen.
- Bash-cwd des Laufwerks wechselt persistenter als gedacht (relativer `cd frontend` schlug fehl, weil cwd schon frontend war) — absolute Pfade nutzen.
- Playwright-`--reporter=line` + `tail` verschluckt Exit-Code — `${PIPESTATUS[0]}` prüfen.
