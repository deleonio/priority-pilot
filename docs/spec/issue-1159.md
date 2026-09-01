# Spec #1159 — Layout-Optimierung Aufgaben-Formular (TaskForm)

Quellen: Issue #1159, KI-ANALYSE-Block (Harness-Kommentar, stand 2026-09-01T23:32:38Z), KI-UX-Block desselben Kommentars.

## Ziel

Das Task-Anlegeformular (`frontend/src/components/TaskForm.tsx`) erhält eine klare
Dreier-Hierarchie — Pflichtfelder → Deadline/Rhythmus + Adresse → Optional-Bereich —
mit einheitlichen Abständen innerhalb und größeren Abständen zwischen den Gruppen.
Mobile (<768px) bleibt unverhalten, nur ab 768px wird umstrukturiert.

## Vertrag (Struktur)

Das Formular wird in drei Opt-in-Wrapper gegliedert (`.form-grid` selbst wird NICHT
global umgestylt — sieben Formulare teilen sich die Klasse, QuickCaptureModal bleibt
bewusst kompakt und ohne diese Wrapper):

1. **`.form-section--primary`** — Titel (`[data-testid="task-title"]`),
   Priorität + Aufwand (`.range-inputs-row`).
2. **`.form-section--secondary`** — die bestehende `.deadline-group`
   (`[data-testid="deadline-group"]`) und das Adressfeld (`Adresse (optional)`).
3. **`.form-section--optional`** — Säulen-Editor (`.pillar-editor`), Beschreibung
   (`[data-testid="task-description"]`), Checklisten-Editor
   (`[data-testid="checklist-section"]`).

Jede Gruppe ist programmatisch gruppiert (UX-Block, WCAG 1.4.1): `fieldset`+`legend`
oder `role="group"`/`section` mit `aria-labelledby` und sichtbarer Gruppenüberschrift.
Die Optional-Gruppe trägt ihre Kennzeichnung zusätzlich textualisiert (bestehende
„… (optional)"-Labels/Überschriften reichen, solange sie in der Gruppe liegen).

## Akzeptanzkriterien → erwartetes Verhalten

- **AK1:** `.form-section--primary` existiert, enthält Titel + Priorität + Aufwand,
  und trägt eine durchgehende Fläche oder einen Rahmen (`background-color` ≠
  transparent ODER `border-width` > 0, per `getComputedStyle`).
- **AK2:** `.form-section--secondary` existiert, enthält `.deadline-group` + Adresse,
  trägt ebenfalls Fläche/Rahmen und unterscheidet sich optisch von Gruppe 1
  (unterschiedliche `background-color` ODER unterschiedlicher Rahmen).
- **AK3:** `.form-section--optional` existiert (Säulen + Beschreibung + Checkliste),
  hat KEINE eigene Fläche (`background-color: transparent`), und der vertikale
  Abstand zwischen Gruppe 2 und Optional-Bereich ist größer als der maximale
  Abstand innerhalb der Gruppen.
- **AK4:** Bei 1280px haben Titel und die Felder der `.range-inputs-row` dieselbe
  Top-Kante (Vertikalversatz ≤ 2px) — gemeinsames Grid mit `align-items: start`,
  kein V-Spring durch unterschiedliche Label-Längen.
- **AK5:** Bei exakt 768px ist der vertikale Abstand zwischen Primär- und
  Sekundärgruppe größer als der maximale vertikale Abstand innerhalb einer Gruppe.
- **AK6:** Bei 375px bleiben alle Felder voll nutzbar untereinander gestapelt, kein
  Feld wird horizontal abgeschnitten (Bounding-Box innerhalb des Viewports; die
  App-Shell clippt `overflow-x: hidden`, daher Bounding-Box statt `scrollWidth`).

## Voraussetzungen / Randbedingungen

- Geteilte Klassen (`.form-grid`, `.pillar-editor-loading`) wirken auch auf
  QuickCaptureModal — dort darf nichts brechen (keine globalen Restyles).
- `frontend/e2e/series-in-taskform.spec.ts` und
  `frontend/e2e/issue-1072-deadline-group.spec.ts` bleiben grün (Regression).
- Abstände aus bestehenden Gap-Tokens (`--pp-gap-base` innerhalb,
  `--pp-gap-generous` zwischen Gruppen); keine neuen freien Hex-Werte, keine
  Signal-/Brandfarbe für die Pflichtgruppe (KI-UX-Block).
- DOM-Reihenfolge, Fokusreihenfolge und Feldverhalten bleiben unverändert.

## Testfälle

`frontend/e2e/issue-1159-taskform-layout.spec.ts` (rot bis zur Implementierung —
die `.form-section--*`-Wrapper existieren noch nicht):

- AK1–AK3: Struktur- + `getComputedStyle`-Assertions der drei Gruppen bei 1280px.
- AK4: `boundingBox()`-Top-Kanten-Vergleich in der Primärgruppe bei 1280px.
- AK5: `boundingBox()`-Abstandsmessung Gruppenabstand vs. In-Gruppen-Abstand bei 768px.
- AK6: Sichtbarkeit + Bounding-Box-in-Viewport-Prüfung aller Felder bei 375px.
