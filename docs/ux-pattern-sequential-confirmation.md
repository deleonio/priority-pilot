# UX-Pattern: Sequenzielle Bestätigung

Dieses Dokument beschreibt das UX-Pattern **Sequenzielle Bestätigung** für
destruktive oder weitreichende Aktionen in Priority Pilot. Es dient als
verbindliche Referenz für künftige Implementierungs-Issues, die Bestätigungs-
bzw. Löschdialoge umsetzen.

Stabiler Pfad für Querverweise: `docs/ux-pattern-sequential-confirmation.md`.

---

## Wann das Pattern eingesetzt wird

Destruktive Aktionen – etwa das Löschen von Templates, Serien, Aufgaben oder
Säulen – sind nicht umkehrbar und betreffen oft mehrere Datenobjekte zugleich.
Ein einziger, mit Optionen überladener Dialog erhöht die Gefahr von **Slips**
(versehentlichen Fehlbedienungen). Das Pattern teilt die Bestätigung daher in
zwei einfache, aufeinanderfolgende Ja/Nein-Schritte auf.

Vorhandene Komponenten, die dieses Pattern bereits partiell umsetzen:

- `ConfirmSeriesActionModal.tsx`
- `DeleteSeriesDialog.tsx`
- `DeleteTaskDialog.tsx`
- `PillarDeleteDialog.tsx`

---

## 1. Theoretische Fundierung (Fachliteratur)

Das Pattern stützt sich auf drei etablierte Usability- und
kognitionspsychologische Prinzipien:

- **Hick'sches Gesetz (Hick & Hyman):** Die Entscheidungszeit steigt mit der
  Komplexität der angebotenen Optionen. Die Trennung in einfache Ja/Nein-Schritte
  reduziert die kognitive Last drastisch, weil pro Schritt nur eine einzige
  Entscheidung getroffen werden muss.
- **Progressive Disclosure (Nielsen Norman Group):** Sekundäre Entscheidungen
  werden erst dann präsentiert, wenn sie akut relevant sind. Die Frage nach dem
  Umfang einer Löschung taucht erst auf, nachdem die grundsätzliche Absicht
  bestätigt wurde. Das verhindert initiale Überforderung.
- **Error Prevention (Jakob Nielsen):** Destruktive Aktionen erfordern absolute
  mentale Klarheit. Kombinierte Dialoge mit zu vielen Checkboxen begünstigen
  versehentliche Fehlbedienungen (Slips). Die sequenzielle Aufteilung erzwingt
  eine bewusste, schrittweise Freigabe und ist damit eine Maßnahme zur
  Fehlervermeidung (Error Prevention).

---

## 2. Barrierefreiheit (WCAG & BITV 2.0)

Dieses Pattern unterstützt aktiv Nutzerinnen und Nutzer mit kognitiven
Einschränkungen. Screenreader-Nutzende müssen pro Interaktionsschritt deutlich
weniger Kontext im Arbeitsgedächtnis behalten, weil jeder Schritt in sich
geschlossen und verständlich ist.

**Verbindliche Vorgabe – Fokus-Management:**

Beim Übergang zwischen den beiden Bestätigungsschritten ist ein **striktes
Fokus-Management** zwingend erforderlich. Es ist eine verbindliche
Accessibility-Anforderung, keine optionale Ergänzung:

- Beim Öffnen eines Schritts muss der Fokus programmatisch auf das primäre
  Interaktionselement (z. B. die Bestätigen-Schaltfläche oder den Dialog-Titel)
  gesetzt werden.
- Beim Wechsel in den Folgeschritt muss der Fokus erneut gezielt in den neuen
  Dialog verschoben werden – der Fokus darf nicht im vorherigen, nun
  ausgeblendeten Schritt verbleiben.
- Beim Abbrechen oder Schließen muss der Fokus auf das auslösende Element
  zurückkehren (Fokus-Restaurierung).

Diese Anforderungen leiten sich aus den Richtlinien zur Bedienbarkeit (WCAG,
BITV 2.0) ab und sind für jede Umsetzung dieses Patterns **verbindlich**.

---

## 3. Flow-Integration

Der Bestätigungsablauf besteht aus zwei aufeinanderfolgenden Schritten. Der
zweite Schritt wird ausschließlich dann ausgelöst, wenn der erste mit _Ja_
bestätigt wurde (Progressive Disclosure).

- **Flow-Schritt 1 – Intentionsprüfung**
  - Frage: „Template wirklich löschen?"
  - Ziel: Klärt die grundsätzliche Absicht der nutzenden Person.
  - Aktion: Reines Ja/Nein – ohne weitere Optionen.

- **Flow-Schritt 2 – Scope-Definition**
  - Frage: „Auch alle zugehörigen Instanzen löschen?"
  - Ziel: Klärt den Umfang (Scope) der Aktion.
  - Bedingung: Wird nur bei _Ja_ aus Schritt 1 ausgelöst.
  - Aktion: Ja/Nein zur Festlegung, ob abhängige Objekte mit einbezogen werden.

---

## Umsetzungshinweise für Folge-Issues

- Jeder Schritt ist ein eigenständiger, fokussierter Dialog – keine
  Checkbox-Listen in einem kombinierten Dialog.
- Das strikte Fokus-Management beim Übergang (siehe Abschnitt Barrierefreiheit)
  ist für jede Implementierung **verbindlich** und in den Tests nachzuweisen.
- Künftige Implementierungs-Issues verweisen zur Begründung auf dieses Dokument
  (stabiler Pfad: `docs/ux-pattern-sequential-confirmation.md`).
