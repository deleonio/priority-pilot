# Issue 1105 — Triage (Phase 1), Stand 2026-08-29T03:46:23Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein KI-ANALYSE-Block; einziger Kommentar = github-actions-Qualitätscheck 2026-08-29T02:22:42Z, keine Entscheidung). Analyse-Block + Routing-Tabelle in den Body angehängt, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (ux=nein → direkt Spec). Kein Ping-Kommentar, kein Titel-/Body-Copyedit, kein Split (Frontend-only, ein zusammenhängender AK-Satz = ein PR). Kein Auto-Close: `react-router-dom` ist NICHT in frontend/package.json → Anforderungen offenkundig nicht erfüllt.

## Erledigt
- Issue geladen, Trigger bestimmt, kompletten Body analysiert (Routen-Tabelle, Dialog-Modals-Regel, React-Router-v6-Entscheidung, AKs aus Body übernommen und verifizierbar ausgeformt AK1–AK8).
- Code-Recherche via recherche-Subagent: App.tsx-Nav-Struktur, SettingsPage-Tabs, Query-Param-Status, SPA-Serving, betroffene Tests (s. Relevante Stellen).
- Body-Append per `.ai-memory/issue-1105-{body,new,block,full}.md` + `gh issue edit --body-file` (gh-Newline per `head -c -1` entfernt); Landing verifiziert (Tail = ai-phase-routing:END).
- Labels gesetzt und Endstand verifiziert: `["ai:needs-spec","ai:analysed"]`.

## Relevante Stellen
- `frontend/src/App.tsx:81` — `const [activeTab, setActiveTab] = useState(0)`; Kern des zu ersetzenden Tab-State.
- `frontend/src/App.tsx:54` — `VIEW_TABS` = Dashboard/Aufgaben/Serien/Wald (nur 4 Haupt-Tabs; Hilfe/Einstellungen sind KEINE Tabs, sondern `showHelp`/`showSettings`-State).
- `frontend/src/App.tsx:132-139` — vorhandener popstate-Listener (setzt showHelp/showSettings aus Path); durch Router ersetzen.
- `frontend/src/App.tsx:296,301,307,312` — pushState für `/hilfe`, `/`, `/settings/general`; durch Router-Navigation ersetzen (AK4 verlangt Entfernung).
- `frontend/src/App.tsx:486-494` — `if (showSettings) return <SettingsPage .../>`; Render-Wechsel auf Routen umstellen.
- `frontend/src/App.tsx:87-89` — `taskSearch`/`searchDraft`/`taskViewMode` ('open'|'done') — AK5 bindet die an `?q=`/`?view=`.
- `frontend/src/components/SettingsPage.tsx:28` — `SETTINGS_TABS` = Allgemein/Säulen/KI-Provider (Reihenfolge → Index 0/1/2, passt zu general/pillars/llm).
- `frontend/src/components/SettingsPage.tsx:55-62` — Tab-Init aus `window.location.pathname`; entfernen, Route `/settings/:tab` statt dessen.
- `frontend/src/components/SettingsPage.tsx:75-82` — Settings-`onSelect` → setActiveTab; auf Navigate umstellen.
- `frontend/package.json` — react-router-dom fehlt komplett (v6 neu installieren, AK1).
- `frontend/vite.config.ts:84-89` — navigateFallback + Denylist `/^\/api\//, /^\/auth\//`: SPA-Fallback läuft über Vite-Default (dev) bzw. SW (produktiv nach SW-Activate); kein express.static im Server → Produktiv-Hosting-Fallback ist außerhalb Repo-Scope (im Block als Randbedingung).
- Tests: `frontend/e2e/help.spec.ts:46-47` (asserted `/hilfe`-URL — bleibt grün), `frontend/e2e/settings-page.spec.ts:58-60` (`/settings/general`), `frontend/e2e/settings-tabs.spec.ts`, `frontend/e2e/tasks-tab-filter.spec.ts`, `frontend/src/App.test.tsx`, `frontend/src/components/SettingsPage.test.tsx:83` (nutzt schon `window.history.replaceState`).

## Annahmen
- `docs/umsetzung-routen-plan.md` (vom Issue referenziert) existiert NICHT im Repo (ls + repo-weite Suche `*routen*`/`*router*` = leer) — Issue-Body ist selbstständig vollständig, daher nicht blockierend; im Block unter Randbedingungen dokumentiert.
- React Router v6 wie im Issue entschieden (Alternativen nicht neu bewertet — bindende Vorgabe).
- ux=nein begründet mit: reines Navigations-Verhalten, keine UI-Elemente ändern sich (Tabs bleiben KolTabs, Dialoge bleiben Modals) — Präzedenz #1095 (Verhalten ohne UI-Änderung).
- Hilfe/Einstellungen sind heute State-Flags (`showHelp`/`showSettings`), keine VIEW_TABS-Einträge — Router macht daraus Routen; „Menüs" im Issue-Titel umfasst beide (Body listet /hilfe und /settings/* explizit).

## Verworfen
- needs-human wegen fehlendem Plan-Doc — Body enthält vollständige Route-Tabelle + Entscheidung + Messkriterien; kein Klärungsbedarf.
- Split — Frontend-only, ein PR (Präzedenz #1083: sogar Server+Frontend in einem PR, hier schmaler).
- Titel-/Body-Copyedit — Issue präzise strukturiert; pro-forma-Edit verboten.
- MEMORY.md-Eintrag — kein neues Fehlermuster; Kriterien nicht erfüllt.

## Offen
- Wegwerf-Artefakte untracked in `.ai-memory/`, NICHT committen: `issue-1105-body.md`, `issue-1105-new.md`, `issue-1105-block.md`, `issue-1105-full.md`. Nur diese Datei hier (`issue-1105-triage.md`) ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests für AK1–AK8 — TF1–TF3/TF5/TF6/TF8 neu in `frontend/e2e/issue-1105-routes.spec.ts`, TF4 in `frontend/src/App.test.tsx` (jsdom: react-router MemoryRouter bzw. window.history stubben), TF7 = Regressionssuite identifizieren.

## Fallstricke
- Routing-Tabelle im Body (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) ist für Folgephasen bindend.
- jsdom + BrowserRouter: window.history/popstate in Unit-Tests nur mit Stubs; SettingsPage.test.tsx:83 nutzt schon replaceState — Muster dort abschauen.
- Alte pushState/popstate-Fragmente NICHT stehen lassen (AK4) — sonst Doppel-Navigation/Race mit Router.
- help.spec.ts/settings-page.spec.ts asserten bereits heute URLs — semantikgleich halten (keine Trailing-Slash-Abweichungen einführen).
- E2E-Filter-Falle: `pnpm --filter frontend test:e2e -- <pattern>` filtert nicht → `npx playwright test e2e/<datei>.spec.ts` im frontend-Verzeichnis (MEMORY 2026-08-26).
- AK8: Bounding-Box-Assertions statt scrollWidth (App-Shell clippt overflow-x:hidden, MEMORY 2026-08-24); KolTabs lässt inaktive Panels gemountet — Lokatoren scopen (MEMORY 2026-08-29).
