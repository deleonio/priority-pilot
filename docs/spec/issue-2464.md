# Spec #2464 — Serien-Formular: „Automatisch anlegen“ als erste Option vor dem Startdatum

## Ziel

Im Serie-Modus des TaskForm (Akkordeon „Termin & Ort“, `deadline-group`) ist der Schalter
„Automatisch anlegen“ das erste Element des Termin-Abschnitts. Startdatum, Rhythmus und
Auto-Löschen erscheinen erst darunter (Master-Entscheidung vor ihren Folgen).

## Voraussetzung

- Angemeldeter Nutzer, Task-Anlegeformular geöffnet (QuickCapture übersprungen), Serie-Modus aktiv.

## Schritte / Erwartetes Ergebnis

1. Serie-Modus aktivieren → Schalter „Automatisch anlegen“ sichtbar, y-Position über dem
   Startdatum-Feld (AK1). Reihenfolge im DOM = visuelle Reihenfolge.
2. Schalter ausschalten → Startdatum und Rhythmus verschwinden (#2414-Sichtbarkeitskopplung,
   unverändert); einschalten → beide erscheinen wieder unterhalb des Schalters, Reihenfolge
   Schalter → Startdatum → Rhythmus (AK2).
3. 375px Viewport → Reihenfolge erhalten, kein Feld horizontal abgeschnitten (Bounding-Box-Messung,
   nicht `scrollWidth` — App-Shell clippt `overflow-x: hidden`) (AK3).
4. Task-Modus (Deadline + Reset-Button) und Vorlage-Flow (#2361) bleiben unverändert (AK4) —
   Regression wird durch die bestehenden Suites
   `issue-2414-series-template-fields.spec.ts`, `issue-2361-task-as-template.spec.ts`,
   `issue-1072-deadline-group.spec.ts`, `series-in-taskform.spec.ts` abgesichert; kein neuer Test.

## Messung

Y-Vergleich über `boundingBox()` (Vorlage `issue-1072-deadline-group.spec.ts:77–96`);
Sichtbarkeit über Accessibility-Baum.

## Umsetzungshinweis (nicht testgetragen)

Reine JSX-Verschiebung des Schalter-Blocks (TaskForm.tsx, Serie-Zweig); Sichtbarkeitsbedingungen
(`rhythm !== 'none'` / `autoCreate`) unverändert. JSX-Kommentar „#2358: Schalter vor dem
Rhythmus“ mitziehen/neu formulieren.
