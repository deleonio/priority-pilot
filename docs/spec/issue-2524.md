# Spec: #2524 — Verpasst-Block mit einer Primäraktion je Aufgabe

## Ziel

Im Verpasst-Bereich (`MissedTasksSection`, Instanzen in `App.tsx` Aufgaben-Tab und
`Dashboard.tsx`) bleibt je `missed-item` nur **„Erledigt"** als sichtbarer Primärbutton
(`_variant="primary"`). Die drei Sekundäraktionen „Neu planen", „Archivieren" und „Löschen"
sammeln sich hinter einem Icon-only-Auslöser „…" („Weitere Aktionen") in einem Popover —
Muster `TaskTree.tsx` (#361): `KolPopoverButton` mit `_label` + `_hideLabel`, Panel-Ausrichtung
per `setupPopoverAlignment`, Schließen des Panels nach jeder Aktion (Ref).

## Vertrag (Verhalten)

- **AK1** — Bei 375 px zeigt jedes `missed-item` genau einen sichtbaren Button („Erledigt",
  primary); „Neu planen", „Archivieren" und „Löschen" sind nur im geöffneten „…"-Popover
  erreichbar (zugeklappt nicht sichtbar).
- **AK2** — Alle drei Popover-Aktionen wirken wie vorher: „Neu planen" öffnet die bestehende
  Task-Bearbeitung (Modal „Aufgabe bearbeiten: …"), „Archivieren" entfernt das Item einstufig
  aus dem Verpasst-Bereich (#1964, ohne Dialog), „Löschen" löscht nach Bestätigung den Task.
- **AK3** — „Löschen" öffnet weiterhin die sequenzielle Bestätigung
  (`DeleteTaskDialog` → `ConfirmDeleteDialog`, Frage „Soll der Task … wirklich gelöscht
  werden?" + „Endgültig löschen") — unverändert in Inhalt und Ablauf
  (`docs/ux-pattern-sequential-confirmation.md`).
- **AK4** — Sichtbarer Primärbutton, „…"-Auslöser und alle Popover-Einträge haben Touch-Ziele
  von mindestens 44 px Höhe; zwischen „Erledigt" und „…"-Auslöser liegen mindestens 8 px
  (Mobile-UI-Regel 2).
- **AK5** — E2E bei 375×812 mit zwei verpassten Aufgaben: die Liste unterhalb des
  Verpasst-Blocks (`.task-section` im Aufgaben-Tab) beginnt oberhalb des Falzes (y ≤ 812),
  kein horizontaler Scroll (Bounding-Box statt scrollWidth — die App-Shell clippt
  `overflow-x: hidden`).
- **AK6** — Nach einer im Popover ausgeführten Aktion ist das Popover geschlossen
  (Muster TaskTree, Ref-basiert `hidePopover`).

## Randbedingungen

- Props-Vertrag `onComplete/onEdit/onArchive/onDelete` bleibt unverändert; „Löschen" bleibt an
  `onDelete` → `DeleteTaskDialog` gebunden; „Archivieren" bleibt einstufig ohne Dialog.
- A11y: „…"-Auslöser Icon-only mit sprechendem `_label` („Weitere Aktionen", Muster
  `taskTree.moreActions`); Escape/Click-outside/Fokusrückgabe liefert die native Popover-API.
- Farbe nie allein als Signal: „Löschen" behält Beschriftungstext, danger-Rolle nur zusätzlich.

## Testpflege

`frontend/e2e/issue-1964-missed-area.spec.ts`: AK2-Test (drei Aktionen direkt sichtbar),
AK6-Test (vier Buttons inline ≥ 44 px) und der Archiv-Roundtrip-Test erwarten die alte
Struktur und werden im selben PR auf das Popover umgestellt (erst öffnen, dann prüfen).
