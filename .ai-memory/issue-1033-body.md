IST:

<img width="1713" height="182" alt="Image" src="https://github.com/user-attachments/assets/914d4652-e52d-435a-92fe-91d0c966b1fc" />

Ich möchte, dass diese Notifikation in der App besser mobil bedienbar ist, sodass man den Schalter (Aktions-Button) leicht treffen kann. Zudem sollte der Text etwas menschlicher und beschreibender sein.

<!-- KI-ANALYSE:START stand=2026-08-26T01:56:34Z -->

### UI-Bezug

- UI-Bezug: ja
- Begründung: Touch-Target-Größe, Layout bei 375px und Wortlaut der Nutzeransprache — reine UI-/UX-Änderung am PWA-Update-Hinweis.

### Spec

- Spec nötig: ja
- Begründung: Anwendungscode unter `frontend/src/**` (Komponente + `app.css`) wird geändert, die Texte sind per Unit-Test prüfbar.

### Aufwandsklasse

- Aufwandsklasse: sonnet
- Begründung: Eng umrissene Änderung an einer Komponente plus einem CSS-Block; keine neue Logik, keine API, keine Zustandsführung.

### Umsetzungskontext

- Betroffene Dateien: `frontend/src/components/UpdatePrompt.tsx`, `frontend/src/app.css` (Block `.update-prompt`, ab Zeile 1548), `frontend/src/components/UpdatePrompt.test.tsx`
- Betroffene Komponenten: React-Komponente `UpdatePrompt`, darin `KolCard _label="Update"` / `KolCard _label="Offline"` sowie die `KolButton`-Wrapper `span[data-testid="pwa-update-reload"]` und `span[data-testid="pwa-offline-close"]`
- Vorhandenes Muster: `frontend/src/app.css` — die Toolbar-Buttons setzen `--pp-toolbar-height: 2.75rem` (= 44px, WCAG 2.5.5, Zeilen 239–249), weitere Tap-Targets `min-width: 44px; min-height: 44px` (Zeilen 1143 f.). Dieselbe 44px-Naht auf die Prompt-Buttons anwenden.
- Randbedingungen:
  - `.update-prompt` bleibt `position: fixed` am unteren Rand mit `pointer-events: none` auf dem Container und `pointer-events: auto` nur auf den Karten — der Bereich daneben muss weiter bedienbar bleiben.
  - Die Klick-Naht bleibt unverändert: Handler auf dem nativen `span`-Wrapper, nicht auf `KolButton._on.onClick` (Kommentar in `UpdatePrompt.tsx:12-16`) — sonst brechen die JSDOM-Tests.
  - `padding-bottom: calc(1rem + env(safe-area-inset-bottom))` (iOS-Safe-Area) darf nicht entfallen.
  - Der Hinweis bleibt reine In-App-Card, keine zusätzliche System-Notification (`UpdatePrompt.tsx:8-10`).
- Erwartetes Ergebnis: Bei 375px füllt der Aktions-Button die Kartenbreite und ist mindestens 44 × 44 px groß; die Karten laufen nicht über den Viewport hinaus. Die Kartentexte erklären in ganzen Sätzen, was passiert ist und was der Klick bewirkt.

### Akzeptanzkriterien

- AK1: Der Update-Button ist bei 375px mindestens 44 px hoch und über die volle Breite der Karte klickbar — der Wrapper-`span` ist ein Blockelement mit voller Breite, nicht nur der Textkern des Buttons.
- AK2: Dasselbe gilt für den Schließen-Button der Offline-Karte.
- AK3: Beide Karten laufen bei 375px nicht über den Viewport hinaus (Bounding-Box: `x + width <= 375`); der Container behält `pointer-events: none`, die Karten `pointer-events: auto`.
- AK4: Der Update-Text ist ein beschreibender Satz statt der Fragmentzeile „Neue Version verfügbar“ — er nennt, dass eine neuere Version bereitsteht und dass Neuladen sie aktiviert.
- AK5: Der Offline-Text ist ein beschreibender Satz statt „App ist offline-bereit“ — er nennt, dass die App ab jetzt auch ohne Internetverbindung nutzbar ist.
- AK6: Die bestehende Klick-Naht bleibt intakt: Ein Klick auf `span[data-testid="pwa-update-reload"]` ruft `updateServiceWorker(true)` genau einmal auf; ein Klick auf `span[data-testid="pwa-offline-close"]` blendet die Offline-Karte aus.
- AK7: Ohne `needRefresh` und ohne `offlineReady` rendert die Komponente weiterhin nichts (`null`).

### Testfälle

- AK1/AK2 → **Vitest-Unit** (`frontend/src/components/UpdatePrompt.test.tsx`): Der Wrapper-`span` trägt die CSS-Klasse, an der die 44px-Regel hängt (z. B. `update-prompt__action`). JSDOM misst keine Layout-Werte — geprüft wird die Klassennaht; die tatsächliche Größe deckt der visuelle Check ab.
- AK1/AK2/AK3 (Geometrie) → **visuelle Verifikation bei 375px**. Begründung: Der Prompt lässt sich in Playwright nicht deterministisch auslösen, weil er an einem echten Service-Worker-`waiting`-Zustand hängt; das ist in `frontend/e2e/pwa-update-prompt.spec.ts:5-13` bereits dokumentiert und dort bewusst so entschieden. Zusätzlich gilt: „kein horizontaler Overflow“ ist in dieser App nicht per `scrollWidth` prüfbar (App-Shell clippt mit `overflow-x: hidden`) — falls doch ein e2e ergänzt wird, muss er Bounding-Boxen messen.
- AK4/AK5 → **Vitest-Unit** (`UpdatePrompt.test.tsx`): `getByText` auf den neuen Sätzen; die alten Fragmente „Neue Version verfügbar“ und „App ist offline-bereit“ kommen nicht mehr vor.
- AK6 → **Vitest-Unit** (`UpdatePrompt.test.tsx`, bestehende Tests): Klick auf den Wrapper ruft den gemockten `updateServiceWorker` mit `true` auf bzw. entfernt die Offline-Karte.
- AK7 → **Vitest-Unit** (`UpdatePrompt.test.tsx`, bestehender Test): Der Container ist leer, wenn beide Flags false sind.

### Ampel

- Ampel: 🟢
- Begründung: Anforderung, betroffene Dateien und das Vorbild-Muster (44px-Touch-Target) sind bekannt; in einem PR umsetzbar. Der genaue Wortlaut der neuen Texte ist eine UX-Entscheidung und wird in der UX-Phase festgelegt — AK4/AK5 geben den prüfbaren Rahmen vor.

### ❓ Offene Fragen

- [ ] Keine.

<!-- KI-ANALYSE:END -->
