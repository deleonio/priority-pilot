# Issue 1169 — Triage (Phase 1), Stand 2026-09-02T19:33:06Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions ai-quality-Check 2026-09-02T06:52:26Z, keine Entscheidung). Harness-Kommentar erstellt (https://github.com/deleonio/priority-pilot/issues/1169#issuecomment-5515221872) mit KI-ANALYSE-Block + Routing-Tabelle, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt (Endstand verifiziert). Kein Ping, Titel/Body unangetastet, kein Auto-Close (kein Konfetti-Code im Repo — vom recherche-Agent per grep bestätigt).

## Erledigt
- Issue geladen (`.ai-memory/issue-1169-input.json`), Trigger = Initial-Triage bestimmt, Body komplett analysiert (6 messbare Kriterien direkt als AK1–AK6 übernommen).
- Code-Recherche an `recherche`-Subagent delegiert (ADR 0008); Kern-Zitate selbst verifiziert: `App.tsx:382-385` (`handleDoneToggle`, `markingDone`-Flag), TaskTree-Props (`TaskTree.tsx:23,57,144`), beide Mounts `App.tsx:689,703`, `app.css:187` (`@media (prefers-reduced-motion: reduce)` — nur CSS-Token, kein JS).
- Harness-Kommentar per `gh issue comment --body-file .ai-memory/issue-1169-comment.md` erstellt; Labels gesetzt + verifiziert.

## Relevante Stellen
- `frontend/src/App.tsx:382-426` — `handleDoneToggle`; `markingDone` :385 ist DAS Richtungskriterium; Konfetti-Trigger in den `markingDone`-Zweig (:399-411) = ein Choke-Point für beide Issue-Stellen.
- `frontend/src/App.tsx:689,703` — beide TaskTree-Mounts (Dashboard-Liste + Aufgaben-Route) laufen durch `handleDoneToggle`.
- `frontend/src/components/TaskTree.tsx:142-145` — „…"-Popover (KolPopoverButton → toolbar) ruft `onDoneToggle`; Label-Wechsel :72 (`Wieder öffnen`/`Erledigt`).
- `frontend/src/components/UpdatePrompt.tsx:61` + `app.css:1765-1778` — fixed-Overlay-Vorbild mit `pointer-events: none` (AK5-Vorlage); einzige z-indices: 1000 (:1765ff) und 1 (:1416).
- `frontend/src/lib/use-is-mobile.ts:13` — matchMedia-Hook-Präzedenz für prefers-reduced-motion-Abfrage in JS.
- `frontend/src/app.css:187-192` — bestehendes reduced-motion-CSS (Token auf 1ms) — reicht NICHT für AK6 (Partikel-Canvas läuft trotzdem), deshalb JS-Guard als AK.
- `frontend/e2e/done-toggle.spec.ts` — E2E-Vorlage: API-Seed :34-41, Popover-Navigation :67-81, 375px :133; `frontend/e2e/fixtures.ts:28-41` (auth-Mock), `helpers.ts` `waitForStableView`.
- Neu zu erstellen: `frontend/src/lib/confetti.ts` (+ `.test.ts`), `frontend/e2e/issue-1169-confetti.spec.ts`.

## Annahmen
- CompleteTaskDialog/Signal-Panel-Pfad (`completeTask`, `App.tsx:431-443`) ist NICHT Scope — Issue nennt nur die zwei „…"-Popover-Stellen; als Randbedingung im Block verankert (bewusste Abgrenzung, keine offene Frage).
- Eigenbau-Canvas ohne neue Dependency ist Empfehlung (package.json hat keine Animations-Lib), nicht Festschreibung — Issue delegiert Technik explizit an die Umsetzung.
- „ca. 5 Sekunden" → Toleranzfenster 4–6 s als prüfbare AK2-Formulierung gewählt.
- Routing (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) folgt etabliertem Muster (#1083, #1095).

## Verworfen
- needs-human — Issue ist eindeutig: Stellen benannt, Kriterien messbar, Technik-Entscheidung laut Vorklärung explizit delegiert.
- Titel-/Body-Copyedit — Titel treffend, Body gut strukturiert; pro-forma-Editz verboten.
- Split — eine Komponente + Overlay + Tests = ein PR.
- Bibliothek (canvas-confetti o. ä.) als Festschreibung — Eigenbau empfohlen, Decision der Impl-Phase überlassen.
- MEMORY.md-Eintrag — kein neuer Fehler/Experience-Kriterium erfüllt.

## Offen
- `.ai-memory/issue-1169-input.json` + `issue-1169-comment.md` sind Wegwerf-Artefakte — NICHT committen; nur diese Datei ist die Phasen-Notiz (`rm` braucht Freigabe, Muster #1083/#1095).

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): KI-UX-Block in denselben Harness-Kommentar schreiben (read-modify-write, KI-ANALYSE + Routing byte-identisch halten).

## Fallstricke
- Harness-Kommentar-Update nur per GraphQL `updateIssueComment` mit KI-UX-Block VOR dem Routing-Block eingefügt — KI-ANALYSE/Routing unangetastet lassen.
- E2E-Klicks laufen bei offenem Overlay: ohne `pointer-events: none` fressen fixed-Overlays die Klicks (Playwright `toggle.click()` schlägt fehl) — AK5 ist auch E2E-Selbstschutz.
- `DONE_REMOVAL_DELAY_MS = 5000` (`App.tsx:66`, Sticky-Entfernung) und Konfetti-Dauer 5 s sind unabhängig voneinander — nicht koppeln.
- jsdom/Vitest: `matchMedia` muss in Unit-Tests gemockt werden (jsdom liefert keines mit Preferences); E2E nutzt `page.emulateMedia({ reducedMotion: 'reduce' })`.
- Frame-Metrik-Aussage in CI nicht zuverlässig messbar — TF4 begründet Ruckel-Freiheit architektonisch (rAF + feste Partikelzahl), nicht per Metrik.
