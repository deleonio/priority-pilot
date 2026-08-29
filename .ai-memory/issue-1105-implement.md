# Issue 1105 — Implement (React Router v6), Stand 2026-08-29

## Erledigt
- Spec-PR #1107 (Draft, `ai/harness/1105`) übernommen; rote Tests aus `frontend/e2e/issue-1105-routes.spec.ts` wurden NICHT geändert und sind jetzt grün: 8/8 passed (18.9s).
- `react-router-dom@6.30.6` in `frontend/package.json` installiert (AK1).
- `frontend/src/App.tsx`: Komponente in `AppShell` (Hooks + Navigation) umbenannt, dünner Wrapper `export const App` rendert `<BrowserRouter><AppShell/></BrowserRouter>` — Router INNERHALB von App, damit `App.test.tsx` (rendert `<App user>` ohne Router) grün bleibt. `showHelp`/`showSettings`-State → `location.pathname.startsWith(...)`; `activeTab` = reine Funktion des Pfads (`ROUTE_PATHS`-Modulkonstante, `Math.max(0, indexOf)`); pushState-Handler `openHelp/closeHelp/openSettings/closeSettings` → `navigate(...)`; popstate-Listener (Zeilen 132–139) entfernt; `tabsCallbacks.onSelect` → `navigate(ROUTE_PATHS[selected]) + reload()`; `handleLogoDashboard` → `navigate('/')`; SearchModal-Handler `setActiveTab(1)` → `navigate('/aufgaben')`.
- AK5: `taskSearch` = `searchParams.get('q')`, `taskViewMode` = `searchParams.get('view') === 'done'` (URL als Quelle, kein lokaler State); `applyTaskFilter`/`changeTaskViewMode` schreiben per `setSearchParams(prev => …)` zurück (leerer Suchbegriff löscht `q`); `searchDraft` bleibt lokaler State, per `useEffect` an `q` synchronisiert.
- `frontend/src/components/SettingsPage.tsx`: URL-Init aus `window.location.pathname` entfernt (AK4); neue Props `tab?: number` (von App aus `/settings/:tab` abgeleitet) + `onTabChange?: (tab:number)=>void`; intern `localTab` (Default 1 = Säulen, wie bisheriger Fallback), `activeTab = tab ?? localTab`, `onSelect` ruft `onTabChange?.(selected)`.
- Gate lokal grün: `pnpm format` + `prettier --check .`, `pnpm lint` (server+frontend inkl. tsc), `pnpm knip`, `pnpm test` im frontend (44 Dateien / 460 passed, 13 skipped). Root-`pnpm test` bewusst NICHT ausgeführt (Redis-Integration in session.test.ts, siehe MEMORY 2026-08-29 + PR-Body).
- E2E-Regression: `npx playwright test e2e/help.spec.ts e2e/settings-page.spec.ts e2e/settings-tabs.spec.ts e2e/tasks-tab-filter.spec.ts e2e/llm-settings.spec.ts` → 31 passed (42.1s) (AK7).

## Relevante Stellen
- `frontend/src/App.tsx` — `AppShell`/`App`-Split, `ROUTE_PATHS`/`SETTINGS_PATH_SEGMENTS`-Modulkonstanten, Query-Parameter-Logik (AK1–AK6).
- `frontend/src/components/SettingsPage.tsx:56-62` — `tab`/`onTabChange`-Props statt URL-Init (AK4).
- `frontend/package.json` — `react-router-dom` 6.30.6 (Dependency neu).
- `frontend/e2e/issue-1105-routes.spec.ts` — unveränderter Vertrag (8 Tests, alle grün).

## Annahmen
- Playwright-MCP-375/1280-Screenshot-Runde übersprungen: keine sichtbare UI-Änderung (KolTabs/Modals unverändert), Layout bei 375px wird deterministisch durch AK8 (Bounding-Box-Assertions) eingeklagt — im PR-Body dokumentiert.
- Vite-Dev-Server liefert SPA-Fallback für Deep-Links (`/serien` etc.) — e2e-Proof erbracht.
- React-Router-v6-Future-Flag-Warnungen in der Browser-Konsole sind kosmetisch (v7-Opt-in-Hinweise), kein AK-Bruch.

## Verworfen
- Router in `main.tsx`/`Root.tsx` statt in `App` — hätte `App.test.tsx` (17 Tests, rendert ohne Router) gebrochen; Trennung von Test-Verantwortung (Spec-Modus: Tests unangetastet).
- `useLocation`/`useNavigate` direkt in `SettingsPage` — hätte `SettingsPage.test.tsx` (rendert ohne Router, `replaceState`-Muster Zeile 83) gebrochen; stattdessen Props von App.
- Eigene Route-Definitionen mit React-Router-`<Routes>` — Tabs sind eine einzige Ansicht mit abgeleitetem Index; `useLocation`-Ableitung reicht und hält den KolTabs-Slots-Mechanismus intakt.

## Offen
- Root-`pnpm test` (inkl. Server) lokal nicht gelaufen: `session.test.ts` braucht Redis (nur CI-Service); Muster aus MEMORY 2026-08-29. CI muss das liefern.

## Nächster Schritt
- Review-Phase (Kreuzverhör) über PR #1107; falls Findings: Settings-Tab-Ableitung (`SETTINGS_PATH_SEGMENTS`) und Query-Sync (`useEffect → searchDraft`) sind die wahrscheinlichsten Diskussionspunkte.

## Fallstricke
- `activeTab` NICHT als State führen: `KolTabs` bekommt `_selected={activeTab}` — bei State + URL-Ableitung divergieren beide (genau AK4). Jede Rest-`setActiveTab`-Referenz entfernen (grep!).
- SettingsPage-Tab ohne Prop auf 1 (Säulen) defaulten, nicht 0 — bisheriger Fallback und Unit-Tests gehen davon aus.
- `searchDraft` muss lokaler State bleiben (sonst verliert das Feld den Entwurf beim Tippen, weil `setSearchParams` erst beim „Filtern" feuert).
- e2e-Ausgabe kann 9 MB Console-Noise enthalten (kol-toolbar `nodeType`-Errors im WebServer-Log) — Summary per `grep -E "passed|failed"` aus der gespeicherten Datei ziehen, nicht `tail` auf den Live-Stream.
