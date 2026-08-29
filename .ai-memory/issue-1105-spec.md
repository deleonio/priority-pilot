# Issue 1105 — Spec (rote Tests), Stand 2026-08-29

## Erledigt
- Branch `ai/harness/1105` fortgeführt (nur Triage-Commit war drauf). Spec `docs/spec/issue-1105.md` neu angelegt (AK1–AK8, Routen-Tabelle).
- Rote Tests: `frontend/e2e/issue-1105-routes.spec.ts` — 8 Tests. Rot verifiziert (Playwright-Lauf): AK1 `/aufgaben|/serien|/wald` (aria-selected bleibt Dashboard, App.tsx hat keine Routenableitung), AK2 (Tab-Klick ändert URL nicht), AK4 (popstate-Wechsel leitet Tab nicht ab), AK5 (`?view=done` ignoriert, kein `?q=` in URL). Grün (Kontrakt-Guards, Verhalten existiert bereits): AK6 (Dialoge ändern URL nicht), AK8 (375px Overflow-frei).
- Dedup entfernt: Deep-Links `/settings/pillars` (settings-page.spec AK3, aria-selected) und `/settings/llm` (llm-settings.spec, Panel-Inhalt via `openLlmTab`, e2e/llm-settings.spec.ts:26-29) sind bereits abgedeckt → bewusst keine Doppeltests, Begründungskommentar steht in der Spec-Datei (Zeile 47-49).
- Testläufe: `npx playwright test e2e/issue-1105-routes.spec.ts` → 6 rot / 2 grün; tsc + eslint + prettier sauber.

## Relevante Stellen
- `frontend/src/App.tsx:81` (`activeTab`), `:54` (`VIEW_TABS`), `:132-139` (popstate-Listener nur showHelp/showSettings), `:296-312` (`openHelp/closeHelp/openSettings/closeSettings` pushState) — Implementierziel: React Router ersetzt diese Fragmente (AK4).
- `frontend/src/App.tsx:87-89` (`taskViewMode`/`taskSearch`/`searchDraft`) — AK5: aus `?view=`/`?q=` initialisieren und bei Änderung in die URL schreiben.
- `frontend/src/components/SettingsPage.tsx:55-62` (Tab-Init aus `window.location.pathname`) — `/settings/:tab` Ableitung.
- `frontend/e2e/tasks-tab-filter.spec.ts` — Selektor-Muster (viewSwitch/searchbox/Filtern, createTask/„Weitere Aktionen"→„Erledigt"), in AK5 wiederverwendet.
- `frontend/e2e/fixtures.ts` (`/auth/me`-Mock) + `helpers.ts` (`waitForStableView`, `headerAction` — gibt Promise<Locator> zurück!).

## Annahmen
- React Router v6 wird von der Impl-Phase als Dependency installiert (Spec-PR darf keine package.json-Änderung — deshalb nur URL-Verhaltenstests, keine Router-Imports im Test).
- Vite-Dev-Server (Playwright webServer, Port 4173) liefert SPA-Fallback, daher funktioniert `page.goto('/serien')` schon jetzt (lädt App, zeigt nur falsche Ansicht) — die roten Tests prüfen die Tab-Ableitung, nicht den 404.
- AK7 (bestehende Tests grün) ist kein eigener Test — Regression läuft über CI.
- AK3-Deep-Links `/hilfe`, `/settings/general` durch help.spec.ts/settings-page.spec.ts abgedeckt (Dedup).

## Verworfen
- Unit-Tests auf `src/`-Ebene (TF4) — KoliBri-Komponenten in jsdom nur Shadow-DOM-aria-selected riskant; Verhalten deckt E2E vollständig ab (Dedup-Regel des Skills).
- Test „react-router-dom ist installiert" — Konfigurations-Change-Detektor ohne Zähne (ADR 0001); Installation merkt man an den Verhaltenstests.
- Escape-basiertes Dialog-Schließen in AK6 (erster Versuch) — QuickCapture/Dialog-Fokus verhinderte Folge-Klicks; pro Dialog frisch geladen (robust, bleibt auch nach Router-Umbau gültig).

## Offen
- AK6 und AK8 sind als Kontrakt-Guards grün (Verhalten existiert bereits, wird durch den Router-Umbau gesichert) — im PR-Body vermerkt.

## Nächster Schritt
- Impl-Phase: react-router-dom v6 installieren, Routen-Tabelle aus docs/spec/issue-1105.md umsetzen, pushState/popstate-Fragmente (App.tsx:132-139, 296-312; SettingsPage.tsx:55-62) entfernen, Query-Parameter für /aufgaben.

## Fallstricke
- `headerAction()` ist async (gibt Promise<Locator>) — `(await headerAction(...)).click()`.
- Playwright-Browser fehlen in frischer Sandbox → einmalig `pnpm exec playwright install chromium --with-deps` (MEMORY bestätigt).
- AK5-`?view=done`: erledigte Aufgaben sind nach Markieren 5s „sticky" im offenen Baum (#315) → `page.reload()` vor der Deep-Link-Assertion, sonst flackert der Test.
- Bounding-Box statt scrollWidth bei 375px-Assertions (App-Shell clippt overflow-x:hidden) — nur `main.app` + Tab-Leiste messen.
- „Überspringen"-Button im Create-Dialog (#1080 quickCapture) — createTask-Helfer muss ihn klicken, sonst fehlt das Titel-Feld.
