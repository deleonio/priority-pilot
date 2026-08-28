# Spec #1072 — Deadline-Felder als logische Gruppe, Adresse als letztes Feld

## Ziel

Im Aufgaben-Formular (TaskForm, Anlegen und Bearbeiten) sind die beiden Deadline-Felder
visuell als eine logische Gruppe dargestellt, und die Adresse-Eingabe folgt erst danach
als letztes Feld dieser Gruppe.

## Ausgangslage (IST)

Im `form-grid` von `frontend/src/components/TaskForm.tsx` gilt heute:
`KolInputDate` „Deadline (optional)" → `KolCombobox` „Adresse (optional)" →
`KolInputCheckbox` „Automatisch löschen nach 3 Tagen bei verpasster Deadline"
(Klasse `auto-delete-toggle`) → bedingter `KolAlert`. Das Adressfeld trennt damit die
beiden Deadline-Felder.

## Soll-Verhalten

1. **Gruppen-Container:** Deadline-Datum und Auto-Löschen-Schalter (sowie der bedingte
   Info-Alert zum Schalter) liegen in einem eigenen Gruppen-Container, der per
   `data-testid="deadline-group"` greifbar ist und sie visuell von den übrigen Feldern
   absetzt. Die Adresse ist **nicht** Teil der Gruppe.
2. **Reihenfolge (Task-Modus):** Deadline-Datum → Auto-Löschen-Schalter → Adresse.
   Zwischen den beiden Deadline-Feldern liegt kein weiteres Formularfeld.
3. **Serie-Modus:** dieselbe Gruppierung — Startdatum/Rhythmus und Schalter gehören zur
   Gruppe, die Adresse folgt danach (die Felder werden von beiden Modi geteilt).
4. **Mobile (375px):** Gruppierung und Reihenfolge bleiben bei 375px Viewport-Breite
   erhalten; kein Feld wird horizontal abgeschnitten.

### Gestaltung (KI-UX-Beratung, advisory)

- Gruppierung über **Abstand + Gruppen-Bezeichnung** (Muster `.pillar-editor` /
  `.pillar-editor-label`, `frontend/src/app.css:1106`) statt Rahmen/Cards
  (docs/mobile-ui-rules.md Regel 4).
- DOM-Reihenfolge = visuelle Reihenfolge; keine ARIA-`order`-Tricks.
- Spacing aus der Fixskala (Gap 0.75rem wie `.pillar-editor`, keine neuen Hardcodes).

## Schritte (Testablauf)

1. App öffnen, „Neuen Task anlegen", Quick-Capture mit „Überspringen" abschließen
   → Anlegeformular sichtbar.
2. Task-Modus: Gruppen-Container, Deadline-Datum, Schalter und Adresse lokalisieren.
3. Umschalten auf Serie (Switch `data-testid="mode-switch"`) → Prüfung wiederholen.
4. Viewport 375x812 → Reihenfolge + Bounding-Boxes messen.

## Erwartetes Ergebnis

- AK1: Gruppen-Container sichtbar, enthält genau Deadline-Datum + Schalter, nicht die Adresse.
- AK2: `deadline.y < toggle.y < address.y` (Bildschirm- und DOM-Reihenfolge).
- AK3: Adresse nach der gesamten Deadline-Gruppe; im Serie-Modus ebenso (nach Startdatum/Rhythmus + Schalter).
- AK4: Bei 375px: AK2-Reihenfolge gilt, und für alle drei Felder gilt
  `x ≥ 0 && x + width ≤ 375` (Bounding-Box statt `scrollWidth` — die App-Shell clippt `overflow-x`).

## Testabdeckung

- `frontend/e2e/issue-1072-deadline-group.spec.ts` — TF1 (AK1), TF2 (AK2/AK3),
  TF2-Serie (AK3), TF3 (AK4, 375x812).

## Abgrenzung

- Keine Funktionsänderung: Label, Verhalten der Kopplung „Schalter deaktiviert ohne
  Deadline" (#534) und Speicherlogik bleiben unverändert.
- Formularteile nach der Adresse (Beschreibung, Säulen, Checkliste) bleiben unverändert.
