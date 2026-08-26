# PR 1048 — Fixup — 2026-08-26

## Erledigt
- F1–F7 gefixt, committet (a02aef59) und gepusht auf vibe/search-button-8090f3.
- Alle 5 Review-Threads (F1, F2, F3, F4/F5/F6, F7) per GraphQL beantwortet ("Gefixt in a02aef59") und resolved.
- ai-fixup-decisions-Kommentar mit F8 als Entscheidungs-Finding gepostet; VERDICT needs-human.

## Relevante Stellen
- `frontend/src/App.tsx:29` — SeriesTab-Import zurück (F1); `App.tsx:638-647` — onSearch: setSearchDraft + applyTaskFilter, kein setTaskViewMode/setTaskSearch mehr (F4/F5/F6).
- `frontend/src/components/SearchModal.tsx` — komplett auf VoiceField (variant input) umgebaut, onKeyDown als DOM-KeyboardEvent typisiert (React.KeyboardEvent warf tsc TS2322 im Pre-Commit).
- `frontend/src/app.css:1935-1947` — nur noch .search-modal + .search-modal__actions; mic-Duplikate/@keyframes pulse/zweite .mic-error entfernt (F2/F3).
- `frontend/e2e/search-modal.spec.ts` — neu: 3 Tests (Suchfluss + Filterfeld-Anzeige, Enter, 375px-Viewport ohne Overflow).

## Annahmen
- Knip "Configuration hints" sind pre-existing Rot auf main (Memory 2026-08-24) — nicht behandelt.
- `pnpm test` (Unit) nicht gefahren: Soft-Deadline lief ab; server/session.test.ts ist ohne Redis eh rot (Memory 2026-08-25). tsc/eslint/prettier/knip liefen grün via Pre-Commit-Hook.

## Verworfen
- F8 fixen (Issue verlinken/AK nachliefern): referenzierte UUID ist kein GitHub-Issue, AK-Quelle existiert nicht → Entscheidung dem Menschen überlassen.

## Offen
- F8 (Ticket-Verknüpfung) — wartet auf Options-Antwort im ai-fixup-decisions-Kommentar.
- CI des neuen Commits (verify/e2e-Shards) zum Zeitpunkt Turnende noch nicht abgeschlossen; e2e-Spec search-modal.spec.ts lief lokal nicht (keine Zeit/Chromium nicht verifiziert).

## Nächster Schritt
- CI-Runs zu a02aef59 prüfen; bei roten e2e: Logs lesen, ggf. search-modal.spec.ts nachjustieren (Locator-Muster aus tasks-tab-filter.spec.ts).

## Fallstricke
- handleKeyDown musste DOM-KeyboardEvent sein — Review-Notiz "React.KeyboardEvent ok" war falsch für KolInputText-_on.
- Soft-Deadline traf mitten in der Phase; Gate = Pre-Commit-Hook (format/knip/lint) statt vollem pnpm test.
