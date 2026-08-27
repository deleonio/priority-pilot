# Issue 1067 — Review-Notizen (PR #1069, Kreuzverhör)

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar vorhanden → Kreuzverhör (Initial-Review).
- `closingIssuesReferences`-Länge = 1 (#1067) → AK-Verifikation gegen KI-ANALYSE-Block möglich.
- Full-Diff gelesen (docs/spec/issue-1067.md, frontend/e2e/search-modal.spec.ts, frontend/src/App.tsx) + Modal.tsx:121-146 / SearchModal.tsx:14-45 im Kontext.
- Cross-Examination durchgeführt: Timing-Race, Retry-Loop-Leak, KoliBri-first, AK-Coverage, ESLint-Guard (#824), CI grün (e2e 4 Shards + verify pass, Run 33108094961).
- TITLE GATE: Titel „Fokus in Suchfeld (#1067)" war nicht Conventional-Commit-konform → via `gh pr edit 1069 --title` auf `feat(search): Fokus nach Suche im Filterfeld des Aufgaben-Tabs (#1067)` umbenannt (70 Zeichen).
- Sammelkommentar (<!-- ai-review -->) als PR-Kommentar gepostet, Verdict `reviewed`.

## Relevante Stellen
- `frontend/src/App.tsx:259-283` — `taskFilterInputRef` + `focusTaskFilter()`: `setTimeout(0)` → `requestAnimationFrame`-Retry bis 20 Frames, Erfolgskriterium `document.activeElement === host.shadowRoot?.querySelector('input')`.
- `frontend/src/App.tsx:568` — `ref={taskFilterInputRef}` am Filter-`KolInputText.task-filter-search__field`.
- `frontend/src/App.tsx:672` — `focusTaskFilter()` im `SearchModal.onSearch` (nach `setActiveTab(1)`/`applyTaskFilter`).
- `frontend/src/components/Modal.tsx:136-146` — Unmount-Fokus-Rückgabe per `setTimeout(0)` an den Trigger; Quelle des Races.
- `frontend/src/components/SearchModal.tsx:33-40` — `handleSearch`: `onSearch(query)` dann `onClose()` — dadurch wird der App-`setTimeout(0)` VOR dem Modal-Cleanup-`setTimeout(0)` in dieselbe Task gereiht (Timer-Reihenfolge = Insertion-Order).
- `frontend/eslint.config.mjs:41-57` — Shadow-DOM-Guard gilt nur für `e2e/**` + `*.test.*`; Piercing in App.tsx erlaubt.
- `frontend/e2e/search-modal.spec.ts:118-213` — AK1 (Button), AK1/AK2 (Enter + Weitertippen), AK3 (375px), AK4 (Escape/Abbrechen, Regression, grün).

## Annahmen
- React 18 flushed die diskreten Events (Click/Keydown) synchron → Modal-Unmount-Cleanup reiht sein `setTimeout(0)` garantiert nach dem App-Timeout ein; rAF läuft erst nach beiden. Deterministisch für die beiden existierenden Aufrufpfade.
- Der Latenz-Fall „onSearch außerhalb eines diskreten Events" existiert aktuell nicht (nur Enter/Button) und wurde bewusst NICHT als Finding geführt (im Sammelkommentar als Beobachtung notiert).

## Verworfen
- Finding „Modal-Fokus-Rückgabe könnte nach Erfolg den Fokus zurückholen" — nur relevant bei deferred React Commit (nicht diskreter Aufrufpfad); existiert nicht, im Code kommentiert.
- Finding „Retry-Loop ohne Abbruch-Cleanup" — Loop terminiert selbst (ref null bei Unmount bzw. 20 Frames), kein Leak.
- Finding „Magic Number 20 Frames" — im Code kommentiert, Stil-Nit.

## Offen
- -

## Nächster Schritt
- PR #1069 ist reviewed (🟢); weiter im Workflow (Gate/Auto-Merge). Falls Fixup-Runde: nur Delta prüfen, Finding-Nr. stabil lassen (es gibt keine offenen).

## Fallstricke
- Sammelkommentar-Headings müssen exakt deutsch verbatim sein (🎯 Review-Status, ✅ Behobene Anmerkungen, ⏸️ Entscheidungs-Findings, 📋 Offene Findings) — Übersetzung bricht Workflow 05.
- Footer braucht `Review-Typ: Kreuzverhör` + `Updated: ISO-Datum`; Status-Zeile in Zeile 2 direkt nach dem Marker.
- Labels NICHT setzen (Workflow macht das); Verdict-Datei /tmp/claude-verdict erst als ALLERLETZTE Aktion schreiben.
