

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
