# Adresssuche: Photon primär, Nominatim als Fallback

**Stand:** 2026-08-30

Die Adresssuche ist typo-tolerant: Tippfehler- und Umlaut-Varianten („Hauptbahnof Münche", „munchen") liefern klickbare Treffer. Der Server fragt dafür primär **Photon** ab; **Nominatim** dient als Fallback, wenn Photon rate-limitiert oder nicht erreichbar ist. Im Frontend zeigt eine eigene Vorschlagsliste alle Server-Treffer ungefiltert an. DTO `{address, lat, lon}` und Route `GET /api/v1/geocode-search` sind stabil.

## Server: `GET /api/v1/geocode-search`

- Die Route fragt **zuerst** Photon (`https://photon.komoot.io/api?q=…&limit=5&accept-language=de`) ab und mappt die GeoJSON-`features` auf `{address, lat, lon}`. Photon liefert Koordinaten als `[lon, lat]` — die Reihenfolge wird beim Mapping getauscht. Der `address`-String wird aus den `properties` zusammengesetzt und enthält mindestens Name/Straße und Ort (Zusammensetzung im Detail freigestellt). Fehlerhafte Einträge (fehlende Koordinaten, nicht-numerische Werte) fallen ersatzlos weg.
- Photon **429**, anderer **Nicht-2xx**, **Timeout** oder **Netzwerkfehler** → die Antwort kommt vom Nominatim-Fallback (Mapping `display_name`/`lat`/`lon`, `limit=5`, `accept-language=de`, User-Agent-Pflicht).
- Photon antwortet **200 mit 0 Treffern** (`features: []`) → **legitimes leeres Ergebnis**: `200 []`, Nominatim wird **nicht** aufgerufen (schont das 1-req/s-Kontingent).
- Fehlender/leerer `q` → `400`. Rate-Limit (1 req/s, Key IP+Session, geteilt mit dem Reverse-Geocoding) → `200 []`.

## Frontend: eigene Vorschlagsliste (`AddressAutocomplete`)

- **Kein Substring-Gate:** Die Liste zeigt **alle** Server-Treffer — ungefiltert, auch wenn der Suchtext im Anzeigetext der Treffer nicht als Substring vorkommt („munchen" → München-Treffer bleiben sichtbar und klickbar). Es gibt keine clientseitige Vorfilterung der Server-Ergebnisse.
- **ARIA:** Das Eingabefeld ist `role="combobox"` mit `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` und `aria-activedescendant` auf der markierten Option; die Liste ist `role="listbox"`, jeder Treffer `role="option"`.
- **Tastatur:** ↑/↓ bewegen die Markierung innerhalb der Liste (nicht den Formular-Fokus), Enter wählt die markierte Option (`{address, lat, lon}`) und schließt die Liste, **ohne** das umgebende Formular abzuspeichern; Escape schließt die Liste; Tab/Blur schließt ohne Auswahl. Freitext-Enter wird nicht blockiert.
- **Vier unterschiedene Zustände:** _Laden_ (Spinner mit accessible Label, „Adresse wird gesucht …"), _Leer_ (neutraler Hinweis mit Einladung zur Freitext-Übernahme, „Keine Treffer — Adresse direkt übernehmen."), _Fehler_ (sichtbare Warnung mit Handungsweg, „Adresssuche nicht erreichbar — Adresse bitte manuell eintippen.") und _Erfolg_ (Liste). Fehler und „keine Treffer" sind unterscheidbar.
- **Freitext + Auswahl:** Freitext-Eingabe ohne Auswahl schreibt live in den Formular-State und speichert sich als `address` **ohne** Koordinate. Explizite Auswahl eines Treffers übernimmt `{address, lat, lon}` in den Create-Payload (`latitude`/`longitude`).
- **Layout:** Liste als In-Flow-Block unter dem Feld (kein Overlay), lange Treffer brechen mit `overflow-wrap: anywhere` um, Optionszeilen sind mindestens 44 px hoch, maximal 5 Treffer ohne Innen-Scrolling; die Ergebnisanzahl wird über `aria-live="polite"` angekündigt. Nur der Adress-Block im Task-/Serie-Formular nutzt diese Liste; `DependencyModal` und `LlmSettings` bleiben bei KoliBri-Bordmitteln.

### Begründung der KoliBri-Abweichung

Kein KoliBri-Element unterstützt fuzzy-Suche ohne Substring-Filter (`KolCombobox` filtert intern per `includes` und leert damit die Treffer; `KolSingleSelect` lässt keine Freitext-Eingabe zu). Daher die Kombination `KolInputText` + eigene Liste.
