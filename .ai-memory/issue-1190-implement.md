# Issue 1190 — Implement (Phase 4), Stand 2026-09-03T11:20Z

**ERGEBNIS: VERDICT needs-review.** Implementierung + Gate grün, committet, gepusht, PR #1203 ready + Body erweitert.

## Erledigt
- Issue 1190 zugewiesen (war schon auf deleonio = Bot-Identität, kein Konflikt).
- Draft-PR **#1203** (`ai/harness/1190`) verifiziert (closingIssuesReferences enthält 1190); Branch ausgecheckt. Lokale doppelte untracked Phasen-Notizen (triage/spec/ux) als byte-identisch gegen Remote verifiziert und gelöscht (Präzedenz Spec-Notiz).
- `frontend/src/components/HelpPage.tsx` umgebaut: KolTabs (`HELP_TABS`-Modulkonstante `[{_label:'Handbuch'},{_label:'Changelog'}]`, `_selected={activeTab}`, `_on` useMemo auf `[changelog.status]`), Panel `tab-0` = bisheriges Handbuch (fetch einmalig im Mount-Effekt), Panel `tab-1` = Changelog mit Lazy-Statusmaschine `idle|loading|error|loaded` — Aktivieren von Tab 1 lädt bei `idle` ODER `error` neu (`fetchReleases()` Modulfunktion, RELEASES_URL mit `per_page=30`), bei `loaded` kein Refetch. Release-Block: `<h2>tag_name</h2>` + `<time datetime={published_at}>` mit `toLocaleDateString('de-DE')` + `<ReactMarkdown>{body}</ReactMarkdown>` (Body beginnt bei `###` → h3, kein Heading-Sprung).
- `frontend/src/app.css`: `.help-page-content code { overflow-wrap: anywhere; }` (lange Code-Spans, e2e-Fixture greift das an) + `.help-changelog-entry` Abstand + `.help-changelog-date { font-variant-numeric: tabular-nums; }`.
- Unit `HelpPage.test.tsx`: **4/4 grün** (AK1–AK3, AK5). e2e `issue-1190-changelog.spec.ts` (AK6) + bestehende `help.spec.ts` (#256): **5/5 grün** (npx playwright, Chromium installiert).
- Runner-TZ UTC verifiziert → `toLocaleDateString('de-DE')` = „2.9.2026" wie Spec-Test erwartet.
- Gate (gate-runner, 2026-09-03): `pnpm format` / `prettier --check .` / `pnpm lint` (server+frontend tsc+eslint) / `pnpm knip` (nur Config-Hints = bekannter Zustand) / `pnpm test` — **alles exit 0, 275/275 Tests grün**; der bekannte lokale Redis/session.test.ts-Fehler trat diesmal NICHT auf (Suite komplett grün). format hat nur HelpPage.tsx reformattiert (ChangelogState-Union auf eine Zeile zusammengezogen).

## Relevante Stellen
- `frontend/src/components/HelpPage.tsx` — einzige geänderte Produktivdatei (Komponente); Statusmaschine in `tabsCallbacks.onSelect`.
- `frontend/src/app.css:1536-1553` — neue Changelog-Regeln direkt nach dem help-page-Block.
- `frontend/src/components/HelpPage.test.tsx`, `frontend/e2e/issue-1190-changelog.spec.ts` — unverändert (Vertrag aus Spec-Phase).
- PR #1203 — Draft aus Spec-Phase, nach Gate: `gh pr ready 1203` + Body erweitern.

## Annahmen
- `changelog.status === 'idle' || 'error'` als Retry-Bedingung deckt AK5 (2 Calls nach Weg/Zurück) UND verhindert Refetch bei `loaded` (AK1: user-guide genau 1×, AK2: genau 1 API-Call).
- `--kolibri-color-weak` CSS-Variable existiert nicht nachweisbar → bewusst weggelassen (kein Muted-Farbe-Präzedenzfall in app.css).
- Lokale Zeitzone des CI-Runners ist UTC (Datum-Test robust); eine Nicht-UTC-Zone könnte den de-DE-Tag verschieben — Spec hat das so verankert, nicht zusätzlich abgesichert.

## Verworfen
- `useMemo` ohne Deps mit Ref-Zugriff für onSelect — `loading`-Re-Entrancy-Guard läuft über Statusvergleich in der Dep-Abhängigkeit `[changelog.status]`; einfacher und folgt SettingsPage-Muster #323.
- Zustand `ChangelogState` mit `releases` im State statt separatem Array — ein Objekt pro Status verhindert inkonsistente Kombis.

## Offen
- -

## Nächster Schritt
- Review-Phase (Workflow setzt Labels); auf Kreuzverhör-Befunde reagieren (SKILL Schritt 5).

## Fallstricke
- Pre-Commit-Hook läuft knip/tsc — falls knip wegen der neuen Exporte meckert: Config-Hints = bekannt, echte Unused-Exports erst prüfen (MEMORY 2026-09-02: knip NUR über Root-`pnpm knip`).
- Keine Labels setzen (Workflow macht das); kein Ping-Kommentar.
- PR-Body: Test-Ergebnisse (Unit 4/4, e2e 5/5, Gate-Befunde) + Affected files + Zusammenfassung; `Closes #1190` steht schon im Draft-Body (verifizieren vor ready).
