# Spec #1111 — Koordinaten-Box „Gespeicherter Ortsbezug" unter dem Adressfeld

Ziel: Im Task-/Serie-Formular ist nach der Adresssuche nicht erkennbar, ob (und welche)
Koordinaten gespeichert werden. Unterhalb des Adressfeldes erscheint eine **passive
Anzeige-Box**, die die drei DB-Werte (`latitude`, `longitude`, `address`) wahrheitsgetreu
spiegelt — beim Öffnen einer gespeicherten Aufgabe/Sofort, nach Treffer-Auswahl, nach
Freitext-Änderung und beim Leeren. Die Box löst **keine eigenen Geocoding-Requests** aus
(geteilter 1-req/s-Limiter, #1083) und ändert nichts am Payload-Vertrag
(`address`/`latitude`/`longitude`, TaskForm.tsx:607–608/622–623).

## Box-Vertrag (TaskForm.tsx)

- **AK1 (Gruppierung + Werte)** Nach Auswahl eines Treffers (`onSelect`) zeigt die Box drei
  **beschriftete** Werte: „Breitengrad", „Längengrad", „Adresse" — exakt die per `onSelect`
  übernommenen `lat`/`lon`/`address` des Treffers (Identität mit den Werten, die der
  bestehende #1083-Payload-Test an die API gehen sieht). Information nie allein über
  Anordnung (KI-UX Regel 9).
- **AK1 (ARIA)** Die Box ist eine Screenreader-Gruppe (`role="group"` mit accessible Name
  „Gespeicherter Ortsbezug") und liegt **außerhalb** des `role="combobox"`-Containers von
  `AddressAutocomplete` (dort gehören nur Feld + Listbox hinein) — direkt unter dem
  Adressfeld im TaskForm gerendert. Kein `aria-live` (Freitext-Tippen feuert pro
  Tastenschlag; Announcement-Spam, KI-UX-Block).
- **AK2 (Initialwerte)** Beim Öffnen einer bestehenden Aufgabe **oder Serie** mit
  gespeicherten Koordinaten steht die Box mit diesen Werten da, **ohne** jede Interaktion
  (Quelle: `task?.latitude ?? series?.latitude`, TaskForm.tsx:262–263; Anzeige-Adresse =
  `task?.address ?? series?.address`).
- **AK3 (Ersetzen)** Nach Auswahl eines zweiten, anderen Treffers zeigt die Box ausschließlich
  die neuen Werte — die alten sind vollständig verschwunden. Dafür müssen `latitude`/
  `longitude` (und `address`) zusätzlich zum `form.current`-Ref in einem **React-State-Spiegel**
  stehen (Ursache des Bugs: `applyAddressCoords` schreibt nur den Ref, TaskForm.tsx:293–296 —
  ohne State kein Re-Render). Der Ref bleibt die Submit-Quelle; der State ist nur Anzeige.
- **AK4 (Freitext)** Wird der Adresstext geändert, ohne einen Treffer zu wählen, zeigt die Box
  statt der Zahlen einen ruhigen Hinweis (kein Fehler, keine Warnfarbe), dass **keine
  Koordinaten hinterlegt** sind — Wortlaut enthält „keine Koordinaten". Das Speichern schlägt
  nicht fehl: Payload enthält `latitude: null`/`longitude: null` und den Freitext als `address`
  (Verwerfen alter Koordinaten bei Freitext existiert bereits, TaskForm.tsx:954–958).
- **AK5 (Leeren)** Wird das Adressfeld geleert, verschwindet die Box (konsistente Umsetzung
  der im AK erlaubten Varianten „verschwindet" **oder** „keine-Koordinaten-Zustand" —
  gewählt: verschwinden, KI-UX-Empfehlung „Box nur zeigen, wenn Adresstext nicht leer").
- **Anzeigeformat (beratend, KI-UX):** Koordinaten mit fester Nachkommastellenzahl (z. B. 6)
  und `tabular-nums`; die Tests nageln nur, dass die **exakten** Treffer-/Speicherwerte
  erkennbar sind (`48.1402` als Teil des angezeigten Texts) — Rundung bei der _Anzeige_ ist
  erlaubt, der gespeicherte Wert bleibt exakt.

## Adressfeld als Suchfeld (AddressAutocomplete.tsx)

- **AK6** Das Adressfeld rendert ein `input` mit `type="search"` (wie das Kopfzeilen-Suchfeld,
  `SearchModal.tsx:58`): `AddressAutocomplete` reicht `_type="search"` an `KolInputText`
  durch (Prop in @public-ui 4.3.0 gültig: `"search" | "tel" | "text" | "url"`). Label,
  Placeholder und Freitext-Verhalten bleiben unverändert (`getByLabel('Adresse (optional)')`
  der #1061/#1083-Tests muss weiter greifen).

## 375 px + Screenreader (e2e)

- **AK7** Die Box ist bei 375 px Breite vollständig sichtbar: Bounding-Box-Assertions
  (`x ≥ 0`, `x + width ≤ 375`) statt `scrollWidth` — die App-Shell clippt
  `overflow-x: hidden`, der Overflow wäre sonst unsichtbar, aber die Werte abgeschnitten
  (MEMORY 2026-08-24). Lange Werte (Nominatim-`display_name`) brechen um statt
  abzuschneiden (`overflow-wrap: anywhere`, Muster der #1083-Liste).
- **AK7 (ARIA, Einheitsebene)** Gruppierung + accessible Name werden auf Einheitsebene
  geprüft (TF1); die Feld-Box-Zuordnung via `_ariaDetails` ist Implementierungsdetail der
  Umsetzung und wird nicht per Shadow-DOM-Assertion genagelt.

## Testabbildung

| TF  | AK  | Ebene/Datei                                                                                            |
| --- | --- | ------------------------------------------------------------------------------------------------------ |
| TF1 | AK1 | Vitest `frontend/src/components/TaskForm.test.tsx` — Auswahl → Box mit 3 beschrifteten Werten          |
| TF2 | AK2 | Vitest `TaskForm.test.tsx` — Task **und** Serie mit gespeicherten Koordinaten → Box sofort da          |
| TF3 | AK3 | Vitest `TaskForm.test.tsx` — zweiter Treffer ersetzt die Werte vollständig                             |
| TF4 | AK4 | Vitest `TaskForm.test.tsx` — Freitext → Hinweis statt Zahlen, Payload `latitude: null`                 |
| TF5 | AK5 | Vitest `TaskForm.test.tsx` — Feld leeren → Box weg                                                     |
| TF6 | AK6 | Vitest `frontend/src/components/AddressAutocomplete.test.tsx` — `input[type="search"]`                 |
| TF7 | AK7 | e2e `frontend/e2e/issue-1111-coords-box.spec.ts` — 375 px, Geocode-Stub per `page.route`, Bounding-Box |

## Randbedingungen

- Task- UND Serie-Modus teilen den Adressblock (#1063/#1072) — die Box muss in beiden Modi
  funktionieren (TF2 deckt beide ab).
- Bestehende #1083-Tests (`TaskForm.test.tsx` „Adressfeld"-Describe,
  `AddressAutocomplete.test.tsx`) und `issue-1061-task-address.spec.ts` bleiben unverändert grün.
- Payload-Feldnamen und API-Vertrag bleiben unverändert; die Box macht keine eigenen Requests.
- Reine Styling-Punkte (Farb-/Token-Wahl, `tabular-nums`, Abstände, Dunkelmodus) werden
  visuell verifiziert, nicht per Test erzwungen.
