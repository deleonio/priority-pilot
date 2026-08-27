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



<!-- KI-UX:START -->

## UX-Beratung

### Interaktion

- Flow ist stimmig: Deadline-Datum → Auto-Löschen-Schalter → Adresse entspricht der gedanklichen Reihenfolge „wann fällig → was dann passiert → wo". Die heutige Trennung durch das Adressfeld ist echte Kognitionslast — der Fix adressiert das direkt.
- Der bedingte `KolAlert` („wird nach 3 Tagen gelöscht") gehört inhaltlich zwingend in die Gruppe — er ist das Feedback zum Schalter und muss direkt beim Schalter stehen, nicht nach der Adresse.
- Die Kopplung „Schalter deaktiviert ohne Deadline" (#534) gewinnt durch die Gruppierung: Ursache (leeres Deadline-Feld) und Wirkung (ausgegrauter Schalter) liegen nun direkt beieinander.
- Im Serie-Modus dieselbe Gruppierung (Startdatum/Rhythmus + Schalter vor Adresse) — konsistentes Feldraster in beiden Modi vermeidet Um-denken beim Moduswechsel.

### Mobile-First

- Vertikale Stapelung entspricht Regel 1/3 (mobile-ui-rules.md): eine Spalte, Daumen-freundlich, kein Row-Layout nötig. Falls doch (`flex`): KoliBri-Hosts sind block-level mit 100% Breite (bekannte Falle, Memory 08-24) → Breiten explizit teilen, nie `flex-shrink: 0` auf einem 100%-Host.
- Touch-Ziel der Checkbox: KoliBri setzt `--a11y-min-size: 2.75rem` (44px). Durch die Gruppierung entsteht kein Zusatzbedarf, aber das Gap zwischen Datum und Schalter nicht unter 8dp einrücken.
- Gruppierung visuell über **Abstand + Label** statt Rahmen/Cards (Regel 4: „Gruppierung durch Überschriften/Abstand, nicht Rahmen/Cards"). Das Issue nennt „Rahmen, Überschrift oder Abstände" — Empfehlung: Abstand + kurze Gruppen-Bezeichnung analog `.pillar-editor`/`.pillar-editor-label` (app.css:1106). Ein dezenter Rahmen ist akzeptabel, aber inkonsistenter zum Rest des Formulars.
- Kein zusätzliches Overflow-Risiko durch die Änderung; Prüfung weiterhin per Bounding-Box (`x + width ≤ 375`), da die App-Shell `overflow-x: hidden` clippt und `scrollWidth` strukturell grün lügt (Memory 08-24).

### A11y/BITV

- DOM-Reihenfolge = visuelle Reihenfolge bleibt durch reines Verschieben erhalten — keine ARIA-`order`-Tricks; die Tab-Fokusreihenfolge folgt der neuen Logik automatisch. Das ist ein A11y-Gewinn: Fokus springt künftig sinnvoll vom Deadline-Datum zum zugehörigen Schalter.
- Grouping-Semantik: für eine echte logische Gruppe wäre `fieldset`+`legend` das semantisch sauberste Mittel. Bei nur zwei eng verwandten Feldern mit jeweils eigenem Label ist eine rein visuelle Gruppe (div + Label-Span wie `.pillar-editor`) BITV-konform, solange kein Label-Inhalt verloren geht. Wird ein Gruppen-Titel verwendet, als echtes Markup (Heading/Label) ausgeben, nicht nur Deko-Text.
- Der bedingte `KolAlert` soll das Einblenden nicht dem Fokus stehlen, aber für Screenreader ankündigen — KoliBri-Alert bringt das (aria-live/`role="alert"`) mit; keine zusätzliche Text-Duplikation nötig.
- Kontrast/Fokusindikator unverändert (KoliBri-Sorge).

### KoliBri

- Komponentenwahl bleibt korrekt: `KolInputDate`, `KolInputCheckbox`, `KolCombobox` — reine Anordnungsänderung, kein Komponentenwechsel.
- Falls ein semantischer Gruppenrahmen gewünscht ist: `KolFieldset` wäre der KoliBri-Weg; andernfalls schlichter Gruppen-`div` + CSS-Grid wie `.pillar-editor`. Beide Varianten BITV-2.1-PS-kompatibel.
- Theme-Integration: Gruppenabstände aus vorhandenen Tokens (`--pp-gap-tight`; `.pillar-editor` nutzt 0.75rem/1rem) — keine Hardcodes.

### Design-Sprache

- Abstände aus der Fixskala 4/8/12/16/24/32 (Regel 6): Gruppen-Gap 12px (0.75rem, wie `.pillar-editor`), Separation zur nächsten Gruppe 16–24px — „tight groups, generöse Separation" (ux-design.md → Spacing).
- Gruppen-Bezeichnung (falls verwendet) wie `.pillar-editor-label`: `font-weight: 600`, keine neue Schriftgröße (max. 5 Größen / 2 Gewichte bleiben eingehalten).
- Kein neues Farbmuster; Rahmen (falls doch) nur über vorhandenes `--pp-border` wie `.pillar-row`.

### Offene UX-Fragen

- keine harten Blocker. Eine Design-Entscheidung mit Freiheitsgrad: **Abstand+Label vs. Rahmen** für die Gruppen-Absetzung (Issue lässt beides zu; Empfehlung oben: Abstand+Label, konsistent mit `.pillar-editor`/`.checklist-editor`). In der Spec als Default festlegbar, ohne Rückfrage.

<!-- KI-UX:END -->
