---
CTA Buttons sollen immer mit Strg + Enter abgesendet werden.

<!-- KI-ANALYSE:START stand=2026-07-03T18:28:52Z -->
## KI-Analyse - Loesungsvorschlag

**Umsetzbarkeit:** Klar umsetzbar - Anforderung eindeutig, betroffene Dateien identifiziert, in einem PR machbar, pruefbare Akzeptanzkriterien liegen vor.

### Kontext und Loesungsweg

Alle Modalformulare des Projekts nutzen KolButton-Komponenten mit einem onClick-Handler statt nativem type="submit". Das bedeutet: die Browser-Standardauswertung von Enter/Strg+Enter greift hier nicht automatisch. Ein gemeinsamer React-Hook (useCtrlEnter) soll auf Window-Ebene auf das keydown-Event lauschen und - sofern das Modal geoeffnet und der Button nicht deaktiviert ist - den Submit-Callback ausloesen.

**Betroffene Dateien (Primaere CTA-Buttons):**

| Datei | Submit-Funktion |
|---|---|
| frontend/src/components/TaskForm.tsx | submit() (Zeile 185/478) |
| frontend/src/components/QuickCaptureModal.tsx | process() (Zeile 68/114) |
| frontend/src/components/SeriesFormModal.tsx | submit() (Zeile 51/156) |
| frontend/src/components/DeleteTaskDialog.tsx | Loeschen-Callback (Zeile 47) |
| frontend/src/components/DependencyModal.tsx | Speichern (Zeilen 102, 147) |
| frontend/src/components/PillarWeightsModal.tsx | Speichern (Zeile 132) |
| frontend/src/components/LoginPage.tsx | Hat nativen form-Submit - Enter reicht bereits, Strg+Enter als zusaetzliche Option |

**Implementierungsplan:**

1. Neuen Hook frontend/src/lib/useCtrlEnter.ts anlegen - fuegt einen keydown-Listener auf window ein, der bei e.ctrlKey && e.key === 'Enter' && !disabled feuert und e.preventDefault() aufruft.

2. Den Hook in alle sieben Komponenten einbinden (jeweils mit dem saving/busy/deleting-Flag als disabled-Argument).

3. QuickCaptureModal: Im Schritt 'capture' loest Strg+Enter process() aus (nur wenn hasText && !parsing); im Schritt 'form' delegiert es an TaskForm, die ihren eigenen Hook verwendet.

**Scope-Hinweis:** Da der Listener auf window liegt, muss er im useEffect-Cleanup zuverlaessig entfernt werden. Da immer nur ein Modal gleichzeitig offen ist, entsteht kein Listener-Konflikt.

### Akzeptanzkriterien und Testfaelle

**AK1 - TaskForm: Strg+Enter loest Speichern aus**
- Given: TaskFormModal ist offen, Formular ausgefuellt, kein laufender Speichervorgang
- When: Nutzer drueckt Strg+Enter
- Then: submit() wird aufgerufen (identisch mit Klick auf primaeren CTA-Button)
- Test: Vitest-Unit frontend/src/components/TaskForm.test.tsx - fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true }) -> Submit-Spy wird einmal aufgerufen

**AK2 - Shortcut deaktiviert waehrend Speichervorgang**
- Given: Speichervorgang laeuft (saving === true)
- When: Nutzer drueckt Strg+Enter
- Then: kein zzeiter Submit ausgeloest
- Test: gleiche Datei, disabled={true} -> Spy wird nicht aufgerufen

**AK3 - QuickCaptureModal (Capture-Schritt): Strg+Enter verarbeitet Text**
- Given: QuickCaptureModal offen, Text eingegeben, kein laufender Parse-Vorgang
- When: Nutzer drueckt Strg+Enter
- Then: process() wird aufgerufen
- Test: Vitest-Unit frontend/src/components/QuickCaptureModal.test.tsx

**AK4 - SeriesFormModal / DeleteTaskDialog / DependencyModal / PillarWeightsModal**
- Analoges Verhalten: Strg+Enter loest jeweils den primaeren CTA aus, solange dieser nicht deaktiviert ist
- Test: Vitest-Unit je Komponente

**AK5 - E2E: Strg+Enter legt Task an**
- Given: Neuen-Task-Dialog offen, Pflichtfeld Titel ausgefuellt (TaskForm-Schritt)
- When: Nutzer drueckt Strg+Enter
- Then: Task wird gespeichert, Modal schliesst sich
- Test: Playwright-E2E frontend/e2e/crud.spec.ts (neuer Testblock)

**AK6 - Mobile-First**
- Die Tastenkombination ist Desktop-relevant; auf Touch-Geraeten ohne Hardware-Tastatur entfaellt der Shortcut-Test - kein separates Mobile-AK erforderlich. Vorhandenes Layout wird nicht beruehrt.

### Testebene und Zieldateien

| AK | Ebene | Datei |
|---|---|---|
| AK-AK-4| Vitest-Unit | frontend/src/components/*.test.tsx |
| AK5 | Playwright-E2E | frontend/e2e/crud.spec.ts |

### Empfohlene Umsetzungsreihenfolge

1. useCtrlEnter-Hook schreiben + Unit-testen
2. Hook in alle Modalkomponenten einbinden
3. E2E-Test erweitern
<!-- KI-ANALYSE:END -->
---
