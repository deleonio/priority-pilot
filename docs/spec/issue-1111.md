# Koordinaten-Box „Gespeicherter Ortsbezug" unter dem Adressfeld

**Stand:** 2026-08-30

Im Task-/Serie-Formular zeigt eine **passive Anzeige-Box** unterhalb des Adressfeldes, welche Werte (`latitude`, `longitude`, `address`) gespeichert würden — beim Öffnen einer gespeicherten Aufgabe/Serie, nach Treffer-Auswahl, nach Freitext-Änderung und beim Leeren. Die Box löst **keine eigenen Geocoding-Requests** aus (geteilter 1-req/s-Limiter) und ändert nichts am Payload-Vertrag (`address`/`latitude`/`longitude`).

## Box-Vertrag

- **Gruppierung + Werte:** Nach Auswahl eines Treffers (`onSelect`) zeigt die Box drei **beschriftete** Werte: „Breitengrad", „Längengrad", „Adresse" — exakt die per `onSelect` übernommenen Werte des Treffers (identisch mit denen, die der Payload-Test an die API gehen sieht). Information nie allein über Anordnung.
- **ARIA:** Die Box ist eine Screenreader-Gruppe (`role="group"` mit accessible Name „Gespeicherter Ortsbezug") und liegt außerhalb des `role="combobox"`-Containers der Adresssuche (dort gehören nur Feld + Listbox hinein) — direkt unter dem Adressfeld im TaskForm gerendert. Kein `aria-live` (Freitext-Tippen feuert pro Tastenschlag; Announcement-Spam).
- **Initialwerte:** Beim Öffnen einer bestehenden Aufgabe **oder Serie** mit gespeicherten Koordinaten steht die Box mit diesen Werten da, **ohne** jede Interaktion.
- **Ersetzen:** Nach Auswahl eines zweiten, anderen Treffers zeigt die Box ausschließlich die neuen Werte — die alten sind vollständig verschwunden. Die Anzeige-Werte stehen in einem React-State-Spiegel; der Formular-Ref bleibt die Submit-Quelle, der State dient nur der Anzeige.
- **Freitext:** Wird der Adresstext geändert, ohne einen Treffer zu wählen, zeigt die Box statt der Zahlen einen ruhigen Hinweis (kein Fehler, keine Warnfarbe), dass **keine Koordinaten hinterlegt** sind — Wortlaut enthält „Keine Koordinaten hinterlegt" samt Hinweis, dass die Aufgabe dann nicht in der „In der Nähe"-Liste erscheint. Das Speichern schlägt nicht fehl: Payload enthält `latitude: null`/`longitude: null` und den Freitext als `address`.
- **Leeren:** Wird das Adressfeld geleert, verschwindet die Box (die Box erscheint nur, wenn der Adresstext nicht leer ist).
- **Anzeigeformat:** Koordinaten mit fester Nachkommastellenzahl und `tabular-nums`; die exakten Treffer-/Speicherwerte sind erkennbar — Rundung bei der _Anzeige_ ist erlaubt, der gespeicherte Wert bleibt exakt.

## Adressfeld als Suchfeld

Das Adressfeld rendert ein `input` mit `type="search"` (wie das Kopfzeilen-Suchfeld): `AddressAutocomplete` reicht `_type="search"` an `KolInputText` durch. Label („Adresse (optional)"), Placeholder und Freitext-Verhalten bleiben unverändert.

## 375px + Screenreader

Die Box ist bei 375px Breite vollständig sichtbar (Bounding-Box-Assertions `x ≥ 0`, `x + width ≤ 375` statt `scrollWidth` — die App-Shell clippt `overflow-x: hidden`). Lange Werte (Nominatim-`display_name`) brechen um statt abzuschneiden (`overflow-wrap: anywhere`). Gruppierung + accessible Name werden auf Einheitsebene geprüft; die Feld-Box-Zuordnung via `_ariaDetails` ist Implementierungsdetail und wird nicht per Shadow-DOM-Assertion genagelt.

## Randbedingungen

- Task- UND Serie-Modus teilen den Adressblock — die Box funktioniert in beiden Modi.
- Reine Styling-Punkte (Farb-/Token-Wahl, Abstände, Dunkelmodus) werden visuell verifiziert, nicht per Test erzwungen.
