# Spec #1346 — Task-ID grau im Bearbeiten-Modal und in Dialogen anzeigen

**Issue:** #1346 · **Stand:** 2026-09-10 (Spec-Phase) · **Vertragstyp:** Anzeige-Vertrag (Frontend)

## Ziel

Beim Bearbeiten eines Tasks/einer Serie sowie in den Bestätigungsdialogen (Löschen, Erledigen) ist heute nicht erkennbar, welche ID die betroffene Aufgabe/Serie hat. Künftig steht die ID am Ende des Bearbeiten-Modal-Titels (`(#<id>)`, normale Titelfarbe — `KolDialog`s `_label` ist ein reiner String ohne Header-Slot) und in den drei Bestätigungsdialogen im Fließtext, dort in `var(--pp-ink-muted, #525b6a)`. Die Anlege-Titel bleiben unverändert (keine ID vorhanden). Schreibweise überall einheitlich `#<id>` statt `ID <id>`.

## Feste Annahmen (vom Autor entschieden, Kommentar 2026-09-10T08:34:57Z)

1. Modal-Titel-ID **ohne** Graufärbung (technische Grenze von `KolDialog`).
2. Auch `DeleteSeriesDialog` zeigt künftig die Serien-ID (bisher keine).
3. Einheitlich `#<id>` statt `ID <id>` in allen Dialogen.

## Verhalten je Akzeptanzkriterium

### AK1 — `taskFormModalTitle` hängt die ID beim Bearbeiten an

**Voraussetzung:** `task !== null`.
**Schritte:** `taskFormModalTitle(task, null, 'task')` bzw. `taskFormModalTitle(task, null, 'series')`.
**Erwartetes Ergebnis:** `Aufgabe bearbeiten: <title> (#<id>)` bzw. `Serie bearbeiten: <title> (#<id>)`.

### AK2 — Anlege-/Unteraufgaben-Titel bleiben unverändert

**Voraussetzung:** `task === null`.
**Schritte:** `taskFormModalTitle(null, null, 'task'|'series'|undefined)`, `taskFormModalTitle(null, parentTask, 'task')`.
**Erwartetes Ergebnis:** `Aufgabe anlegen`, `Serie anlegen`, `Neuen Task anlegen`, `Unteraufgabe zu #<id> – <title>` — keine zusätzliche ID.

### AK3 — Serien-Bearbeiten-Modal (`SeriesTab.tsx:238`) zeigt die ID

**Voraussetzung:** Eigene Serie, Toolbar mit „Bearbeiten“ sichtbar.
**Schritte:** Klick auf „Bearbeiten“.
**Erwartetes Ergebnis:** Modal-Titel lautet `Serie bearbeiten: <title> (#<id>)`.

### AK4 — `DeleteTaskDialog` nennt die ID in muted Farbe

**Voraussetzung:** Dialog offen für einen Task.
**Erwartetes Ergebnis:** Body enthält `#<id>` (nicht mehr `ID <id>`); das ID-Element trägt `style.color` mit `--pp-ink-muted`, der übrige Fragetext nicht.

### AK5 — `CompleteTaskDialog` nennt die ID in muted Farbe

**Voraussetzung:** Dialog offen für einen Task.
**Erwartetes Ergebnis:** Analog AK4 für den Erledigen-Dialog.

### AK6 — `DeleteSeriesDialog` nennt die Serien-ID in muted Farbe (neu)

**Voraussetzung:** Dialog offen für eine Serie.
**Erwartetes Ergebnis:** Body enthält `#<id>` in muted Farbe; bestehende Button-/Fokus-/Hotkey-Erwartungen bleiben unverändert grün.

### AK7 — Kein horizontaler Überlauf bei 375px

**Voraussetzung:** Viewport 375×812, Task angelegt.
**Schritte:** Bearbeiten-Dialog öffnen.
**Erwartetes Ergebnis:** Bounding-Box des Dialogs liegt innerhalb der Viewport-Breite, Titel inkl. `(#<id>)` ist sichtbar; Löschen-Dialog zeigt `(#<id>)`.

## Testfälle → Datei-Zuordnung

| TF  | AK  | Datei                                                                           |
| --- | --- | ------------------------------------------------------------------------------- |
| TF1 | AK1 | `frontend/src/lib/task.test.ts`                                                 |
| TF2 | AK2 | `frontend/src/lib/task.test.ts` (bestehende Regressionstests, unverändert grün) |
| TF3 | AK3 | `frontend/src/components/SeriesTab.test.tsx`                                    |
| TF4 | AK4 | `frontend/src/components/DeleteTaskDialog.test.tsx`                             |
| TF5 | AK5 | `frontend/src/components/CompleteTaskDialog.test.tsx` (neu)                     |
| TF6 | AK6 | `frontend/src/components/DeleteSeriesDialog.test.tsx`                           |
| TF7 | AK7 | `frontend/e2e/issue-1346-task-id.spec.ts` (neu)                                 |
