# Issue 1067 — Triage-Notizen (Fokus in Suchfeld nach SearchModal-Suche)

## Erledigt
- Issue-Body + 1 Kommentar (nur ai-quality-Bot, keine Entscheidungen) gelesen — Initial-Triage.
- Code-Recherche: SearchModal.tsx, App.tsx, Modal.tsx, focus.ts, eslint.config.mjs, e2e/search-modal.spec.ts.

## Relevante Stellen
- `frontend/src/components/SearchModal.tsx:31-36` — `handleSearch`: ruft `onSearch(query)` dann `onClose()`.
- `frontend/src/App.tsx:635-648` — `onSearch`-Handler: `setActiveTab(1)`, `setSearchDraft(query)`, `applyTaskFilter(query)`; KEIN Fokus-Setzen.
- `frontend/src/App.tsx:541-560` — Ziel-Feld: `KolInputText` mit `className="task-filter-search__field"`, Label „Nach Titel filtern", `_hideLabel`.
- `frontend/src/components/Modal.tsx:121-146` — Unmount-Cleanup: `setTimeout(0)` → `trigger.focus()` (Auslöser = Toolbar-Such-Button) — das ist die Fokus-Rückgabe, die den IST-Zustand erzeugt; neuer Fokus muss NACH ihr laufen (Race).
- `frontend/src/components/Modal.tsx:99-118` — Kommentar: KoliBri-`focus()` am Host wiederholt bis 10 Frames → robusteres Fokus-Setzen als Einmal-`focus()`.
- `frontend/src/components/SearchModal.tsx:24-29` — Vorhandenes Muster: Autofokus via `inputRef.current?.shadowRoot?.querySelector('input')?.focus()` mit 200ms-Timeout; Ref-Typ `HTMLKolInputTextElement`.
- `frontend/src/App.tsx:527` — Tab-1-Inhalt ist UNkonditional gerendert (kein `activeTab === 1 &&`-Guard, anders als Tab-2) → Feld existiert immer im DOM.
- `frontend/e2e/search-modal.spec.ts` — bestehende Spec (Tests: gefilterte Liste, Enter-Suche, 375px) → neue Tests hier ergänzen.
- `frontend/eslint.config.mjs:41-57` — shadowRoot-Guard (#824) gilt NUR für Test-Dateien; Prod-Code darf piercen.

## Annahmen
- Der Fokus landet aktuell auf dem Toolbar-Trigger (Modal-Rückgabe), nicht im body — durch Modal.tsx-Cleanup belegt.
- KoliBri-Host-`focus()` (retry) und/oder Delay > Modal-`setTimeout(0)` gewinnt das Race; konkretes Timing klärt die Impl-Phase per e2e.
- UX-Phase nicht nötig: reines Fokus-/A11y-Verhalten, vom Issue exakt spezifiziert, keine Gestaltungsfragen.

## Verworfen
- `fallbackFocusRef` am Modal als Lösungshebel — greift nur, wenn der Trigger weg ist; Trigger (Toolbar-Button) existiert hier aber, also gewinnt `trigger.focus()`.
- Title-Änderung — „Fokus in Suchfeld" ist vage, aber nicht substantiv falsch; Body unverändert (copyedit-Neutral).
- Schritt 3 (Split) — kleiner Single-PR-Umfang.

## Offen
- -

## Nächster Schritt
- Issue-Body mit KI-ANALYSE-Block (🟢) + Routing-Tabelle schreiben (Datei `.ai-memory/issue-1067-body.md`, `gh issue edit 1067 --body-file`), Labels `ai:analysed` + `ai:needs-spec` setzen. Kein Ping-Kommentar (ergebnis-eindeutig).

## Fallstricke
- Modal-Cleanup-Race: eigener Fokus-Aufruf VOR dem `setTimeout(0)` des Modals wird überschrieben — Reihenfolge sichern (Delay bzw. KoliBri-retry).
- e2e: Fokus NICHT via `document.activeElement`/shadowRoot-Kette prüfen (Guard + pierct nicht) → `expect(locator).toBeFocused()` (pierct nativ); vgl. delete-dialog-focus.spec.ts.
- „Schließen ohne Suche" (Escape/Abbrechen/Backdrop) darf das Verhalten NICHT ändern — Negativ-AK mitgedacht.
- Akzeptanzkriterien inkl. 375px-AK (mobile-first Pflicht für UI-Features).
