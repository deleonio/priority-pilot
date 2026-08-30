# Gemeinsamer Bestätigungs-Lösch-Dialog

**Stand:** 2026-08-30

Die vier Lösch-Dialoge (`DeleteTaskDialog`, `PillarDeleteDialog`, `DeleteSeriesDialog`, `LlmProviderDeleteDialog`) nutzen dieselbe Komponente `ConfirmDeleteDialog`. Fehlerbehandlung, Fokus-Verhalten und Button-Layout sind an genau einer Stelle gepflegt.

## Vertrag `ConfirmDeleteDialog`

| Prop               | Bedeutung                                                       |
| ------------------ | --------------------------------------------------------------- |
| `title`            | Dialog-Überschrift (an `Modal` durchgereicht)                   |
| `body`             | Fragetext des Dialogs                                           |
| `confirmLabel`     | Label des destruktiven Buttons (z. B. „Endgültig löschen")      |
| `onConfirm`        | Lösch-Aktion des Aufrufers (z. B. `api.deleteTask`)             |
| `onClose`          | Schließen ohne Löschung                                         |
| `onDeleted`        | Nach erfolgreichem Löschen (Liste neu laden + Dialog schließen) |
| `fallbackFocusRef` | an `Modal` durchgereicht                                        |
| `secondaryAction`  | optionaler dritter Button (Kaskaden-Fall, Serie)                |

Intern gekapselt:

- Fehlerbehandlung über `toApiError`; der Fehler erscheint als `KolAlert` `_type="error"` mit `_label="Löschen fehlgeschlagen"` oberhalb des Fragetexts.
- Während des Löschens sind alle Buttons deaktiviert und das Danger-Label zeigt `Löschen…`; schlägt die Aktion fehl, wird der Zustand zurückgesetzt und der Dialog bleibt offen mit dem Fehler-Alert.
- Erfolg: `onDeleted()` wird aufgerufen, kein Fehler-Alert.
- `useCtrlEnter` löst die Konfirmation aus (Klick oder Strg+Enter), solange kein Löschen läuft.

## Nutzersicht

1. Nutzer öffnet einen Lösch-Dialog (Task, Säule, Serie, LLM-Provider) — Fragetext und Buttons im einheitlichen Layout.
2. Bestätigen (Klick oder Strg+Enter) → Löschen läuft → Dialog schließt; Abbrechen → Dialog schließt ohne Löschung.
3. Schlägt das Löschen fehl, bleibt der Dialog offen und zeigt den Fehler an.

## A11y

- Der nicht-destruktive Button steht vor dem Danger-Button und erhält den Initialfokus — eine irreversible Aktion ist nicht per Enter auslösbar.
- Tab-Reihenfolge: Abbrechen → optionaler `secondaryAction`-Button → Danger-Button.
- Die Fehlermeldung steht an derselben Stelle (Alert oberhalb des Fragetexts) mit gleichbleibendem Label „Löschen fehlgeschlagen".
