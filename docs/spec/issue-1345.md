# Issue 1345 — Oberaufgaben-Schalter in der Aufgabenliste

## Ziel

Ein dritter Ansichtsschalter "Oberaufgaben anzeigen" (default aus) blendet in der Aufgabenliste
(Tab "Aufgaben") zusätzlich zu den Blatt-Aufgaben jene Oberaufgaben ein, die mindestens eine
offene Unteraufgabe haben. Eingeblendete Oberaufgaben tragen ihr Fortschritts-Badge, sind gemeinsam
mit den Blättern sortiert, und ihr Erledigt-Knopf ist deaktiviert und begründet — die übrigen
Aktionen (Bearbeiten, Abhängigkeiten, Unteraufgabe anlegen, Löschen) bleiben aktiv.

## Vorbedingung

- Aufgabenwald (`GET /forest`) mit mindestens einer Aufgabe, die offene Unteraufgaben hat.
- Tab "Aufgaben" ist aktiv (`taskViewMode === 'open'`).

## Schritte / Vertrag

1. `extractLeaves(forest, { includeParents: false })` (oder ohne zweites Argument) verhält sich
   unverändert: nur Blätter (`dependents.length === 0`), sortiert nach `value` absteigend.
2. `extractLeaves(forest, { includeParents: true })` liefert zusätzlich alle Knoten mit
   `dependents.length > 0` im **ungefilterten** Wald, gemeinsam mit den Blättern nach `value`
   absteigend sortiert (ein Durchgang, keine zwei Listen aneinandergehängt). Keine Duplikate.
3. In `App.tsx` steht in `.task-filter-switches` ein dritter Schalter "Oberaufgaben anzeigen",
   initial aus, reiner React-State (kein `localStorage`, kein URL-Parameter).
4. In `TaskTree`/`LeafItem` ist der Erledigt-Knopf für eine eingeblendete Oberaufgabe mit offener
   Unteraufgabe deaktiviert, Label "Erledigt (Unteraufgaben offen)"; Klick löst `onDoneToggle`
   nicht aus. Eine Aufgabe ohne offene Unteraufgaben (auch mit Fortschritts-Badge wie 5/5) bleibt
   aktiv mit Label "Erledigt".
5. Titel-/Kategorie-Filter (`filterForest`) wirkt auf eingeblendete Oberaufgaben nach derselben
   Regel wie auf Blätter; Guard und Badge richten sich unabhängig vom Filter nach dem
   ungefilterten Wald.
6. Mobile (375px): Schalterleiste bricht um, kein Element ragt über die Viewportbreite hinaus.

## Erwartetes Ergebnis

Siehe Akzeptanzkriterien AK1–AK12 im Harness-Marker-Kommentar von Issue #1345
(stand=2026-09-11T20:02:34Z).
