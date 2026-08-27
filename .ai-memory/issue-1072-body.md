## Was ist das Problem?
Aktuell sind die Deadline-Felder (Deadline-Datum und Checkbox „Aufgaben nach Deadline löschen") nicht visuell gruppiert. Stattdessen folgt nach dem Deadline-Datum direkt das Adressfeld, und erst danach kommt die Checkbox. Dies erschwert die Erkennbarkeit des Zusammenhangs zwischen den beiden Deadline-bezogenen Feldern.

## Wie soll es sein?
Die beiden Deadline-Formularfelder (Deadline-Datum und Checkbox „Aufgaben nach Deadline löschen") sollen als logische Gruppe untereinander dargestellt werden. Die Adress-Eingabe soll als letztes Feld folgen, also nach der gesamten Deadline-Gruppe.

## Wo tritt es auf?
Aufgaben-Formular (Task Creation/Edit Form) in der Priority Pilot Anwendung.

## Woran messen wir das?
- Die beiden Deadline-Felder sind visuell gruppiert (z.B. durch Rahmen, Überschrift oder Abstände)
- Die Adress-Eingabe erscheint als letztes Feld im Formular
- Die Checkbox „Aufgaben nach Deadline löschen" ist direkt unter dem Deadline-Datum platziert

---

**IST:**
<img width="694" height="251" alt="Image" src="https://github.com/user-attachments/assets/69844f88-a793-4927-aded-c6ec2e8b1a6c" />

Aktuell folgt auf Deadline, Adresse und dann kommt die Checkbox ob man nach Deadline die Aufgaben löschen möchte.

**Soll:**
Die beiden Deadline Form-Fields sollen gruppiert untereinander dargestellt werden und die Adresse-Eingabe folgt darauf als letztes.

<!-- KI-ANALYSE:START stand=2026-08-27T20:15:04Z -->
### Umsetzungskontext
- Betroffene Dateien: `frontend/src/components/TaskForm.tsx`, `frontend/src/app.css`
- Betroffene Komponenten: `TaskForm` — im `form-grid` gilt heute die Reihenfolge `KolInputDate` „Deadline (optional)" (TaskForm.tsx:873) → `KolCombobox` „Adresse (optional)" (TaskForm.tsx:894) → `KolInputCheckbox` „Automatisch löschen nach 3 Tagen bei verpasster Deadline", Klasse `auto-delete-toggle` (TaskForm.tsx:917) → bedingtes `KolAlert` (TaskForm.tsx:929). Die beiden Deadline-Felder sind also durch das Adressfeld getrennt.
- Vorhandenes Muster: `.pillar-editor` (TaskForm.tsx:1001, app.css:1106) und `.checklist-editor` (TaskForm.tsx:1095, app.css:1770) — etablierte Gruppen-Container (div + Label-Span + Grid-Gap) im selben Formular; analog dafür einen `.deadline-group`-Container einführen.
- Vorgehen: Im `form-grid` die Reihenfolge ändern — Deadline-Datum, Auto-Löschen-Schalter und den bedingten Info-Alert in einen Gruppen-Container (z. B. `div.deadline-group` mit `data-testid`) einschließen und die `KolCombobox` Adresse danach rendern. Visuelle Gruppierung per CSS (Rahmen, Überschrift oder Abstände — das Messkriterium lässt Freiheit). Im Serie-Modus dieselbe Reihenfolge: Startdatum/Rhythmus + Schalter gruppieren, Adresse danach (die Felder werden von beiden Modi geteilt).
- Randbedingungen: Keine Funktionsänderung — nur JSX-Reihenfolge + CSS. Checkbox-Label bleibt unverändert („Automatisch löschen nach 3 Tagen bei verpasster Deadline" — die im Issue „Aufgaben nach Deadline löschen" genannte Checkbox ist dasselbe Feld). Bestehende e2e (`series-in-taskform.spec.ts`, `issue-1061-task-address.spec.ts`, `series.spec.ts`) und `TaskForm.test.tsx` müssen grün bleiben. KoliBri-Hosts sind block-level — bei etwaigen Flex-Zeilen Breiten explizit teilen (bekannte Falle).
- Erwartetes Ergebnis: Im Aufgaben-Formular (Anlegen und Bearbeiten) stehen Deadline-Datum und Auto-Löschen-Schalter direkt untereinander in einer sichtbaren Gruppe; die Adresse-Eingabe folgt als letztes Feld dieser Gruppe.

### Akzeptanzkriterien
- AK1: Deadline-Datum und Auto-Löschen-Schalter sind in einem eigenen Gruppen-Container gerendert (eigene CSS-Klasse, per `data-testid` greifbar), der sie visuell von den übrigen Feldern absetzt.
- AK2: In DOM- und Bildschirm-Reihenfolge gilt: Deadline-Datum vor Auto-Löschen-Schalter vor Adresse-Eingabe — zwischen den beiden Deadline-Feldern liegt kein weiteres Formularfeld.
- AK3: Die Adresse-Eingabe (`KolCombobox` „Adresse (optional)") erscheint nach der gesamten Deadline-Gruppe; im Serie-Modus ebenso nach Startdatum/Rhythmus + Schalter.
- AK4 (Mobile-first, 375px): Gruppierung und Reihenfolge aus AK2 sind bei 375px Viewport-Breite erhalten; kein Feld wird horizontal abgeschnitten (Bounding-Box vollständig im Viewport).

### Testfälle
- TF1 (AK1, e2e): neue Datei `frontend/e2e/issue-1072-deadline-group.spec.ts` — Aufgaben-Anlegeformular öffnen; Gruppen-Container (Testid) ist sichtbar und enthält genau Deadline-Datum + Auto-Löschen-Schalter.
- TF2 (AK2/AK3, e2e): dieselbe Datei — Reihenfolge per `locator.boundingBox()` prüfen: Deadline.y < Schalter.y < Adresse.y (Schalter direkt unter dem Deadline-Datum).
- TF3 (AK4, e2e): dieselbe Datei mit Viewport 375x812 — TF2-Assertions erneut; zusätzlich für alle drei Felder `x + width ≤ 375` (nichts geclippt; die App-Shell clippt overflow-x, daher Bounding-Box statt scrollWidth).

### Ampel
- Ampel: 🟢
- Begründung: Kleine, eindeutige Layout-Änderung an genau einer Komponente plus CSS; betroffene Stellen bekannt, in einem PR umsetzbar, AKs per e2e prüfbar.

### ❓ Offene Fragen
- keine — „Adresse als letztes Feld" ist im Issue selbst definiert („also nach der gesamten Deadline-Gruppe"); die nachfolgenden Formularteile (Beschreibung, Säulen, Checkliste) bleiben unverändert.
<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | ja | sonnet | low |
| spec | ja | sonnet | medium |
| impl | ja | sonnet | medium |
| review | ja | sonnet | medium |
<!-- ai-phase-routing:END -->
