## Kurz und konkret

Nach dem Schließen des Suchdialogs (SearchModal) wechselt die Ansicht automatisch zum Aufgaben-Tab und zeigt die gefilterten Aufgaben an. Aktuell liegt der Fokus jedoch nicht im Suchfeld oberhalb der Aufgabenliste.

## Was ist das Problem?
Beim Wechsel vom Suchdialog auf die Aufgabenliste liegt der Fokus nicht im Suchfeld (`KolInputText`) oberhalb der Aufgabenliste. Der Nutzer muss manuell das Suchfeld fokussieren, um direkt weiter suchen zu können.

## Wie soll es sein?
Nach dem Schließen des Suchdialogs und dem automatischen Wechsel zum Aufgaben-Tab soll der Fokus initial im Suchfeld oberhalb der Aufgabenliste liegen, damit der Nutzer sofort weiter tippen kann.

## Wo tritt es auf?
- `frontend/src/components/SearchModal.tsx` (Dialog mit Suchfeld)
- `frontend/src/App.tsx` (Aufgaben-Tab mit Suchfeld `task-filter-search__field`)

## Woran messen wir das?
- Nach dem Schließen des SearchModal via `onSearch` ist das Suchfeld `KolInputText` mit Klasse `task-filter-search__field` im Aufgaben-Tab fokussiert
- Der Fokus ist programmatisch gesetzt (nicht manuell durch Nutzer)
- Tastatureingabe ist sofort nach dem Wechsel möglich

## Screenshots / weitere Hinweise

IST:

<img width="1036" height="383" alt="Image" src="https://github.com/user-attachments/assets/935c21c1-b96f-4358-b868-6d7c712e25c8" />

Im Screenshot sieht man, dass der Fokus aktuell nicht im Suchfeld ist.

<!-- KI-ANALYSE:START stand=2026-08-27T18:59:17Z -->
### Umsetzungskontext
- Betroffene Dateien: `frontend/src/App.tsx`, `frontend/e2e/search-modal.spec.ts` (neue Tests)
- Betroffene Komponenten: `SearchModal` (`onSearch`-Flow), `KolInputText.task-filter-search__field` im Aufgaben-Tab (App.tsx:542), `Modal`-Unmount-Cleanup (Modal.tsx:136-145)
- Vorhandenes Muster: `frontend/src/components/SearchModal.tsx:24-29` — programmatischer Fokus auf `KolInputText` via Ref (`HTMLKolInputTextElement`) + Shadow-DOM-Query mit Timeout; alternativ KoliBri-`focus()` am Host (wiederholt bis 10 Frames, siehe Kommentar Modal.tsx:99-118)
- Randbedingungen: Der `Modal`-Cleanup gibt beim Unmount den Fokus per `setTimeout(0)` an den Auslöser (Toolbar-Such-Button) zurück — der neue Fokus muss NACH dieser Rückgabe greifen (Timing/Race beachten). Der Tab-1-Inhalt ist unkonditional gerendert (App.tsx:527), das Feld existiert also IMMER im DOM. Das Schließen ohne Suche (Abbrechen/Escape/Backdrop) darf sein Verhalten nicht aendern. Der ESLint-Shadow-DOM-Guard (#824) gilt nur fuer Test-Dateien, Prod-Code darf piercen.
- Erwartetes Ergebnis: Nach dem Ausloesen der Suche im SearchModal (Enter oder Button „Suche starten") wechselt die App zum Aufgaben-Tab, der Filter ist aktiv und der Tastaturfokus liegt im Filterfeld `task-filter-search__field` — Tippen landet direkt im Feld.
- Loesungsansatz: Ref auf das Filter-`KolInputText` im Aufgaben-Tab; im `onSearch`-Pfad (App.tsx:638-646) Fokus programmatisch setzen, nachdem Tab-Wechsel und Modal-Unmount abgeschlossen sind — via KoliBri-`focus()` am Host (Retry-Mechanismus) und/oder kurzem Delay nach der Modal-Fokus-Rueckgabe; Timing per e2e absichern.

### Akzeptanzkriterien
- AK1: Nach dem Ausloesen der Suche im SearchModal (Enter-Taste ODER Button „Suche starten") mit mindestens einem Zeichen liegt der Fokus im Filterfeld `task-filter-search__field` des Aufgaben-Tabs (KolInputText, „Nach Titel filtern"), und die Liste ist gefiltert.
- AK2: Eine Tastatureingabe unmittelbar nach dem Wechsel landet im Filterfeld (Zeichen erscheint im Feld, Filter reagiert darauf).
- AK3: AK1 gilt auch bei 375px-Viewport (mobile-first).
- AK4: Beim Schließen des SearchModal OHNE Suche (Escape, „Abbrechen" oder Backdrop) bleibt das bisherige Verhalten erhalten — der Fokus kehrt zum Ausloeser zurueck und liegt NICHT im Filterfeld.

### Testfälle
- TF1 (e2e, Erweiterung `frontend/e2e/search-modal.spec.ts`): Suche ueber Toolbar oeffnen, Begriff eingeben, Enter — Aufgaben-Tab aktiv, Liste gefiltert, `expect(filterfeld).toBeFocused()` (Playwright pierct Shadow-DOM nativ).
- TF2 (e2e, gleiche Spec): nach TF1 ohne Klick ein weiteres Zeichen tippen — das Zeichen erscheint im Filterfeld und der Filter aktualisiert sich.
- TF3 (e2e, gleiche Spec, `viewport: 375x667` analog dem bestehenden 375px-Test): AK1 bei 375px.
- TF4 (e2e, gleiche Spec): Modal per Escape bzw. „Abbrechen" schließen — Fokus liegt auf dem Ausloeser (Toolbar-Button), nicht im Filterfeld.

### Ampel
- Ampel: 🟢
- Begründung: Eindeutige Anforderung, betroffene Dateien und Muster bekannt, ein PR, AKs per e2e pruefbar. Einziges Risiko ist das Fokus-Timing gegen die Modal-Rueckgabe — durch TF1/TF2 abgesichert.

### ❓ Offene Fragen
- (keine)
<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | nein | - | - |
| spec | ja | sonnet | medium |
| impl | ja | sonnet | medium |
| review | ja | sonnet | medium |
<!-- ai-phase-routing:END -->
