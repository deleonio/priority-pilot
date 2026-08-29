# Issue 1105 — Review (Kreuzverhör PR 1107), Stand 2026-08-29

**ERGEBNIS: VERDICT needs-fixup, 1 Finding (F1).** MODE = Kreuzverhör (kein `<!-- ai-review -->`-Marker vorhanden). Titel per Title-Gate umbenannt: „feat(frontend): app routes for all menus via react router (#1105)“ (vorher deutsch/ohne Type). Inline-Kommentar F1 + Sammelkommentar gepostet (beide URLs unten).

## Erledigt
- Titel-Gate: `gh pr edit 1107 --title "feat(frontend): app routes for all menus via react router (#1105)"` (Conventional Commits, 63 Zeichen).
- Kompletten Diff gelesen (9 Dateien, +523/−59): nur `.ai-memory/*` (3 Phasen-Notizen, ADR-0007-konform im PR), `docs/spec/issue-1105.md`, `frontend/e2e/issue-1105-routes.spec.ts` (8 Tests), `frontend/src/App.tsx`, `frontend/src/components/SettingsPage.tsx`, `frontend/package.json` + lock.
- AK-Abgleich: AK1–AK4 (AppShell/App-Split, `ROUTE_PATHS`/`SETTINGS_PATH_SEGMENTS` App.tsx:57-61, `activeTab = Math.max(0, indexOf)`), AK5 (`?q=`/`?view=` via useSearchParams), AK6/AK8 (Kontrakt-Guards), AK7 (31 Regression-e2e im PR-Body belegt). Hand-strick-pushState/popstate (App.tsx:132-139, 296-312 alt; SettingsPage.tsx:55-62 alt) nachweislich entfernt → AK4 erfüllt.
- F1 gepostet: https://github.com/deleonio/priority-pilot/pull/1107#discussion_r3885578512 (App.tsx:735).
- Sammelkommentar gepostet: https://github.com/deleonio/priority-pilot/pull/1107#issuecomment-5460326274 (Marker `<!-- ai-review -->`, needs-fixup, Review-Typ: Kreuzverhör).

## Relevante Stellen
- `frontend/src/App.tsx:734-743` — SearchModal-`onSearch`: `navigate('/aufgaben')` + `applyTaskFilter(query)` in einem Handler → **F1** (Konkurrenz zweier Navigationen; `setSearchParams` löst gegen die Closure-Location auf).
- `frontend/src/App.tsx:57-61` — `ROUTE_PATHS` (Index = Tab-Index) + `SETTINGS_PATH_SEGMENTS` (general/pillars/llm); Quelle der URL-Ableitung.
- `frontend/src/App.tsx:113` — `activeTab = Math.max(0, ROUTE_PATHS.indexOf(pathname))`: unbekannter Pfad/Trailing-Slash stumm → Tab 0 (Dashboard). Schwacher Punkt, kein Finding.
- `frontend/src/App.tsx:118-121` — Settings-Regex + Fallback 1 (Säulen) = bisheriges Default (#886-Verhalten erhalten).
- `frontend/src/App.tsx:787-793` — `BrowserRouter` bewusst um `AppShell` IN `App` (nicht main.tsx), damit `App.test.tsx` ohne Router grün bleibt — dokumentiert, akzeptiert.
- `frontend/src/components/SettingsPage.tsx:56-62` — `tab`/`onTabChange`-Props + `localTab` (Default 1) für den prop-losen Unit-Test-Fall; `setLocalTab` ist im App-Fall toter Zustand (dokumentiert).
- `frontend/e2e/issue-1105-routes.spec.ts` — 8 Tests: AK1×3 (Deep-Link), AK2 (Back/Forward), AK4 (pushState+popstate → Tab-Ableitung), AK5, AK6, AK8 (375px Bounding-Box). AK3 dedupliziert (settings-page.spec + llm-settings.spec) mit Begründung im Quelltext.

## Annahmen
- F1 ist tatsächlich defekt (nicht nur theoretisch): Verhalten von `setSearchParams` bei zwei Navigationen im selben Handler aus React-Router-v6-Semantik (relative Auflösung gegen Render-Closure) abgeleitet, NICHT im Browser ausgeführt. Der grüne AK5-Test widerlegt F1 nicht — er startet bereits auf `/aufgaben`, daher ist `navigate('/aufgaben')` dort ein No-op.
- AK5-`?q=`-Assertions (`/\/aufgaben\?.*q=1105-Offen/`) grün laut PR-Body/Phasen-Notiz (8/8 passed, 18.9 s); eigene Testläufe nicht wiederholt (Zeit-/Sandbox-Budget, node_modules nicht installiert).
- `.ai-memory/*.md` im PR sind gewollt (ADR 0007: reisen mit `ai/harness/{N}` nach main) — kein Finding.

## Verworfen
- needs-human — F1 ist konkret und im Code fixbar (eine Navigation mit explizitem Ziel); keine Architektur-/Produktfrage.
- Finding zu `Math.max(0, indexOf)` (stummer Dashboard-Fallback bei unbekanntem Pfad) — Verhalten identisch zum vorherigen Default-State, rein theoretisch, kein Regression-Risiko.
- Finding zu `localTab` als Doppeel-State in SettingsPage — dokumentierter Kompromiss zugunsten von `SettingsPage.test.tsx` ohne Router; kein Bug.
- KoliBri-first-Prüfung vertieft — keine neuen UI-Elemente/eigene Styles im Diff (nur KolTabs/Modals unverändert weiterverwendet).
- 375px-Screenshot-Runde des Impl-Phase-Verzichts nachgefordert — AK8 e2e prüft Bounding-Boxen deterministisch, Ersatz ausreichend.

## Offen
- -

## Nächster Schritt
- Fixup-Runde: F1 umsetzen (eine Navigation mit `{ pathname, search }`) + ergänzenden e2e-Test „Suche aus `/` → `/aufgaben?q=…` + Aufgaben-Tab aktiv“; danach Fixup-Nachweis-Review (MODE über Marker-Suche, F1 in „Behobene Anmerkungen“ verschieben).

## Fallstricke
- REST `POST /pulls/<n>/comments` verlangt für Multi-Line-Anker `commit_id` + `line` + `side` — ohne `commit_id` gibt es 422 „positioning wasn't supplied“ (Head-SHA via `gh pr view --json headRefOid`).
- Bash-Heredoc für Kommentar-Bodies nutzen: `BODY="…( `(` im String )…"` bricht mit `syntax error near unexpected token '('` (Parens in Double-Quotes + Escape-Kombination).
- `gh pr diff <n> -- file1 file2` akzeptiert nur 1 Argument → Diff in Datei schreiben und per `awk '/^diff --git a\/PFAD/,/^diff --git/'` extrahieren.
- Sammelkommentar-Suche vor dem Posten: `gh api repos/…/issues/<n>/comments --jq '.[] | select(.body | contains("ai-review")) | .id'` — beim Erstlauf leer → `gh pr comment` (create), nicht PATCH.
- AK5-Test deckt den SearchModal-Pfad NICHT ab (startet auf `/aufgaben`) — Fixup-Test muss aus einem anderen Tab starten, sonst ist die Lunge unsichtbar.

## Fixup-Nachweis (Runde 2), 2026-08-29T05:29Z
- Erledigt: MODE=Fixup-Verifikation (Marker `<!-- ai-review -->` vorhanden, Kommentar-ID 5460326274, Stand R1 = 2026-08-29T04:27:06Z). Fixup-Diff = `5da69f29d..795117538` (nur `frontend/src/App.tsx` + `frontend/e2e/search-modal.spec.ts`, Rest memory-commits). F1 behoben: `App.tsx:746-752` einzelnes `navigate({ pathname: '/aufgaben', search: next.toString() })`, `applyTaskFilter` entfernt (sicher, weil `taskSearch` = `searchParams.get('q')` in `App.tsx:98` selbst ableitet), e2e `search-modal.spec.ts:72-74` prüft `/\/aufgaben\?(.*&)?q=Match/`. Sammelkommentar per PATCH aktualisiert (Review-Typ: Fixup-Nachweis, F1 → Behobene Tabelle), VERDICT reviewed.
- Relevante Stellen: `App.tsx:196-209` (onSelect trägt jetzt `searchParams.toString()` → Query bleibt beim Tab-Wechsel erhalten, deps um `searchParams` erweitert), `App.tsx:809` (`BrowserRouter future={{ v7_relativeSplatPath, v7_startTransition }}` gegen e2e-Vertrag #865 AK6), `e2e/issue-1105-routes.spec.ts:63/73/141` (AK2-Artefakte).
- Annahmen: Query-Erhalt auf Nicht-Aufgaben-Tabs (`/wald?q=…`) ist gewollt (kommentiert, Parameter dort wirkungslos, Filter-Restore bei Rückkehr); CI (e2e 1–4, verify) war beim Abschluss noch pending — Gate entscheidet merge, Review-Urteil nur inhaltlich.
- Verworfen: Neues Finding zu Query-Drift auf fremde Tabs — begründet, keine AK-Verletzung, kein testbarer Schaden.
- Offen: -
- Nächster Schritt: Merge/Gate übernimmt; kein weiterer Review-Lauf nötig, außer neue Commits landen.
- Fallstricke: Kommentar-ID für PATCH ist numerisch (5460326274), das node-id-Format (`IC_…`) gibt 404 auf `issues/comments/<id>`.
