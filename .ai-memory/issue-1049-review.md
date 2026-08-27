# Issue #1049 / PR #1048 — Review-Phase (Fixup-Nachweis, Runde 2)

## Erledigt
- MODUS bestimmt: `<!-- ai-review -->`-Kommentar existierte (ID 5427008006, updatedAt 2026-08-26T14:43:18Z) → Fixup-Nachweis, kein neues Kreuzverhör.
- Fixup-Commit a02aef59 (14:52:41Z > updatedAt) verifiziert: F1–F8 alle behoben.
  - F1 SeriesTab-Import: App.tsx:28 wieder da, Nutzung :619, e2e-Shard 3 SUCCESS.
  - F2 Prettier: `npx prettier --check` über 4 geänderte Dateien grün, verify SUCCESS.
  - F3 VoiceField-Reuse: SearchModal.tsx wrappt KolInputText, Eigen-CSS gelöscht.
  - F4/F5/F6: setSearchDraft(query) + applyTaskFilter(query) (App.tsx:644 f.), kein View-Mode-Zwang.
  - F7: e2e/search-modal.spec.ts (3 Tests inkl. 375px).
  - F8: closingIssuesReferences → #1049.
- CI verifiziert: verify SUCCESS, e2e (1)–(4) SUCCESS, review IN_PROGRESS (eigener Lauf).
- Issue #1049 = Alt-Issue OHNE KI-ANALYSE-Block und ohne KI-Analyse-Kommentar; AKs aus Body-Text geprüft: alle umgesetzt.
- Neue Findings aus Fixup-Diff als Review #5036411673 (event COMMENT) gepostet: **F9** search-modal.spec.ts:65 (toBeFocused().catch(() => undefined) — zahmlose Assertion, Norm: quick-capture.spec.ts:151), **F10** SearchModal.tsx:49 (Transcript-Merge Leading-Space; Norm: TaskForm.tsx:727 `prev ? \`${prev} ${text}\` : text`).
- Sammelkommentar 5427008006 per PATCH fortgeschrieben (F1–F8 → Behobene-Tabelle mit Behoben-via/Datum, F9/F10 offen, Review-Typ: Fixup-Nachweis).
- TITLE-GATE true: „feat(frontend): add search button with voice input to header toolbar" — CC-konform, kein Rename.
- Verdict: needs-fixup (zwei fixbare 🟡-Findings).

## Relevante Stellen
- frontend/src/components/SearchModal.tsx — neue Komponente; Autofokus-Muster = Kopie QuickCaptureModal.tsx:69 (200 ms + shadowRoot), F10 liegt in Zeile 49.
- frontend/e2e/search-modal.spec.ts — neue Specs; F9 liegt in Zeile 65.
- frontend/src/App.tsx:638–646 — onSearch-Handler (F4/F5/F6-Fix), toolbarItems :389 ff. (Suche erste Position, _hideLabel).
- frontend/src/components/VoiceField.tsx — etablierter Voice-Wrapper (Referenz für F3/F10).
- Issue #1049 Body — Soll-Verhalten ohne KI-ANALYSE-Block (Alt-Issue-Fallback via Body-Text).

## Annahmen
- e2e-Shards SUCCESS auf PR-Head a02aef59 gelten dem Fixup-Stand (Commits nach updatedAt nur a02aef59).
- „review"-Check IN_PROGRESS ist der eigene CI-Review-Lauf; „fixup" FAILURE ist ein früherer Agenten-Lauf, kein Code-Signal (Commits/Diff intakt verifiziert).
- F6-Entscheidung (View-Mode nicht umschalten) wurde Runde 1 vom Reviewer so empfohlen — Issue-Text „gesucht wird in den offenen Aufgaben" bewusst als weicher interpretiert; nicht erneut aufgerollt.

## Verworfen
- Impeccable-Detektor (`node .claude/skills/impeccable/scripts/detect.mjs`): Skill existiert in dieser Umgebung nicht → fünf Dimensionen manuell geprüft (a11y/theming/responsive/perf/integrity unauffällig).
- Eigenes Nachprüfen von KoliBri-First für `.search-modal`-Layout-CSS: reines flex/gap-Layout, konsistent mit bestehenden Modal-Patterns (z. B. .task-filter-search) — kein Finding.
- E2e-Lokallauf: CI-Shards grün, Chromium-Setup zu teuer für Added-Value.

## Offen
- F9, F10 beim Autor (fixbar, je 1-Zeiler); nächster Review-Lauf = erneuter Fixup-Nachweis gegen diese beiden.

## Nächster Schritt
- (erledigt) Verdict `needs-fixup` nach /tmp/claude-verdict schreiben + Ausgabe-Zeile setzen.

## Fallstricke
- Sammelkommentar-Fortschreibung per PATCH braucht die Comment-ID (5427008006), nicht die PR-Nummer; Finding-Nummern weiterführen (nächst: F11), F1–F8 nicht umnummerieren.
- gh-API Installation-Rate-Limit wirft 403, obwohl `gh api rate_limit` volles core-Kontingent zeigt — nicht blind neu versuchen, Reset abwarten/lokal arbeiten.
- `cd frontend` im Bash-Tool persistiert — absolute Pfade oder zurückwechseln.
