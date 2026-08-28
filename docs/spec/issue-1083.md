# Spec #1083 — Adresssuche fuzzy machen: Photon primär, Nominatim als Fallback

Ziel: Tippfehler- und Umlaut-Varianten („Hauptbahnof Münche“, „munchen“) liefern klickbare
Treffer. Der Upstream der Adresssuche wechselt auf **Photon** (`https://photon.komoot.io/api`,
typo-tolerant, keine API-Key-Pflicht); **Nominatim bleibt Fallback** für den Fall, dass Photon
rate-limitiert oder nicht erreichbar ist. Im Frontend ersetzt eine **eigene Vorschlagsliste ohne
Substring-Gate** die `KolCombobox` (deren interner `includes`-Filter die Treffer leert).
DTO `{address, lat, lon}` und Route `GET /api/v1/geocode-search` bleiben unverändert.

## Server: `GET /api/v1/geocode-search` (Photon primär, Nominatim als Fallback)

- **AK1** Die Route fragt **zuerst** Photon ab (`https://photon.komoot.io/api?q=…&limit=5&accept-language=de`)
  und mappt die GeoJSON-`features` auf `{address, lat, lon}`. Photon liefert Koordinaten als
  `[lon, lat]` — die Reihenfolge wird beim Mapping getauscht (`lat = coordinates[1]`,
  `lon = coordinates[0]`). Der `address`-String wird aus den `properties` zusammengesetzt und
  enthält mindestens Name/Straße und Ort (Zusammensetzung im Detail freigestellt). Fehlerhafte
  Einträge (fehlende Koordinaten, nicht-numerische Werte) fallen wie heute ersatzlos weg.
- **AK2** Photon **429**, anderer **Nicht-2xx**, **Timeout** oder **Netzwerkfehler** → die Antwort
  kommt vom Nominatim-Fallback (bestehendes Nominatim-Mapping `display_name`/`lat`/`lon` bleibt
  unverändert, `limit=5`, `accept-language=de`, User-Agent-Pflicht).
- **AK3** Photon antwortet **200 mit 0 Treffern** (`features: []`) → **legitimes leeres Ergebnis**:
  `200 []`, Nominatim wird **nicht** aufgerufen (schont das 1-req/s-Kontingent).
- **AK4** Verhalten bleibt: fehlender/leerer `q` → `400`; Rate-Limit (1 req/s, Key IP+Session,
  geteilt mit Reverse-Geocoding) → `200 []`. Der Limiter heißt künftig
  `isGeocodeRateLimited` (statt `isNominatimRateLimited`) — reiner Rename, Verhalten und die
  gemeinsame Nutzung mit `reverseGeocode.ts` bleiben (Verhalten ist bereits durch die bestehenden
  Tests `geocode-search.test.ts` „Rate-Limit …“ abgedeckt, daher kein zusätzlicher Test).

## Frontend: eigene Vorschlagsliste statt `KolCombobox` (`AddressAutocomplete.tsx`)

- **AK5 (kein Substring-Gate)** Die Liste zeigt **alle** Server-Treffer — ungefiltert, auch wenn
  der Suchtext im Anzeigetext der Treffer nicht als Substring vorkommt („munchen“ → München-Treffer
  bleiben sichtbar und klickbar). Es gibt keine clientseitige Vorfilterung der Server-Ergebnisse.
- **AK5 (ARIA)** Das Eingabefeld ist `role="combobox"` mit `aria-expanded`, `aria-controls`,
  `aria-autocomplete="list"` und `aria-activedescendant` auf der markierten Option; die Liste ist
  `role="listbox"`, jeder Treffer `role="option"` (harte Selektor-Verpflichtung: der #1061-E2E
  sucht `getByRole('option')`).
- **AK5 (Tastatur)** ↑/↓ bewegen die Markierung innerhalb der Liste (nicht den Formular-Fokus),
  Enter wählt die markierte Option (`onSelect` mit `{address, lat, lon}`) und schließt die Liste,
  **ohne** das umgebende Formular abzuspeichern; Escape schließt die Liste; Tab/Blurfokus schließt
  ohne Auswahl. Freitext-Enter wird nicht blockiert.
- **AK5 (asynchrone Zustände, KI-UX Regel 7)** vier unterschiedene Zustände statt „nur Liste“:
  _Laden_ (Spinner mit accessible Label), _Leer_ (neutraler Hinweis, Einladung zur Freitext-Übernahme),
  _Fehler_ (sichtbare Warnung mit Weg — „Adresse bitte manuell eintippen“; Fehler und „keine Treffer“
  sind **nicht** mehr ununterscheidbar) und _Erfolg_ (Liste). Das erfordert, dass
  `useAddressSearch` einen Fehlerzustand nach außen meldet, statt ihn still zu einer leeren Liste
  zu machen (Hook-Erweiterung, Signatur von `suggestions`/`loading` bleibt kompatibel).
- **AK6 (Freitext + Auswahl)** Freitext-Eingabe ohne Auswahl schreibt live in den Formular-State
  und speichert sich wie bisher als `address` **ohne** Koordinate. Explizite Auswahl eines Treffers
  übernimmt `{address, lat, lon}` in den Create-Payload (`latitude`/`longitude`, #1066). Die
  heutige onChange/onInput-Doppelbedienung wird 1:1 fortgeführt, damit Freitext live bleibt.
- **UX-Randbedingungen (beratend, KI-UX-Block):** Liste als In-Flow-Block unter dem Feld (kein
  Portal/fixed-Overlay, sonst brechen die Bounding-Box-Assertions des #1061-E2E bei 375 px);
  `overflow-wrap: anywhere` für lange `display_name`; Option-Zeile ≥ 44 px hoch, max. 5 Treffer,
  kein Innen-Scrolling; Ergebnisanzahl über `aria-live="polite"`; Token (`--pp-surface-*`,
  `--pp-border-strong`, `--pp-focus-ring`), Hell/Dunkel beides rechnen; Ein-/Ausblenden mit
  `--pp-motion-fast`, unter `prefers-reduced-motion` nur Opacity. Reine Styling-Punkte werden
  visuell verifiziert, nicht per Test erzwungen — getestet werden In-Viewport (AK7) und Rollen.
- **KoliBri-First-Abweichung:** kein fuzzy-fähiges KoliBri-Element, kein Filter-Hook in
  `@public-ui` 4.3.0 (`spec/combobox` — kein Abschalt-Prop; `KolSingleSelect` scheidet aus, weil
  es keine Freitext-Eingabe zulässt und AK6 kollidiert). Abweichung im Code kommentieren und im
  PR begründen (ux-design.md §4). Nur der Adress-Block im Task-/Serie-Formular wechselt;
  `DependencyModal.tsx`/`LlmSettings.tsx` bleiben unangetastet. Empfohlene Aufteilung:
  `KolInputText` für das Feld + eigene Liste als dokumentierte Ausnahme.

## Tests (Spez-PR = nur rote Tests + diese Spec)

| AK      | Test                                                                                                       | Datei                                                  | Stand jetzt          |
| ------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------- |
| AK1     | Photon primär, GeoJSON `[lon,lat]`-Tausch, `limit=5`, `accept-language=de`, Photon-Treffer statt Nominatim | `server/src/express/geocode-search.test.ts`            | rot                  |
| AK2     | Photon 429 → Nominatim-Fallback                                                                            | `server/src/express/geocode-search.test.ts`            | rot                  |
| AK2     | Photon nicht erreichbar (fetch wirft) → Nominatim-Fallback                                                 | `server/src/express/geocode-search.test.ts`            | rot                  |
| AK3     | Photon 200 mit 0 Treffern → `[]`, Nominatim nicht gerufen                                                  | `server/src/express/geocode-search.test.ts`            | rot                  |
| AK4     | — bereits gedeckt: 400 (fehlend/leer), Rate-Limit, geteilter Limiter                                       | `server/src/express/geocode-search.test.ts`            | grün, bleibt         |
| AK5     | alle Server-Treffer ohne Substring-Gate („munchen“)                                                        | `frontend/src/components/AddressAutocomplete.test.tsx` | rot (Modell fehlt)   |
| AK5     | ARIA combobox/listbox/option + Tastatur ↑/↓/Enter/Escape                                                   | `frontend/src/components/AddressAutocomplete.test.tsx` | rot                  |
| AK5     | Zustände Laden/Leer/Fehler unterscheidbar                                                                  | `frontend/src/components/AddressAutocomplete.test.tsx` | rot                  |
| AK6     | Freitext-Submit — bereits gedeckt (`TaskForm.test.tsx` „Submit sendet die eingegebene Adresse“)            | `frontend/src/components/TaskForm.test.tsx`            | grün, bleibt         |
| AK6     | Auswahl eines Vorschlags übernimmt lat/lon in den Create-Payload                                           | `frontend/src/components/TaskForm.test.tsx`            | rot (Liste fehlt)    |
| AK5/AK7 | 375 px: „munchen“ zeigt alle Treffer, Feld + Liste im Viewport                                             | `frontend/e2e/issue-1061-task-address.spec.ts`         | rot (Substring-Gate) |

## Offene Fragen

- keine blockierenden. Beratende Defaults aus dem KI-UX-Block, in dieser Spec festgenagelt:
  1. **Fehler vs. leer:** sichtbare Warnung bei fehlgeschlagener Suche, neutraler Leer-Zustand bei 0 Treffern.
  2. **Autoselect:** keine Vorauswahl der Treffer; Auswahl nur explizit per Klick/Enter.
