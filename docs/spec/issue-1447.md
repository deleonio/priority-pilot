# Dashboard-Signal-Panel: Bearbeiten-Button neben „Erledigen"

**Stand:** 2026-09-13

Die Card „Nächste Aufgabe" (`Dashboard.tsx:216-243`) zeigt aktuell nur den Button „Erledigen“. Es fehlt
ein Zugang zum bestehenden Bearbeiten-Dialog (`TaskFormModal`, verdrahtet über `App.tsx:559`
`openEdit`), wie er in der Aufgabenliste bereits existiert (`TaskTree.tsx:212-223`).

## Vertrag `Dashboard`

- Neue Prop `onEditTask?: (task: Task) => void`.
- Im Panel „Nächste Aufgabe" (`.dashboard-next-task-content`) rendert bei gesetztem `nextTask` **und**
  gesetztem `onEditTask` zusätzlich zum „Erledigen"-Button (der zuerst im DOM bleibt) ein zweiter
  `KolButton`:
  - `_label="Bearbeiten"`, `_hideLabel={true}` (Icon-only, analog zum bestehenden Präzedenzfall
    `TaskTree.tsx:212-223` — KI-UX-Entscheidung im Harness-Kommentar zu #1447 überschreibt die
    ursprüngliche Analyse-Annahme einer sichtbaren Beschriftung).
  - `_icons={{ left: { icon: 'fa-solid fa-pen' } }}`.
  - `_variant="secondary"` (die Signalfarbe bleibt „Erledigen" vorbehalten, ux-design.md §1).
  - Klick ruft `onEditTask(nextTask)` mit exakt der angezeigten nächsten Aufgabe.
- Ist `nextTask === null` oder `onEditTask` nicht gesetzt, erscheint kein Bearbeiten-Button (wie beim
  „Erledigen"-Button, AK3).

## Verdrahtung `App.tsx`

- `Dashboard` erhält `onEditTask={openEdit}` (dieselbe Funktion, die auch `TaskTree`s
  „Bearbeiten"-Aktion nutzt) — öffnet `TaskFormModal` vorausgefüllt mit der übergebenen Aufgabe.

## Nutzersicht

1. Panel „Nächste Aufgabe" zeigt bei vorhandener Aufgabe „Erledigen" und daneben (danach im DOM,
   Tab-Reihenfolge folgt der visuellen Priorität) „Bearbeiten" (Icon-only, Stift-Symbol).
2. Klick auf „Bearbeiten" öffnet den bestehenden Bearbeiten-Dialog, vorausgefüllt mit Titel und
   Priorität der angezeigten nächsten Aufgabe.
3. Ist keine nächste Aufgabe vorhanden, erscheint kein Bearbeiten-Button.

## Layout (mobile-first, 375px)

- Beide Buttons bleiben bei 375px Breite vollständig sichtbar und einzeln antippbar (Touch-Target
  ≥44px, ≥8dp Abstand, `docs/mobile-ui-rules.md:23-24,44-47`), ohne horizontalen Overflow.
