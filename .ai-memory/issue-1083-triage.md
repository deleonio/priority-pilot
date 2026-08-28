# Issue 1083 — Triage (Phase 1), Stand 2026-08-28

## Erledigt
- Initial-Triage abgeschlossen (kein KI-ANALYSE-Block, einziger Kommentar = github-actions-Qualitätscheck, keine Entscheidungen). Analyse-Block + Routing-Tabelle in den Body geschrieben (`.ai-memory/issue-1083-body.md` = gesendeter Stand), Labels: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt. Ampel 🟢, keine offenen Fragen, kein Ping-Kommentar.
- Titel und Body unangetastet gelassen (Issue war bereits sehr gut formuliert; nur Blöcke angehängt).
- Kein Split: Server+Frontend in einem PR, da DTO/Route unverändert und ACs ein zusammenhängender Satz sind (Begründung steht im Analyse-Block).

## Relevante Stellen
- `server/src/express/routes/geocodeSearch.ts` — aktuell Nominatim-only, Fehler→leere Liste; hier Photon primär + Nominatim-Fallback rein.
- `server/src/logics/nominatim.ts:14` — `isNominatimRateLimited` (geteilter 1-req/s-Limiter); Rename → `isGeocodeRateLimited`.
- `server/src/express/routes/reverseGeocode.ts:3,66` — nutzt denselben Limiter; nur Rename-Kollaterale.
- `frontend/src/components/TaskForm.tsx:955` — KolCombobox-Block (`_suggestions`, onChange+onInput → `applyAddressCoords`); hier eigene Liste statt KolCombobox.
- `frontend/src/lib/useAddressSearch.ts` — bleibt unverändert (DTO `{address,lat,lon}` stabil).
- Tests: `server/src/express/geocode-search.test.ts`, `frontend/src/components/TaskForm.test.tsx`, `frontend/e2e/issue-1061-task-address.spec.ts`, neu `AddressAutocomplete.test.tsx`.

## Annahmen
- Routing-Tabelle (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) ist für Folgephasen verbindlich; `ai:model`-Label setzt der Workflow aus der impl-Zeile.
- Fuzzy-Fähigkeit von Photon und fehlender Filter-Hook in @public-ui 4.3.0 laut Issue (Quelltext nicht selbst geprüft — vom Ticket-Autor verifiziert behauptet).

## Verworfen
- Split in Server-/Frontend-Sub-Issues — together gehören sie zu einem PR (API-Vertrag unverändert, alle AKs end-to-end).
- Body-Copyedit und Titeländerung — Issue bereits präzise; pro-forma-Editz verboten lt. Skill.

## Offen
- -

## Nächster Schritt
- Phase 2 (UX) läuft über `ai:needs-ux-ui`; danach Spec/Impl gemäß Routing-Tabelle im Issue-Body.

## Fallstricke
- GeoJSON-Koordinaten sind `[lon, lat]` — beim Photon-Mapping Reihenfolge tauschen (AK1).
- Photon 200 mit 0 Treffern ist KEIN Fehler → kein Nominatim-Fallback (AK3), sonst Kontingent-Problem.
- Rename des Limiters darf Reverse-Geocoding nicht brechen (Import in `reverseGeocode.ts` mitändern).
- E2E: `pnpm --filter frontend test:e2e -- <pattern>` filtert nicht — direkt `npx playwright test e2e/<datei>.spec.ts` im `frontend`-Verzeichnis (MEMORY.md 2026-08-26).
