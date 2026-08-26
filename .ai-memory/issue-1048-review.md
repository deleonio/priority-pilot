# PR 1048 — Review (Kreuzverhör, Runde 1) — 2026-08-26

## Erledigt
- Modus bestimmt: KREUZVERHÖR (kein `<!-- ai-review -->`-Kommentar vorhanden).
- Vollen Diff gelesen (3 Dateien: App.tsx, app.css, SearchModal.tsx neu; +188/−2).
- Ticket-Suche: `Closes #8009e9bf-…` ist UUID, KEIN GitHub-Issue (gh search/issues leer, closingIssuesReferences leer) → keine AK prüfbar.
- CI-Status: verify FAIL (Format-Check: app.css unformatiert), e2e 1/3/4 FAIL (alle series-tab/series-alert-Styling-Specs rot, shard 3 belegt).
- Alle 8 Findings erhoben und verifiziert (s. unten), Review + Sammelkommentar + Verdict needs-fixup gepostet.

## Relevante Stellen
- `frontend/src/App.tsx:618` — nutzt `SeriesTab`, Import wurde im PR gelöscht → Build/Runtime-Bruch (F1, CI-belegt).
- `frontend/src/App.tsx:86,547,565` — `searchDraft`/Filterfeld/„Filtern“: SearchModal-`onSearch` (639–641) setzt nur `taskSearch`, nicht `searchDraft` (F4), doppelt mit `applyTaskFilter` (F5, App.tsx:89), erzwingt viewMode 'open' (F6; beide Listen filtern bereits via taskSearch, App.tsx:218 ff.).
- `frontend/src/components/VoiceField.tsx` — existierende Kapselung für Input+Mic-Button+Fehleranzeige (variant `input`); SearchModal dupliziert sie (F3), verliert tabIndex={-1} aus #522 AC2c.
- `frontend/src/app.css:1306` — `.mic-error` existiert schon; PR legt Duplikat bei :1987 an (F3).
- `frontend/src/components/QuickCaptureModal.tsx:69` — etabliertes Autofokus-Pattern (setTimeout 200 + shadowRoot-Query): SearchModal identisch → KEIN Finding.

## Annahmen
- tsc-Bruch F1 ohne lokale Repro belegt (keine node_modules in Sandbox) — grep: 1 Usage, 0 Import; CI-e2e der Serien-Specs rot als Bestätigung.
- `React.KeyboardEvent`-Typisierung des onKeyDown ist ok (gleiches Pattern BahnPage.tsx:156).

## Verworfen
- Impeccable-Detektor: `.claude/skills/impeccable/scripts/detect.mjs` existiert NICHT (Skill-Drift) → manuell geprüft, kein Extra-Finding am PR.
- Eigenes KeyboardEvent-Finding — Pattern deckungsgleich mit BahnPage.

## Offen
- Erwartet: Fixup-Runde (F1–F8), dann MODUS FIXUP-NACHWEIS über `updatedAt` des Sammelkommentars.

## Nächster Schritt
- Bei Re-Run: Fixup-Diff seit Sammelkommentar-`updatedAt` prüfen; F1 (Import zurück), F2 (prettier), F3–F7 je Datei:Zeile verifizieren; CI grün?

## Fallstricke
- Titel wurde per Gate umbenannt in `feat(frontend): add search button with voice input to header toolbar` (alt: „feat: Add …“, Subject groß, kein Scope).
- Kein echtes Ticket → AK-Abdeckung (F8) bleibt mangels Quelle offen bis Issue verlinkt.
- Review-/Kommentar-Bodies mit Sonderzeichen nur via `--body-file`/`--input` aus .ai-memory-Dateien posten (Memory-Learning 2026-08-26).
