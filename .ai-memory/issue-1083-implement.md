## Erledigt
- Server GRÜN: `server/src/express/routes/geocodeSearch.ts` — `searchPhoton()` (AK1, GeoJSON `[lon,lat]`→`lat=coordinates[1]`, `lon=coordinates[0]`, `limit=5`, `accept-language=de`, Address aus properties name/street+housenumber/postcode+city) primär, `searchNominatim()` als Fallback (AK2); `null`-Konvention = Photon unbrauchbar → Fallback, 200 mit `features: []` = legitimes `[]` (AK3, kein Fallback). 9/9 Tests grün (`npx tsx --test src/express/geocode-search.test.ts`), `tsc --noEmit` clean.
- `server/src/logics/nominatim.ts:14` + `reverseGeocode.ts:3,66` + `geocodeSearch.ts:55` → `isGeocodeRateLimited` (kein `isNominatimRateLimited` mehr in src/).
- NOCH OFFEN (nicht committed): Frontend.

## Relevante Stellen
- `server/src/express/routes/geocodeSearch.ts:60-148` — neue Aufteilung Route→searchPhoton/searchNominatim.
- `frontend/src/lib/useAddressSearch.ts:59-63` — `.catch` macht Fehler still leer; braucht `error: boolean` im Return (AK5 Zustände).
- `frontend/src/components/TaskForm.tsx:290-299, 955-980` — `useAddressSearch` + `applyAddressCoords` + KolCombobox-Block; TaskForm.test.tsx:1424-1435 klickt `within(listbox).getByRole('option',{name:/München Hauptbahnhof/})` und erwartet `taskCreate.latitude === 48.1402` → Auswahl muss `form.current.latitude/longitude` setzen.
- `frontend/src/components/AddressAutocomplete.test.tsx:21-49` — Mock-Kontrakt: `KolInputText` spreated `...rest` aufs native `<input>` → `role`/`aria-*`/`onKeyDown` werden durchgereicht; Option-`textContent` muss EXAKT die Adresse sein (Test 1 vergleicht Array-Gleichheit) → keine Text-Icons, Marker nur via CSS-Pseudo-Element.

## Annahmen
- `AddressAutocomplete` ruft `useAddressSearch(value)` SELBST auf (Test mockt nur `../api`) → TaskForm darf nicht doppelt suchen (1-req/s-Limiter!) → TaskForm's eigener Hook-Zweig wird entfernt, Koordinaten kommen über `onSelect`.
- Inline-`style` statt Tailwind (TaskForm nutzt durchgehend `style={{}}`, kein tailwind.config gefunden).

## Verworfen
- —

## Offen
- Frontend-Impl: `AddressAutocomplete.tsx` (neu), `useAddressSearch` Fehlerzustand, TaskForm-Block ersetzen — alles noch zu tun; Gate (format/prettier/lint/knip/test) + E2E + Commit/Push + `gh pr ready 1086` fehlen.

## Nächster Schritt
- `AddressAutocomplete.tsx` bauen (Combobox-ARIA + listbox/option + 4 Zustände + Tastatur), dann TaskForm-Block ersetzen, dann Gate → `gh pr ready 1086`.

## Fallstricke
- `express.Response`-Typ: `searchNominatim` returnt statt `res.json` direkt — sonst kann der Fallback nicht in die gleiche Antwort geschrieben werden.
- Server-Test-Log spuckt einen Stack für den `fail: true`-Photon-Mock (console.warn in searchPhoton) — harmlos, Test ist grün.
- Pre-Commit-Hook (`tsc --noEmit` Frontend) läuft mit; solange `AddressAutocomplete.tsx` fehlt → TS2307 → `--no-verify` nötig (siehe Spec-Notiz).

## Update (lauf-Ende, Soft-Deadline)
- Frontend-COMPONENT vorhanden: `frontend/src/components/AddressAutocomplete.tsx` (KolInputText + eigene listbox/option, 4 Zustände, Tastatur, In-Flow-Liste, 44px, overflow-wrap:anywhere). `useAddressSearch` hat jetzt `error: boolean`.
- **BLOCKER gefunden:** `frontend/src/components/AddressAutocomplete.test.tsx` — 5/6 Tests failen mit „Found multiple elements with the role combobox". Ursache: `vitest.config.ts` setzt KEIN `globals: true` und `vitest.setup.ts` registriert kein `cleanup()` → `@testing-library/react` kann den Auto-Cleanup-`afterEach` nicht registrieren → DOM häuft sich über die Tests der Datei an. Test 1 (kein getByRole('combobox')) grün, alle anderen rot. FIX = Test-Pflege (in `vitest.setup.ts` `afterEach(cleanup)` ergänzen ODER `globals: true` in vitest.config.ts) — Test-Datei selbst darf nicht angefasst werden → NOT-READY, Draft-PR bleibt Draft.
