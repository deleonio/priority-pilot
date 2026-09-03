# Issue 1190 — Triage (Phase 1), Stand 2026-09-03T10:42:00Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 2026-09-03T00:01:11Z, keine Entscheidungen). Analyse-Block + Routing-Tabelle als Harness-Kommentar erstellt (`gh issue comment --body-file`), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt. Kein Ping, kein Titel-/Body-Edit (Titel „Changelog-Tab neben dem Handbuch" trifft zu), kein Split (nur Frontend, ein PR), kein Auto-Close (`HelpPage.tsx` hat keine Tabs — Datei gelesen, Stand main).

## Erledigt
- Issue + Kommentare geladen, Trigger = Initial-Triage bestimmt.
- Code-Recherche: `frontend/src/components/HelpPage.tsx` komplett gelesen (fetch `/user-guide.md` → ReactMarkdown, Catch-Fallback Z. 17-20), `frontend/src/App.tsx:571` (Mount via `showHelp`), `frontend/src/components/SettingsPage.tsx:243` (KolTabs-Muster: `_tabs`-Modulkonstante, beide Panels gemountet, inaktive hidden), `.github/release.yml` (Kategorien + Renovate/Dependabot-Doppelausschluss), `.github/workflows/deploy.yml:121` (`gh release create --generate-notes`), `frontend/e2e/help.spec.ts` (#256-Präzedenz).
- Live-Check API: `curl api.github.com/repos/deleonio/priority-pilot` → `"private": false`; Releases öffentlich ohne Token abrufbar, Body = Markdown mit `### <Kategorie>`-Headings (Beispiel v0.1.693 geprüft).
- Phase-Notiz + Harness-Kommentar + Labels geschrieben.

## Relevante Stellen
- `frontend/src/components/HelpPage.tsx` — einzige zu ändernde Komponente: KolTabs (Handbuch default, Changelog) + Release-Fetch + Fallback.
- `frontend/src/components/SettingsPage.tsx:243-246,356` — KolTabs-Vorbild (`_tabs`-Konstante außerhalb des Renders, Panels bleiben gemountet).
- `https://api.github.com/repos/deleonio/priority-pilot/releases?per_page=30` — Datenquelle; Felder `tag_name`, `published_at`, `body`.
- `.github/release.yml` — Kategorien (Breaking/Features/Fixes/Improvements/Engineering) + Renovate/Dependabot-Ausschluss passieren UPSTREAM bei Release-Erstellung; Frontend rendert Body nur.
- `frontend/vite.config.ts:42-47` — user-guide.md wird per Middleware aus `docs/user-guide.md` serviert (Kontext für Handbuch-Tab, unverändert).
- Tests: neu `frontend/src/components/HelpPage.test.tsx` (existiert noch nicht), e2e `frontend/e2e/help.spec.ts` erweitern oder neue `frontend/e2e/changelog.spec.ts`.

## Annahmen
- Frontend-Direktruf der GitHub-API (Issue-Wortlaut „Die Hilfe-Seite holt sich die Releases über die öffentliche GitHub-Releases-API"); kein Server-Proxy, keine openapi.yml-Änderung. Unauth-Rate-Limit 60 req/h/IP ist für einen Help-Tab verkraftbar (lazy beim ersten Changelog-Tab-Öffnen).
- „letzte rund 30" = `per_page=30`, fix im Code (kein UI-Regler).
- Datum-Darstellung de-DE (App ist deutsch); „Versionsnummer" = `tag_name` (v0.1.NNN).

## Verworfen
- Server-Proxy-Route (Muster geocodeSearch.ts) — Issue nennt die Hilfe-Seite als Abrufer, Repo ist public, kein Token nötig; Proxy wäre unnötiger Code.
- Titel-/Body-Copyedit — nicht substantiell falsch.
- Split — nur Frontend, ein zusammenhängender AK-Satz, ein PR.
- Frontend-Filter gegen Renovate/Dependabot — doppelt upstream gesichert (release.yml `exclude.authors` + `release:ignore`-Label im Documenter); Filter im Frontend wäre redundant.
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1190-comment.md` ist Wegwerf-Artefakt (Kommentar-Body) — NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Tab-Darstellung, Changelog-Listenlayout, Fallback-Meldung, Mobile-First beraten.

## Fallstricke
- Routing-Tabelle im Harness-Kommentar ist bindend: ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high.
- KolTabs: Panels via `[slot^="tabpanel-slot-"]` lokalisieren, Trigger via `getByRole('tab', { name })` — KolTabs renamed Slots zur Laufzeit (MEMORY 2026-08-23).
- Unit-Tests mit gemocktem `fetch` (jsdom), NICHT e2e gegen live GitHub-API (Rate-Limit/Flakiness in CI); e2e nur Tab-Existenz/Wechsel + 375px-Bounding-Box (App-Shell clippt overflow-x:hidden, MEMORY 2026-08-24).
- Release-Body beginnt mit HTML-Kommentar `<!-- Release notes generated … -->` und endet mit „Full Changelog"-Link — react-markdown (ohne rehype-raw) ignoriert rohes HTML; falls störend, Body trimmen.
- Handbuch-Default-Tab und `/hilfe`-Route (e2e help.spec.ts #256-Tests) nicht brechen.
