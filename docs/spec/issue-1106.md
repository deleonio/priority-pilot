# Spec: Gemeinsamer Bestätigungs-Lösch-Dialog (#1106)

## Ziel

Die vier Kopien desselben Lösch-Dialog-Skeletts (`DeleteTaskDialog`, `PillarDeleteDialog`,
`DeleteSeriesDialog`, `LlmProviderDeleteDialog`) werden auf eine gemeinsame Komponente
`ConfirmDeleteDialog` (`frontend/src/components/ConfirmDeleteDialog.tsx`, neu) umgestellt.
Fehlerbehandlung, Fokus-Verhalten und Button-Layout sind danach an genau einer Stelle gepflegt.

## Vertrag `ConfirmDeleteDialog`

Props (AK1):

| Prop               | Typ                                      | Bedeutung                                                       |
| ------------------ | ---------------------------------------- | --------------------------------------------------------------- |
| `title`            | `string`                                 | Dialog-Überschrift, an `Modal` durchgereicht                    |
| `body`             | `ReactNode`                              | Fragetext des Dialogs                                           |
| `confirmLabel`     | `string`                                 | Label des destruktiven Buttons (z. B. „Endgültig löschen“)      |
| `onConfirm`        | `() => Promise<void>`                    | Lösch-Aktion des Aufrufers (z. B. `api.deleteTask`)             |
| `onClose`          | `() => void`                             | Schließen ohne Löschung                                         |
| `onDeleted`        | `() => void`                             | Nach erfolgreichem Löschen (Liste neu laden + Dialog schließen) |
| `fallbackFocusRef` | `RefObject<HTMLElement \| null>`         | an `Modal` durchgereicht                                        |
| `secondaryAction?` | `{ label: string; onClick: () => void }` | dritter Button für den Kaskaden-Fall (#1106-Serie)              |

Intern gekapselt (AK1):

- `error`/`deleting`-State; `onConfirm` setzt `deleting`, löscht einen alten Fehler und
  setzt `deleting` zurück, wenn die Aktion fehlschlägt.
- Fehlerbehandlung über `toApiError` (`frontend/src/lib/apiError.ts`); der Fehler erscheint
  als `KolAlert` `_type="error"` mit `_label="Löschen fehlgeschlagen"`.
- `KolAlert`/`KolButton`-Rendering und der `modal-actions`-Block liegen in der Komponente.
- `useCtrlEnter` löst die Konfirmation aus, solange kein Löschen läuft.
- Während `deleting` sind alle Buttons deaktiviert und das Danger-Label zeigt `Löschen…`.
- Erfolg: `onDeleted()` wird aufgerufen, kein Fehler-Alert.

## Schritte (Nutzersicht)

1. Nutzer öffnet einen Lösch-Dialog (Task, Pillar, Serie, LLM-Provider).
2. Der Dialog zeigt Fragetext und die Buttons im einheitlichen Layout.
3. Nutzer bestätigt (Klick oder Strg+Enter) → Löschen läuft → Dialog schließt,
   oder bricht ab → Dialog schließt ohne Löschung.
4. Schlägt das Löschen fehl, bleibt der Dialog offen und zeigt den Fehler an.

## Erwartetes Ergebnis

- **AK4 (Button-Reihenfolge/Fokus):** In allen Dialogen steht der nicht-destruktive Button
  vor dem Danger-Button und erhält den Initialfokus (`initialFocusRef` auf den
  Abbrechen-Button, siehe #472/#553 — irreversible Aktion nicht per Enter auslösbar).
  `LlmProviderDeleteDialog` weicht nicht mehr ab.
- **AK2:** `grep toApiError` über die vier Dialogdateien liefert 0 Treffer; nur
  `ConfirmDeleteDialog.tsx` nutzt sie.
- **AK3:** `DeleteTaskDialog.test.tsx` und `DeleteSeriesDialog.test.tsx` bleiben unverändert
  grün (Fokus auf Abbrechen, Fehler-Alert „Löschen fehlgeschlagen“, Ctrl+Enter inkl.
  Kaskaden-Flag im Series-Fall).
- **AK5:** Netto-Reduktion von mindestens 120 Zeilen über die vier Dialogdateien
  (`wc -l` vor/nach, im PR dokumentiert; Ist-Stand: 76/77/87/88 = 328 Zeilen).

## Rote Tests dieser Spec-Phase

`frontend/src/components/ConfirmDeleteDialog.test.tsx` (neu, Vitest) deckt den Vertrag:
Button-Reihenfolge + Initialfokus-Ref auf den nicht-destruktiven Button, `title`-/
`fallbackFocusRef`-Durchreichung an `Modal`, Fehler-Alert-Label + `deleting`-Reset bei
Fehlschlag, `deleting`-Zustand (Buttons deaktiviert, Label `Löschen…`), Erfolg ruft
`onDeleted`, Abbrechen ruft `onClose`, `secondaryAction` rendert den dritten Button,
Strg+Enter-Callback konfirmiert.

Kein eigener Test für AK2 (statische Grep-Prüfung im PR) und AK5 (metrische `wc -l`-Prüfung
im PR) — beides ist kein Anwendungscode-Verhalten (ADR 0001). AK3 ist durch die bestehenden
Tests abgedeckt (Dedup: keine neuen Tests, keine Änderung an bestehenden Testdateien).

## KI-UX-/A11y-Anforderungen

- Sicherer Initialfokus (#472/#553) bleibt garantiert und wird single-sourced.
- Einheitliche Tab-Reihenfolge: Abbrechen → optional `secondaryAction` → Danger.
- Fehlermeldung bleibt an derselben Stelle (Alert oberhalb des Fragetexts) mit gleichbleibendem
  Label „Löschen fehlgeschlagen“.
