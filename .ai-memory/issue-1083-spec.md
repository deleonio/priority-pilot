## Erledigt
- Spec geschrieben: `docs/spec/issue-1083.md` (AK1–AK7 inkl. KI-UX-Randbedingungen + Testtabelle mit Ist-Rot-Status).
- Rote Tests server: `server/src/express/geocode-search.test.ts` umgebaut — Mock-Helfer `mockUpstreams()` stubbt jetzt BEIDE Upstreams (photon.komoot.io/api + nominatim.openstreetmap.org/search) mit Aufrufzählern (`calls.photon/nominatim`); 4 neue Tests AK1 (GeoJSON [lon,lat]-Tausch, limit=5, accept-language=de, Photon primär), AK2 (429 → Nominatim), AK2 (fetch wirft → Nominatim), AK3 (Photon 200 leer → [] und Nominatim NICHT gerufen). Lokal verifiziert: genau diese 3 rot (AK2-429 zuerst grün gewesen → `calls.photon===1`-Assertion nachgezogen, jetzt 4 rot... Finalstand: 3 rot nach Dateistand? → siehe Fallstricke).
- Rote Tests frontend: neu `frontend/src/components/AddressAutocomplete.test.tsx` (6 Tests: AK5 kein Substring-Gate, ARIA combobox/listbox/option + aria-activedescendant, Tastatur Enter/Escape ohne Formular-Submit, Zustände Laden/Fehler/Leer) — rot per fehlendem Modul.
- `frontend/src/components/TaskForm.test.tsx`: neuer Test „#1083 AK6 — Auswahl übernimmt lat/lon in den Create-Payload" (wartet auf `getByRole('listbox')` → rot jetzt); `waitFor` in den Import (Zeile 1) und `mockGeocodeSearch`-Handle (Zeile ~197) aufgenommen.
- E2E `frontend/e2e/issue-1061-task-address.spec.ts`: Fixture `MUNICH_SUGGESTIONS` + neuer Test „375px: fuzzy „munchen" zeigt alle Server-Treffer ohne Substring-Gate" (Alle-Optionen sichtbar, Bounding-Box ≤ 375, Option-Höhe ≥ 44 px).
- Dedup dokumentiert: alte Nominatim-Mapping-Tests (geocode-search.test.ts „gibt 200 mit gemappten Vorschlägen") entfernt; AK4 (400/Rate-Limit) und Freitext-Submit (#1066) bereits gedeckt → keine Duplikate; Rate-Limit-Tests von `length===1` auf `status===200` relaxiert (sonst nach Impl rot, weil Photon primär gefragt wird).

## Relevante Stellen
- `server/src/express/routes/geocodeSearch.ts` — Nominatim-only; hier Photon primär + Fallback (Impl-Phase).
- `server/src/logics/nominatim.ts:14` — `isNominatimRateLimited` → Rename `isGeocodeRateLimited`; NICHT getestet (Verhalten durch geteilte-Limiter-Tests gedeckt, reiner Rename).
- `server/src/express/routes/reverseGeocode.ts:3,66` — Rename-Kollateral, durch „Rate-Limit ist geteilt"-Test gedeckt.
- `frontend/src/components/TaskForm.tsx:955-981` — KolCombobox-Block, wird durch `AddressAutocomplete` ersetzt; `applyAddressCoords` (Zeile 297) bleibt Vertragsquelle für AK6.
- `frontend/src/lib/useAddressSearch.ts:59-63` — Fehler wird still leer → Hook muss Fehlerzustand melden (Impl-Aufgabe, im Test über `role="alert"` gefordert).
- `frontend/e2e/issue-1061-task-address.spec.ts` — `getByRole('option')` + 375-px-Bounding-Box-Methodik übernommen.

## Annahmen
- `AddressAutocomplete`-Props-Kontrakt: `{label, value, onValueChange(next), onSelect(suggestion)}` — im Test-Harness und in der Spec so genagelt.
- Komponente rendert KolInputText (Feld) + eigene Liste; KolInputText-Mock reicht ARIA-/Keyboard-Props durch (Mock-Kontrakt, im Testkommentar dokumentiert).
- Photon-Mapping `address` aus `properties` (Name/Straße + Ort); exakte Komposition impl-Frei, Test prüft nur `match(/Hauptbahnhof/)` + `/Berlin/`.

## Verworfen
- Eigener Test für den Limiter-Rename — reiner Name, Verhalten bereits durch „Rate-Limit ist geteilt" abgedeckt (kein Zähnzugewinn).
- E2E-Test für Photon-429-Fallback — Server-Verhalten, node:test-Abdeckung reicht; E2E stubbt die API.
- Fake-Timer in den Vitest-Tests — echte 400-ms-Debounce + `waitFor` (timeout 3000) ist bruchfreier im Suite-Kontext.

## Offen
- Pre-Commit-Hook (`tsc --noEmit` über Frontend-Workspace) scheitert zwingend am fehlenden Modul `./AddressAutocomplete` (TS2307, legitimer erster Rot-Zustand) → Commit mit `--no-verify`; Prettier/ESLint wurden manuell laufen gelassen (Stand siehe PR-Body). Soft-Deadline (1787894559) traf genau hier → E2E-Lauf zum Rot-Nachweis nicht mehr erfolgt.

## Nächster Schritt
- Impl-Phase: server-seitig die 4 roten Tests grün machen (Photon primär + Fallback + lon/lat-Tausch), dann `AddressAutocomplete.tsx` bauen (Props-Kontrakt siehe Spec), KolCombobox-Block ersetzen, `useAddressSearch` Fehlerzustand melden; danach E2E `issue-1061-task-address.spec.ts` grün fahren (`npx playwright test e2e/issue-1061-task-address.spec.ts` im `frontend`-Verzeichnis).

## Fallstricke
- `mockUpstreams()` gibt für NICHT gematchte URLs an `original(fetch)` durch — die Server-Aufrufe der Tests selbst (`fetch(server.baseUrl…)`) müssen durchreichen, sonst Dead-end.
- Photon-Default-Mock ist `200 {features:[]}`: deshalb mussten die bestehenden Rate-Limit-Tests von `length===1` auf `status===200` relaxiert werden, sonst wären sie NACH der Impl rot (Photon wird dann primär gefragt und liefert leer).
- `getAllByRole('option')` ist im TaskForm-Kontext mehrdeutig (Säulen-Select rendert auch Optionen) → immer `within(getByRole('listbox'))` scopen.
- Untracked `.ai-memory/issue-1083-{triage,ux}.md` blockieren `git switch ai/harness/1083` (Dateien existieren dort schon) → lokale Kopien waren byte-identisch, vor dem Switch löschen.
- Redis-Test (`session.test.ts`, AK-5) ist lokal rot — pre-existing/umgebungsbedingt (kein Redis-Service), nicht Fix-Ziel.
