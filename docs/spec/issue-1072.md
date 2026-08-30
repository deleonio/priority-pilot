# Deadline-Felder als logische Gruppe, Adresse als letztes Feld

**Stand:** 2026-08-30

Im Aufgaben-Formular (TaskForm, Anlegen und Bearbeiten) sind die Deadline-Felder visuell als eine logische Gruppe dargestellt, und die Adresse-Eingabe folgt erst danach als letztes Feld dieser Gruppe.

## Verhalten

1. **Gruppen-Container:** Deadline-Datum und Auto-Löschen-Schalter („Automatisch löschen nach 3 Tagen bei verpasster Deadline", samt dem bedingten Info-Alert zum Schalter) liegen in einem eigenen Gruppen-Container (`data-testid="deadline-group"`), der sie visuell von den übrigen Feldern absetzt. Die Adresse ist **nicht** Teil der Gruppe.
2. **Reihenfolge (Task-Modus):** Deadline-Datum → Auto-Löschen-Schalter → Adresse. Zwischen den beiden Deadline-Feldern liegt kein weiteres Formularfeld.
3. **Serie-Modus:** dieselbe Gruppierung — Startdatum und Rhythmus stehen gemeinsam mit dem Auto-Löschen-Schalter in der Gruppe, die Adresse folgt danach (die Felder werden von beiden Modi geteilt).
4. **Mobile (375px):** Gruppierung und Reihenfolge bleiben erhalten; kein Feld wird horizontal abgeschnitten.

### Gestaltung

- Gruppierung über **Abstand + Gruppen-Bezeichnung** (Muster `.pillar-editor` / `.pillar-editor-label`), nicht über Rahmen oder Cards.
- DOM-Reihenfolge = visuelle Reihenfolge; keine ARIA-`order`-Tricks.
- Abstände aus der Fixskala des Design-Systems (Gap 0.75rem wie `.pillar-editor`).

## Erwartetes Ergebnis

- Der Gruppen-Container enthält genau Deadline-Datum und Auto-Löschen-Schalter, nicht die Adresse.
- Bildschirm- und DOM-Reihenfolge: Deadline-Datum über Schalter über Adresse; im Serie-Modus Startdatum/Rhythmus + Schalter, danach die Adresse.
- Die Kopplung „Schalter deaktiviert ohne Deadline" und die Speicherlogik sind von der Gruppierung unberührt; Formularteile nach der Adresse (Beschreibung, Säulen, Checkliste) bleiben unverändert.
