# Issue 1105 — Fixup (PR #1107), Stand 2026-08-29T04:50Z

## Erledigt
- Findings gelesen: genau 1 Finding (F1, Inline-Kommentar `App.tsx:735`), Review-Sammelkommentar `<!-- ai-review -->` vom 2026-08-29T04:27:06Z = needs-fixup, keine Entscheidungs-Findings.
- CI run 33233901539 (branch ai/harness/1105): verify ✓, **e2e (1)(2)(3) FAILURE**, e2e (4) ✓. main: alle 4 e2e-Shards grün (runs 33232512304/33231953761/33231522572) → Brüche stammen aus dem PR.
- Diagnose: (a) `search-modal.spec.ts` 4/4 rot = exakt F1 (Suche aus `/`: Tab inaktiv, Liste ungefiltert); (b) `issue-865.spec.ts` AK6 rot — 2 React-Router-Future-Flag-Warnings (Log-Zitat verifiziert: `v7_startTransition`, `v7_relativeSplatPath`); (c) `completed-tasks.spec.ts` AK-4 + `issue-1063-geo-badge.spec.ts` AK5/AK6 rot — `locator.uncheck: Clicking the checkbox did not change its state` am Switch „Erledigte Aufgaben anzeigen" (`App.tsx` `task-view-switch`, `_checked` hängt jetzt an `?view=`).
- **Ursache (c) empirisch eingekreist** (Instrumentierungs-Spec, Daten-Dumps vor/nach jedem Schritt): `tabsCallbacks.onSelect` navigierte mit nacktem Pfad (`navigate(ROUTE_PATHS[selected])`) und **warf die Query weg** — Klick auf den bereits aktiven „Aufgaben"-Tab aus `/aufgaben?view=done` erzeugte eine zweite Navigation auf `/aufgaben`, die mit dem Switch-Zustand rivalisierte (React-committet die Query-Entfernung während Playwrights `uncheck()` → Switch springt zurück → „did not change its state"). Probe zeigte: URL schon `?view=`-los bei noch `checked:true`. Beim `check()`-Richtung kein Rennen → nur uncheck rot. Zusätzlich Nebenfund: Stencil-Slot-Fehler `TypeError: Cannot read properties of null (reading 'nodeType')` (Stencil-`enqueue`→`console.error`, Vite-Bundle :1578) beim Öffnen des „Weitere Aktionen"-Popovers — nicht fatal, Tests laufen weiter (offen, siehe Offen).
- Fix 1 (F1): SearchModal-`onSearch` → einziger `navigate({ pathname: '/aufgaben', search: next.toString() })` mit aus `searchParams` gebautem `next` statt `navigate('/aufgaben')` + `applyTaskFilter(query)`.
- Fix 2 (CI/issue-865): `<BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>` — schaltet beide Warnings ab; keine Splat-Routen im Tree.
- Fix 3 (CI/uncheck-Rennen): `tabsCallbacks.onSelect` → `navigate({ pathname: ROUTE_PATHS[selected] ?? '/', search: searchParams.toString() })`, `searchParams` in die Memo-Deps (sonst stale Query). Query gehört damit zum Aufgaben-Zustand und überlebt Tab-Wechsel (wie vor der Router-Migration).
- Fix 4 (Finding-geforderte Abdeckung): `frontend/e2e/search-modal.spec.ts` Test 1 um `toHaveURL(/\/aufgaben\?(.*&)?q=Match/)` ergänzt (Test startet bereits auf `/`).
- Lokal verifiziert vor dem Push: alle 5 Specs grün — `npx playwright test e2e/completed-tasks.spec.ts e2e/issue-1063-geo-badge.spec.ts e2e/issue-1105-routes.spec.ts e2e/search-modal.spec.ts e2e/tasks-tab-filter.spec.ts` = **33 passed (1.5m), EXIT=0**. Prettier (unchanged), ESLint (0), Pre-Commit-Hook: format/knip/lint ✔ (inkl. `tsc --noEmit` frontend+server).
- **Commit `79511753` gepusht** (ai/harness/1105). Review-Thread `PRRT_kwDONloM186dXTLE` (Inline-Kommentar 3885578512) beantwortet (PRRC_kwDONloM187nmu5A) und **resolved=true**. Soft-Deadline war dabei überschritten (1787980946 ≥ 1787980330) → kein weiterer Kreislauf in diesem Lauf.

## Relevante Stellen
- `frontend/src/App.tsx:~197-210` — `tabsCallbacks.onSelect` (Fix 3, Memo-Deps inkl. `searchParams`).
- `frontend/src/App.tsx:~735-750` — SearchModal-`onSearch` (Fix 1).
- `frontend/src/App.tsx:~800` — `App`-Export mit BrowserRouter (Fix 2).
- `frontend/src/App.tsx:105-121` — `applyTaskFilter` (setSearchParams-Updater), bleibt für Filterfeld/„Filtern"-Button in Nutzung.
- `frontend/src/App.tsx:598-707` — KolTabs: Panel-Inhalte sind (bis auf `tab-2`) immer gerendert → Checkbox-Node ist stabil, Rennen kommt von der Query-Navigation, nicht von einem Remount.
- `frontend/e2e/completed-tasks.spec.ts:41-53`, `frontend/e2e/issue-1063-geo-badge.spec.ts:76-86` — Helper mit `.check()`/`.uncheck()` am URL-getriebenen Switch (die roten Stellen).

## Annahmen
- `v7_startTransition`/`v7_relativeSplatPath` Opt-in ist verhaltensneutral (keine `*`-Route, keine Relativ-Links in Splat); `future=` war vorher nirgends gesetzt.
- Query-Erhalt über Tab-Wechsel hinweg ist die gewollte Semantik (vor der Migration war der Filter Komponenten-State und überlebte Tab-Wechsel ebenso). Randfall: `/?view=done` kann als „leere" Query am Dashboard hängen — Dashboard ignoriert sie.
- KolTabs-`_on`-Neuverdrahtung bei Query-Änderung resetet die Auswahl nicht (`_selected` ist prop-getrieben); e2e-Lauf bestätigt.

## Verworfen
- Neuer AK5b-Route-Test für „Suche aus `/`" — Duplikat von `search-modal.spec.ts` Test 1; URL-Assertion dort ergänzt.
- `waitForStableView`/Test-Helper-Lockerung in den roten Specs — Symptom-Bekämpfung; Ursache war die Query-clobbernde Tab-Navigation.
- `key`-Prop am Switch (Subagenten-Vorschlag) — hätte das Symptom maskiert, nicht die Query-Verwerfung behoben.
- Help/Settings-Close (`closeHelp`→`navigate('/')`, `closeSettings`→`navigate('/')`) ebenfalls auf Query-Erhalt umstellen — nicht Teil des Findings, nicht CI-rot, Verhaltensentscheidung; als Folge-Thema notiert.

## Offen
- Stencil-`nodeType`-console.error beim „Weitere Aktionen"-Popover (TaskTree) — pre-existing-Status ungeklärt (nicht gegen main gemessen), von den fixup-Findings unabhängig, blockt nichts (Tests grün). Folge-Ticket-Thema.
- CI des Fixup-Commits `79511753` läuft noch — falls weiterhin rot, nächster Fixup-Kreis (Kandidaten: e2e-Shard-Timing).
- Wegwerf-Artefakt `frontend/e2e/tmp-debug-uncheck.spec.ts` vor dem Commit gelöscht (bestätigt via `git status`).

## Nächster Schritt
- Nächster Fixup-/Review-Kreis: CI von `79511753` prüfen (`gh pr checks 1107`); bei grün → Re-Review über `review-kreuzverhoer` (Verkehr-Licht), sonst Diagnose aus dem CI-Log.

## Fallstricke
- **Tab-Navigation + Query-State**: ein nackter Pfad in `navigate()` verwirft `?q=`/`?view=` — und Klicks auf den aktiven Tab werden zur zweiten Navigation, die mit kontrollierten Inputs rivalisiert (Playwright „did not change its state").
- `useMemo`-Callbacks, die `searchParams` lesen, brauchen es in den Deps — sonst stale Query (ursprünglicher Kommentar „stabile Callback-Identität" gilt nur für `_tabs`, nicht `_on`).
- `setSearchParams` im selben Handler wie `navigate` ist die Falle aus F1 — Ziel-Location immer als Objekt `{ pathname, search }`.
- Stencil-Slot-Renderfehler werden von Stencils eigenem `enqueue` nur als console.error geloggt und geschluckt → Test bleibt grün, Fehler sieht man nur im Vite-Log.
- e2e nie über `pnpm --filter frontend test:e2e -- <pattern>` filtern (filtert nicht) — direkt `npx playwright test <datei>` im `frontend`-Verzeichnis. Webserver-Spam (Vite-Client-Console) ist riesig → e2e-Läufe immer mit Output in Datei im Hintergrund.
- Playwright-Chromium liegt in `~/.cache/ms-playwright/chromium-1234`; `frontend/node_modules` vorhanden → kein Install nötig.
