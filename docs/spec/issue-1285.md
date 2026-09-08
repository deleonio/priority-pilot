# Spec #1285 — TaskForm-Sektionen als Accordion-Behälter ohne Kartenfläche

## Ziel

Die drei TaskForm-Sektionen „Basisangaben", „Termin & Ort" und „Optional" sind einheitlich
KolAccordion-Behälter ohne Karten-Hintergrund und -Rahmen. „Basisangaben" ist dauerhaft
aufgeklappt und nicht einklappbar; die beiden Opt-in-Sektionen starten geschlossen (auch im
Bearbeiten-Modus) und bleiben per Trigger umschaltbar.

## Vorbedingungen

- TaskForm (Anlegen und Bearbeiten, Task und Serie) sowie QuickCaptureModal (teilt denselben
  Body) sind geöffnet.
- `.form-grid` und die sieben teilenden Formulare bleiben unangetastet.
- Der #1260-Standard „Bearbeiten mit gefüllten Werten startet Abschnitt offen" (TaskForm.tsx
  :363–371) wird bewusst ersetzt.

## Verhalten

1. **AK1 — Einheitlicher Behältertyp:** Jede der drei Sektionen ist ein KolAccordion. Die
   Karten-Regeln in `app.css` (`--primary`: background/border/radius; `--secondary`:
   background/radius) sind entfernt — keine Sektion hat Surface (Hintergrundfarbe oder Rahmen).
2. **AK2 — Basisangaben dauerhaft offen:** Das Accordion „Basisangaben" startet mit
   `_open={true}`; der Trigger ist `_disabled` — Klick UND Tastatur klappen ihn nicht zu,
   der Inhalt bleibt ohne Interaktion sichtbar. (KI-UX: `_disabled` lässt den Trigger alle
   Events ignorieren; nicht interaktiv, aber lesbar.)
3. **AK3 — Opt-in-Sektionen starten zu:** „Termin & Ort" und „Optional" sind beim Öffnen des
   Formulars zugeklappt — einheitlich für Anlegen und Bearbeiten, Task und Serie. Die
   #1260-Vorbelegung „Edit mit gefüllten Werten startet offen" entfällt. Bewusster Trade-off
   (KI-UX advisory): Füllstand ist erst nach Aufklappen sichtbar.
4. **AK4 — Umschaltbar:** „Termin & Ort" und „Optional" bleiben per Trigger aus-/einklappbar
   (kontrolliertes `_open`/`_on.onClick` wie bisher).
5. **AK5 — Mobile 375 px:** Die drei Accordions stehen untereinander in voller Breite ohne
   horizontalen Overflow (Bounding-Box-Check, da die App-Shell `overflow-x: hidden` clippt).
   Gruppierung ohne Kartenfläche über Abstand (KI-UX: Gruppenabstand `--pp-gap-generous`).

## A11y-Vertrag (aus KI-UX-Block)

- Alle drei Abschnitte als `_level={3}`-Accordion-Headings unter dem Dialogtitel — die separate
  `.form-section-heading`-Überschrift entfällt, keine Überschriftenebene wird übersprungen.
- Fokusreihenfolge unangetastet; kein fokussierbares totes Element (disabled Trigger ist nicht
  fokussierbar).

## Testfälle

| TF  | Ebene  | Datei                                                             | deckt    |
| --- | ------ | ----------------------------------------------------------------- | -------- |
| TF1 | Vitest | `frontend/src/components/TaskForm.test.tsx`                       | AK1, AK2 |
| TF2 | Vitest | `frontend/src/components/TaskForm.test.tsx`                       | AK3      |
| TF3 | Vitest | `frontend/src/components/TaskForm.test.tsx`                       | AK4      |
| TF4 | e2e    | `frontend/e2e/issue-1159-taskform-layout.spec.ts` (umgeschrieben) | AK1–AK4  |
| TF5 | e2e    | `frontend/e2e/issue-1159-taskform-layout.spec.ts`                 | AK5      |

- TF1: Basisangaben-Accordion existiert und ist offen; Klick auf den Trigger ändert den
  Zustand nicht (Unit-Mock um `_disabled` erweitert — Mock unterdrückt onClick bei disabled
  wie die echte KoliBri-Komponente).
- TF2: Anlegen und Bearbeiten (Task mit Deadline, Serie mit Startdatum, Task mit Checkliste) —
  beide Opt-in-Sektionen starten zugeklappt. Ersetzt die #1260-AK4-Fälle (Test-Pflege-Bedarf).
- TF3: Klick auf „Termin & Ort" bzw. „Optional" klappt auf und wieder zu.
- TF4: Keine der Sektionen primary/secondary hat Surface; Basisangaben-Inhalt ohne Klick
  sichtbar und per Tastatur nicht zuklappbar; Termin & Ort / Optional erst nach Trigger-Klick
  sichtbar und wieder schließbar.
- TF5: 375 px — Accordions untereinander (keine vertikale Überlappung), volle Breite, Felder
  innerhalb des Viewports.

## Reine CSS-Angelegenheit

Der Surface-Entzug selbst (app.css :1078/:1089) ist Layout — absichert über TF4 (getComputedStyle
im echten Browser). Die Unit-Tests prüfen Struktur/Verhalten, nicht CSS.
