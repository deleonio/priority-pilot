# Spec #2361 — Aufgabe als Vorlage speichern (Frontend)

Eine bestehende Aufgabe wird per Aufgaben-Aktion als Serien-Vorlage übernommen: Der Dialog öffnet
das bestehende Serien-Formular im Anlage-Modus, vorbelegt aus der Aufgabe; gespeichert wird über das
unveränderte `POST /series` (#2358-Lieferung: `autoCreate: false` + `rhythm: 'none'` ohne
`startDate`). Der Server bleibt unberührt; die Ausgangsaufgabe wird nie verändert.

## Neue Aktion in beiden Aufgaben-Aktionsmenüs

- Ziel: „Als Vorlage speichern" neben „Unteraufgabe anlegen" im Baum-Popover (`TaskTree.tsx`) und in
  der Tabellen-Toolbar (`TaskTable.tsx`), als `secondary`-Icon-Button mit Klartext-`_label`
  „Als Vorlage speichern" (aria-label + Tooltip), Font-Awesome-Icon `fa-solid fa-clone`
  (KolIcons-Font kennt kein Vorlagen-Symbol), mit Abstand zu „Löschen" (`danger` bleibt Löschung).
- Label-Schlüssel `common:actions.saveAsTemplate`, in allen 10 Sprachen vorhanden und nicht leer (AK4).
- Per Tastatur erreichbar und auslösbar (Popover-Button → Toolbar-Button → Enter) (AK4).

## Dialog (TaskFormModal + TaskForm, Serien-Modus, Anlegen)

- Vorbedingung: `task = null`, `initialMode = 'series'`; Vorbelegung aus der Aufgabe über die
  erweiterte `TaskFormInitialValues` (neu: `latitude`, `longitude`, `pillars`, `autoCreate`,
  `rhythm` — bestehend: `title`, `description`, `priority`, `estimatedEffort`, `address`,
  `categoryId`).
- Dialogtitel „Vorlage erstellen" (UX-Empfehlung übernommen: benennt das Ergebnis, nicht „Serie anlegen").
- Erwartung (AK1):
  1. Titel, Beschreibung, Priorität, Aufwand, Adresse, Kategorie und Säulen-Verteilung der Aufgabe
     sind vorbelegt (Anteile inkl. `confidence` unverändert übernommen).
  2. Koordinaten der Aufgabe sind übernommen und im Koordinaten-Kasten sichtbar.
  3. „Automatisch anlegen" ist aus; Rhythmus = „Ohne Rhythmus" (`none`); kein Startdatum-Feld.
  4. Akkordeon „Termin & Ort" ist initial aufgeklappt (UX-Empfehlung: Vorbelegung sichtbar ohne Antippen).
  5. Modus-Umschalter ist gesperrt (UX-Empfehlung: Wechsel auf „Aufgabe" würde eine Duplikat-Aufgabe erzeugen).
  6. Dirty-Check (#1584): Die Vorbelegung ist die Baseline — sofortiges Schließen fragt nicht nach.
- Deadline, Checkliste, Status, Pin werden bewusst NICHT übernommen (Serien-Modell hat kein Gegenstück).

## Speichern (AK2)

- Genau ein `POST /series` mit den vorbelegten Werten: `title`, `priority`, `estimatedEffort`,
  `description`, `address`, `latitude`, `longitude`, `categoryId`, `pillars` (Verteilung der
  Aufgabe), `autoCreate: false`, `rhythm: 'none'`, kein `startDate`.
- Nie `updateTask`/`createTask` auf der Ausgangsaufgabe.
- Die Vorlage erscheint im Tab „Serien & Vorlagen" mit Badge „Vorlage" (#2358).

## Abbrechen / Ausgangsaufgabe (AK3)

- Abbrechen legt nichts an (kein `POST /series`).
- Die Ausgangsaufgabe ist nach Speichern wie nach Abbrechen unverändert: Felder gleich, keine
  Serien-Zuordnung, kein Update-Aufruf.

## Mobile 375 px (AK5)

- Aktion bedienbar: Touch-Höhe ≥ 44 px (Bounding-Box, Muster #2358 AK8).
- Das vorbelegte Serien-Formular läuft ohne horizontales Überlaufen (Dialog-Bounding-Box within
  Viewport; App-Shell clippt, daher keine `scrollWidth`-Assertions).

## Umfang Grenzen

- Ausgangsaufgabe bleibt unverändert (kein `updateTask`, keine Serien-Zuordnung).
- Vor dem Speichern entsteht nichts; Schnellerfassung (#236) und #2358-Logik werden nur genutzt.
- Dialogtitel-Varianten und Modus-Sperre sind UI-Verdrahtung (`TaskFormModal`/`App`) — der Titel
  wird im E2E geprüft, die Sperre im Unit-Test; eine eigene `taskFormModalTitle`-Unit entfällt
  (String-Vertrag ohne Eigenlogik).
