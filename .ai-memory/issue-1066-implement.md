# Issue 1066 — Implement-Phase (2026-08-27, Run 2: Frontend committed, GATE offen)

## Erledigt
- Run 1 (Server komplett grün): s. Commit 0d950f87 — Modelle/Migration/Snapshot/Routes/openapi; Details im Git-Stand.
- Run 2 (Frontend KOMPLETT, Commit d7b9a29e `feat(frontend): Nearby-Card, Koordinaten in Adresssuche und GeoBadge-Reverse-Geocoding für #1066`, gepusht):
  - `pnpm --filter client generate` — client/src/schema.d.ts hatte nearby/latitude NICHT (Run 1 lief nur build:api für server!). Jetzt `/tasks/nearby` + `latitude` drin.
  - `client/src/index.ts` — `export type NearbyTask = Schemas['NearbyTask'];`.
  - `frontend/src/api.ts` — `listNearbyTasks({lat, lon, signal})` via `client.GET('/tasks/nearby', {params:{query:{lat, lon}}})` (Query typisiert als number, KEIN `__unsafe`-Cast nötig).
  - `frontend/src/lib/useAddressSearch.ts` — Vorschläge jetzt `AddressSuggestion[]` ({address, lat, lon}), Export `export interface AddressSuggestion`.
  - `frontend/src/components/TaskForm.tsx` — form-Ref um latitude/longitude (init aus task/series), `findAddressSuggestion`/`applyAddressCoords` (Text==Vorschlag → dessen lat/lon, sonst null — AK1/AK10), alle 4 DTOs (TaskCreate/Update, SeriesCreate/Update) senden latitude/longitude, `hasSeriesCascadeChange` prüft lat/lon (Kaskade-Modal vor Instanz-Übernahme, AK6), `_suggestions` mapt auf Strings (KolCombobox nimmt nur `W3CInputValue[]` = string|number!).
  - `frontend/src/components/NearbyCard.tsx` NEU — KolCard `data-testid="nearby-card"`, eigene useGeolocation-Instanz, Zustände: denied/!supported → `nearby-denied`; !enabled → `nearby-preference-off` (Text enthält „Einstellungen“); null → Lade-Hinweis; leer → `nearby-empty`; Liste `nearby-item` mit `#id – Titel` + `formatKm` (de-DE, 1 Nachkommastelle) + „ km“.
  - `frontend/src/components/Dashboard.tsx` — `<NearbyCard />` zwischen „Was ist jetzt dran?“ und „Wichtigste Tasks“.
  - `frontend/src/components/GeoBadge.tsx` — Props `{latitude, longitude, address?}`; Reverse-Geocoding mit modul-level Session-Cache (Map „lat,lon“→Adresse), Fallback „Adresse nicht verfügbar“ (AK11), Legacy-`address` nur ohne Koordinaten.
  - Caller angepasst: CompletedTasksTable.tsx, SeriesTab.tsx, TaskTree.tsx (TaskTree nutzt GeoBadge JETZT doch — merge 2a0eb97b — Triage-Notiz war veraltet).
  - `frontend/src/app.css` — .dashboard-nearby*-Block (44px min-height Items, flex-wrap, distance nowrap).
  - Test-Pflege (dokumentiert, nicht heimlich): `useAddressSearch.test.ts` Zeile ~108 alte Assertion `toEqual(['Neu'])` → `toEqual(results(['Neu']))` — String-Erwartung widerspricht AK1-Objektvertrag.
- Verifiziert: `npx tsc --noEmit` (frontend) SAUBER; `npx vitest run` frontend: 422 passed / 13 skipped, 0 fail; `pnpm format` + `prettier --check .` GRÜN; Pre-Commit-Hook (format/lint/knip) lief durch.
- knip-Falle behoben: `AddressSuggestion` war ungenutzt exportiert → knip Failed → Commit blockiert; Fix: TaskForm importiert den Typ für `findAddressSuggestion`.

## Relevante Stellen
- `frontend/e2e/issue-1066-nearby-card.spec.ts` — NICHT gelaufen in Run 2 (Zeit): erwartet nearby-card/-item/-empty/-denied/-preference-off, `,\d km`-Regex, AK11 geo-badge ohne Rohkoordinaten bei reverse-geocode 500.
- `docs/spec/issue-1066.md` — Vertrag; Hinweistexte sind frei (Anker = testids).
- PR #1071 — noch DRAFT (Gate/e2e fehlen).

## Annahmen
- KolCombobox-Auswahl feuert onChange mit dem Vorschlags-String; Koordinaten-Übernahme per Text-Match (deterministisch unabhängig von onInput/onChange-Reihenfolge).
- Nach Browser-Denial zeigt die Card `nearby-denied` (permissionDenied-Flag), nach Reload `nearby-preference-off` (Präferenz wurde auf false gespeichert) — e2e deckt nur den Erstfall.

## Verworfen
- Objekte direkt in `_suggestions` der KolCombobox — Typ ist `W3CInputValue[]` (string|number), daher Map auf Strings + separates Koordinaten-Lookup.

## Offen
- GATE vollständig: `pnpm lint && pnpm knip && pnpm test` (repo-weit) NICHT in Run 2 gelaufen (nur Pre-Commit-Hook-Teile + frontend-vitest). `pnpm test` lokal an session.test.ts/Redis pre-existing rot (Memory 2026-08-27) — per git stash gegenprüfen, im PR-Body dokumentieren.
- e2e `frontend/e2e/issue-1066-nearby-card.spec.ts` laufen lassen (`cd frontend && npx playwright test e2e/issue-1066-nearby-card.spec.ts`; Chromium-Install pro Sandbox, Memory 08-20) — vermutlich Nacharbeit an Hint-Texten/Render-Timing.
- 375/1280-Layout-Check (SKILL 3b/3c) — AK5-e2e deckt 375px bounding-box ab, 1280px-Screenshot ausständig.
- Danach: PR-Body von #1071 erweitern (Zusammenfassung, Format/Lint/Test-Ergebnisse, Test-Pflege-Bedarf: useAddressSearch.test.ts:108, e2e-Befund, offene Frage „Kein Prompt vor Card-Render“) und `gh pr ready 1071`.

## Nächster Schritt
- Run 3: e2e laufen lassen → Fixes → GATE komplett → PR-Body → `gh pr ready 1071` → VERDICT needs-review.

## Fallstricke
- `pnpm --filter client generate` NACH openapi-Änderung nicht vergessen — sonst fehlen frontend die Typen (Run-2-Fund).
- Server-Testdateien NICHT mehrere in einem tsx-Aufruf (Run-1-Notiz, Cross-File-Sequelize).
- Commit-Hook: knip Failed bei ungenutzten Exports blockiert STILL (Ausgabe endet nach „🥊 knip“ ohne Fehlerzeile) → `git log -1` gegenprüfen, ob der Commit wirklich existiert.
- Die nearby-Route MUSS vor `/tasks/:id` registriert bleiben (server, Run-1-Notiz).
