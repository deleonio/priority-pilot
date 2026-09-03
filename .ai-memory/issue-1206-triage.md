# Issue 1206 — Triage (Phase 1), Stand 2026-09-03T18:28:30Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 2026-09-03T18:23:52Z, keine Entscheidungen). Analyse-Block + Routing-Tabelle als Harness-Kommentar angelegt (issuecomment 5530284307, HID `IC_kwDONloM188AAAABSaFxEw`), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt, Endstand verifiziert. Kein Ping, Titel unangetastet (trifft zu), kein Body-Edit (ADR 0009), kein Auto-Close (Anforderungen klar nicht implementiert).

## Erledigt
- Trigger geprüft: Initial-Triage; Issue-Body komplett gelesen (Titel + Body per `gh issue view 1206 --json title,body,labels`).
- Code-Recherche: `frontend/src/components/HelpPage.tsx` komplett gelesen (116 Zeilen), `.github/release.yml` komplett, Live-API-Stichprobe der Releases (`curl api.github.com …/releases?per_page=2`), `HelpPage.test.tsx` AK-Struktur (#1190-Tests), `frontend/package.json` (react-markdown 10.1.0, KEIN remark-gfm), `frontend/src/app.css:1544` (`.help-changelog-entry`).
- Analyse-Block via `.ai-memory/issue-1206-block.md` + `gh issue comment --body-file` erstellt; Marker-Zeile `<!-- ai-harness -->` erste Zeile; Landing + Labels verifiziert.

## Relevante Stellen
- `frontend/src/components/HelpPage.tsx:22` — `RELEASES_URL` (GitHub-Releases-API, 30 Stück, public ohne Token); bleibt Datenquelle.
- `frontend/src/components/HelpPage.tsx:3,88` — `ReactMarkdown` importiert, Handbuch-Tab rendert `[text](url)`-Links korrekt — Muster für Changelog-Tab.
- `frontend/src/components/HelpPage.tsx:109` — Release-Body per ReactMarkdown; nackten URLs werden NICHT verlinkt (keine Autolink-Literals) → `remark-gfm` als Plugin ergänzen (neue Dependency in `frontend/package.json`).
- `frontend/src/components/HelpPage.tsx:99-111` — per-Release-`<section>` mit h2-Version → hier entsteht die Kategorien-Aggregation (###-Abschnitte je Body parsen, über Releases mergen).
- `.github/release.yml` — Kanon der Kategorien und deren Reihenfolge: 💥 Breaking Changes, 🎉 New Features, 🐞 Bug Fixes, 🚀 Improvements, 🔧 Engineering, Other Changes (Catch-all `'*'`).
- `frontend/src/lib/extractLeaves.ts` + `.test.ts` — Muster für ausgelagerte reine Logik: Aggregations-Parser ist Kandidat für `frontend/src/lib/changelog.ts`.
- `frontend/src/components/HelpPage.test.tsx:120-145` — bestehende #1190-AK-Tests (h2-Versionsliste, h3-Kategorien je Release) — AK „flache Liste in API-Reihenfolge" wird bewusst geändert.
- `frontend/src/app.css:1544-1548` — `.help-changelog-entry`/`.help-changelog-date` — Styles für die neue Kategoriestruktur anpassen.

## Annahmen
- Release-Bodys bleiben wie heute serverseitig von GitHub generiert (release.yml + PR-Documenter-Labels) — Aggregation NUR frontend-seitig, wie vom Issue vorgegeben („Frontend-seitig" im Hint-Abschnitt).
- „0.1-Serie" = alle geladenen Releases (per_page=30 reicht für die aktuelle Serie); keine Serien-Auswahl-UI nötig.
- Design-Freiheit (Versions-Badge pro Eintrag, Datum-Anzeige) an Spec-Phase delegiert — nicht blockend, im Analyse-Block als Offene-Fragen-Hinweis vermerkt.
- Routing-Werte nach Muster #1095 (ux ja/sonnet/medium da sichtbare UI-Neustrukturierung des Tabs, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high).

## Verworfen
- Link-Problem als react-markdown-Bug deuten — Bodys enthalten gar keine `[text](url)`-Markdown-Links, sondern nackte URLs (per API-Stichprobe v0.1.694/v0.1.693 belegt: `… in https://github.com/…/pull/1203`, `**Full Changelog**: https://…`).
- Serverseitige Aggregation/Proxy — Issue schreibt Frontend-Lösung vor; API bleibt unverändert.
- Split — eine Komponente + eine Dependency + Tests = ein PR.
- Titel-/Body-Copyedit — Titel treffend, Body präzise (Problem/Soll/Messgrößen).
- MEMORY.md-Eintrag — kein neuer Fehler/Werkzeug-Eigenheit, Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1206-block.md` ist Wegwerf-Artefakt (gesendeter Kommentar-Body) — NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): Layout der Kategoriestruktur (Reihenfolge, Versions-Kennzeichnung pro Eintrag, Mobile 375px) als KI-UX-Block in den Harness-Kommentar.

## Fallstricke
- Führender `<!-- Release notes generated … -->`-HTML-Kommentar im Release-Body muss der Parser ignorieren.
- `**Full Changelog**: <bare-url>`-Zeile je Body: bei naivem Mergen taucht sie 30× auf — entschieden: gehört zu den normalen Abschnitten? Nein, sie steht NACH den Abschnitten ohne Header; Parser darf sie nicht als eigenen Abschnitt einsammeln (im AK3-Zähler nicht als Bullet).
- react-markdown-Plugin-Prop: `remarkPlugins={[remarkGfm]}` — auch im Handbuch-Tab unbedenklich, aber nur Changelog zwingend nötig; Spec entscheidet Scope (beide Tabs gleich konfigurieren ist das einfachere Muster).
- Bestehende #1190-Tests nicht blind löschen: nur die h2-Versionslisten-Erwartung ändert sich; Lazy-Load/Retry-Tests (AK4/AK5 dort) müssen grün bleiben (AK5 hier).
- E2E-Messung: Bounding-Box statt scrollWidth (App-Shell clippt overflow-x:hidden, MEMORY 2026-08-24).
