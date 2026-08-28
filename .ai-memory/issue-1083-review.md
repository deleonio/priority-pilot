# Issue 1083 — Review (Phase 5), Stand 2026-08-28

## Erledigt
- **Runde 2 (MODE=FIXUP VERIFICATION, 2026-08-28)**: Marker gefunden (issuecomment-5451804266, updatedAt 11:12:21Z) → nur Fixup-Diff geprüft, KEIN neues Kreuzverhör. Fixup-Commit `dba567b3` (11:24:30Z, > updatedAt) über `git diff 4bf77aba..dba567b3` — 5 Dateien, Source-Anteil: `AddressAutocomplete.tsx`, `AddressAutocomplete.test.tsx`, `useAddressSearch.ts` (Rest `.ai-memory/`).
- **F1 ✅**: `frontend/src/lib/useAddressSearch.ts:56` — `setError(false)` neben `setLoading(true)` im Timer-Callback, also VOR Request-Start. Korrekt platziert.
- **F2 ✅**: `AddressAutocomplete.tsx:94-104` — Container-Pattern exakt wie vorgeschlagen: `role="combobox"`, `aria-haspopup`, `aria-autocomplete`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `onBlur`, `onKeyDown` auf dem umgebenden `<div>`; ARIA-Spread + Typ-Assert am `KolInputText` komplett entfernt. Testvertrag am A11y-Tree nachgezogen: `combobox !== textbox`, `combobox).toContainElement(textbox)` und `toContainElement(listbox)`, `aria-activedescendant` zeigt auf echten Nachfahren.
- **F3 ✅**: `AddressAutocomplete.tsx:52-55` — `onBlur` → `setActiveIndex(null); setDismissed(true)`; neuer Test „Tab/Blurfokus schließt die Liste ohne Auswahl" via `fireEvent.focusOut`, Assertion `queryByRole('listbox')` null + `onSelect` nicht gerufen (nicht tautologisch).
- **F4 ✅**: PR-Body, Abschnitt „Test-Pflege-Bedarf (2 Assertions abgeschwächt — F4)" — Vorher/Nachher-Tabelle + Begründung, Code unverändert wie vorgeschlagen.
- **Alle 4 Review-Threads resolved** verifiziert via GraphQL `pullRequest.reviewThreads.nodes.isResolved` (die REST-Felder `resolved`/`is_awaiting_review` sind null → GraphQL nötig).
- **N1 gefunden und gepostet** (Inline-Kommentar 3880248524, `useAddressSearch.ts:56`): die F1-Fixzeile ist OHNE Regressionstest — `AddressAutocomplete.test.tsx:213-223` (Fehler) endet, `:225-241` (0 Treffer) mountet frisch; kein Test erzeugt in EINEM Mount erst Fehler, dann Erfolg. Zeile 56 entfernen → kein Test rot.
- Sammelkommentar 5451804266 aktualisiert (F1–F4 → „Behobene Anmerkungen"-Tabelle, N1 → „Offene Findings", Review-Typ: Fixup-Nachweis). Verdict **needs-fixup**.
- Titel-Gate erneut geprüft: `feat(frontend): fuzzy address search via photon, nominatim fallback` = 67 Zeichen, CC-konform (Runde-1-Rename noch vorhanden) → kein Edit nötig.
- CI beim Reviewzeitpunkt: e2e (1–4) + `verify` **pending** (Run 33167201041), `gate-merge` skipping → kein 🔴-Widerspruch, aber im Kommentar als Gate-Voraussetzung benannt.

- **Runde 1 (Kreuzverhör)**: Voll-Diff 16 Dateien, 8 Commits; TDD-Reihenfolge `991f39dd3 test: red spec tests` vor `c6a616261 feat:` bestätigt. KoliBri-First via kolibri-mcp `spec/input-text` (keine ARIA-Props in 4.3.0) → F2. F1 (error nie bei neuer Suche zurückgesetzt), F3 (kein onBlur), F4 (PR-Body-Lüge zur Test-Abschwächung `geocode-search.test.ts:214,239`). CI-E2E Run 33164987843 shard 2 grün → AK7. 4 Inline-Kommentare (review 5050526414, event=COMMENT) + Sammelkommentar. Titel-Gate: CC-Titel gesetzt.

## Relevante Stellen
- `frontend/src/lib/useAddressSearch.ts:56` — F1-Fixzeile UND N1-Anker (`setError(false)`); zweites Vorkommen Zeile 44 ist die `< MIN_QUERY_LENGTH`-Abzweigung.
- `frontend/src/components/AddressAutocomplete.tsx:94-104` — Combobox-Container (F2-Ergebnis); `:52-55` blur-Handler (F3); `:33` `open = suggestions.length > 0 && !dismissed`.
- `frontend/src/components/AddressAutocomplete.test.tsx:213-241` — Fehler- und Leer-Test; die Lücke DAZWISCHEN ist N1.
- `frontend/e2e/issue-1061-task-address.spec.ts:71-107` — echtes Chromium: `getByRole('option')` + 375-px-Bounding-Box; deckt Listbox/Options im Shadow-DOM-Kontext, NICHT die Container-ARIA-Attribute (die sind Light-DOM, daher garantiert exposiert).
- `server/src/express/geocode-search.test.ts` — vom Fixup NICHT angefasst (F4 war reine Berichtspflicht).

## Annahmen
- F2 gilt als ausreichend verifiziert: die Container-Attribute liegen auf Light-DOM (Garantie für Exposition), die Shadow-DOM-Abhängigkeiten (composed keydown-Bubbling, Input als a11y-Nachfahre des Hosts) sind Standard-Semantik; echte Browser-Verifikation läuft über den CI-E2E. Der Playwright-A11y-Snapshot wurde bewusst nicht gefahren (Fixup-Memory, „Verworfen").
- `onClick` zusätzlich zu `onMouseDown` auf der Option feuert im echten Browser nicht doppelt: das `<li>` wird zwischen mousedown und mouseup unmountet → kein click-Event. Auch bei Doppel-Feuer wäre `onSelect` nur mit identischen Werten wirksam (TaskForm überschreibt lat/lon).
- Fixup-Memory „GATE KOMPLETT GRÜN" (442 Vitest + 9 Server) als korrekt übernommen — Tests selbst nicht erneut gefahren (FOCUS „nur Diff", CI `verify` läuft parallel).

## Verworfen
- F2 erneut aufmachen, weil der CI-E2E keine `combobox`/`aria-expanded`-Assertions hat — wäre Re-Litigieren eines resolved Threads; Container-Pattern ist wie verlangt umgesetzt und Light-DOM-Exposition ist garantiert.
- Finding „KolAlert/KolSpin/Leer-Hinweis als Nicht-Textbox-Kinder des `role=combobox`-Containers verletzen Required-Owned-Elements" — ARIA 1.2 schreibt dasTextbox+Popup-Ownership vor, verbietet aber keine weiteren Kinder; Struktur war auch vor dem Fixup so (nur die Rolle ist dorthin gewandert). Kein Pseudo-Finding.
- Finding „`onClick` neben `onMouseDown` = Doppel-Selektion" — s. Annahmen, in Wirkung idempotent und im Code kommentiert.
- Finding „Typ-Assert `event as unknown as KeyboardEvent`" — pre-existing aus Runde 1, nur mit dem Handler umgezogen, kein Diff-Neuzugang.
- Tippfehler „schwertesta bar" im PR-Body — rein kosmetisch, kein Review-Gegenstand.

## Offen
- N1 (Regressionstest für `useAddressSearch.ts:56`) steht aus → nächster Fixup.
- CI e2e (1–4) + `verify` pending; grüner Gate ist Voraussetzung für `ai:ready-to-merge` (deterministischer Gate-Job degradiert bei Rot automatisch).

## Nächster Schritt
- Fixup ergänzt N1-Test (Code-Block steht im Inline-Kommentar 3880248524: `mockRejectedValueOnce` → Alert, dann `mockResolvedValue(MUNICH_HITS)` + NEUER Suchtext → Listbox ohne Alert; neuer Text nötig, damit der Debounce erneut feuert). Danach Runde 3 als Fixup-Nachweis mit N1 unter „Behobene Anmerkungen".

## Fallstricke
- `POST /pulls/<n>/comments` mit `commit_id` als KURZEM SHA → 422 „commit_id is not part of the pull request" (irreführend). Immer `gh pr view --json headRefOid` und den vollen 40-Zeichen-SHA setzen.
- Review-Thread-Resolution steht im REST nicht (`is_awaiting_review`/`resolved` = null) → GraphQL `pullRequest(number:).reviewThreads { nodes { isResolved } }`.
- Fixup-Diff-Quelle: `git diff <vorheriger-Head>..<head>` lokal ist zuverlässiger als `gh pr diff`, weil die `.ai-memory/`-Commits den Vergleichspunkt verschieben; vorheriger review relevanter Code-Head war `4bf77aba` (nicht der memory-Commit).
- Weiche Shell-CWD: mehrere `cd`-Aufrufe lassen `frontend/`-relative Pfade ins Leere laufen → absolute Pfade oder `cd /home/runner/work/priority-pilot/priority-pilot` vorweg.
- `node_modules` ist in der Review-Sandbox nicht installiert → KoliBri-Introspektion nur über kolibri-mcp.
- Die `.ai-memory/issue-1083-*.md`-Dateien sind Teil des PR (ADR 0007) — ihr Auftauchen im Diff ist kein Finding.
