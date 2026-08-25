# Issue 728: Checklist-Abstände (CSS Gaps)

**Stand:** 2026-08-23

## Ziel

Die Checkliste im Task-Formular nutzt CSS Gaps für ihre Abstände: vertikal zwischen den Items sowie horizontal zwischen Eingabefeld + „Hinzufügen"-Button und innerhalb eines Items (Checkbox, Titel, Entfernen-Button).

## Vorbedingung

- Task-Formular ist geöffnet (Schnellerfassung mit „Überspringen" oder Bearbeitung)
- Checklist-Sektion ist sichtbar

## Schritte

1. Checklisten-Einträge anlegen
2. Abstände der Items untereinander prüfen
3. Abstände innerhalb eines Items (Checkbox, Titel, Entfernen-Button) und zwischen Eingabefeld und „Hinzufügen"-Button prüfen

## Erwartetes Ergebnis

- Zwischen Checklist-Items besteht vertikaler Freiraum (Gap), Items stapeln sich nicht randlos
- Eingabefeld und „Hinzufügen"-Button sind mit horizontalem Freiraum nebeneinander angeordnet
- Item-Inhalte (Checkbox, Titel, Entfernen-Button) sind strukturiert mit Freiraum ausgerichtet
- Keine visuellen Regressionen in anderen Formularelementen
