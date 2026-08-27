# Issue 1072 — UX-Phase

## Erledigt
- KI-UX-Block in den Issue-Body geschrieben (gh issue edit --body-file), Verdict ux-ready.
- Ist-Zustand verifiziert: TaskForm.tsx — KolInputDate „Deadline (optional)" (~:873), KolCombobox „Adresse (optional)" (~:894), KolInputCheckbox `auto-delete-toggle` (~:917), bedingter KolAlert (~:929) — Reihenfolge im form-grid bestätigt, Adresse trennt die Deadline-Felder.
- Gruppen-Pattern gelesen: app.css:1106 `.pillar-editor` (grid, gap 0.75rem, margin-bottom 1rem) mit `.pillar-editor-label` (font-weight 600); app.css:1770 `.checklist-editor` analog.

## Relevante Stellen
- frontend/src/components/TaskForm.tsx:873-935 — zu gruppierende Felder + Adresse; Serie-Modus-Zweig darüber (~:850-870) teilt Adresse/Schalter.
- frontend/src/app.css:1106/.1770 — etablierte Gruppen-Container als Vorbild für `.deadline-group`.

## Annahmen
- Serien-Modus: gleiche Gruppierung sinnvoll (Startdatum/Rhythmus + Schalter vor Adresse) — Analyse leitet das bereits vor.

## Verworfen
- Rahmengruppierung (`border` à la `.pillar-row`) als Empfehlung: docs/mobile-ui-rules.md Regel 4 verlangt Gruppierung durch Überschriften/Abstand, nicht Rahmen — kein hartes Verbot im Formularkontext, aber Abstand+Label ist der konsistentere Weg.

## Offen
- keine — damit ux-ready (advisory, keine Blocker).

## Nächster Schritt
- Spec-Phase: AKs aus dem KI-UX-Block + Analyse-Block (TF1-TF3) übernehmen.

## Fallstricke
- KoliBri-Hosts block-level, 100% Breite (Memory 08-24): in Grid-/Flex-Zeilen Breiten explizit teilen; 375px per Bounding-Box prüfen, nicht scrollWidth (App-Shell clippt overflow-x).
- Checkbox-Label wirklich „Automatisch löschen nach 3 Tagen…" (nicht wie im Issue „Aufgaben nach Deadline löschen").
