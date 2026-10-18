# Erledigen-Dialog (`CompleteTaskDialog`) — Ausnahmepfad nach ADR 0024

**Status:** Ist-Vertrag des Ausnahmepfads. Default-Weg ist seit [ADR 0024](../adr/0024-erledigen-direkt-mit-rueckgaengig.md) das Direkt-Erledigen mit „Rückgängig" an der Tipp-Stelle; der Bestätigungsdialog greift nur noch bei den drei Ausnahmen unten.

**Stand:** 2026-10-18 · Komponente: `frontend/src/components/CompleteTaskDialog.tsx` · Quelle: [Issue #1168](https://github.com/deleonio/priority-pilot/issues/1168), [ADR 0024](../adr/0024-erledigen-direkt-mit-rueckgaengig.md)

Nicht-destruktiver Bestätigungsdialog auf Basis von `Modal` — bewusst NICHT `ConfirmDeleteDialog` mit
Danger-Variante: Erledigen ist keine destruktive Aktion. `Modal`-Titel: „Aufgabe erledigen".

## Die drei aktiven Auslöser

| Fall                                                                                                                                         | Verdrahtung                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Erledigt-Toggle in der Aufgabenliste bei offener Checkliste (#1583) — nur beim Markieren auf Done; Zurücksetzen auf Offen bleibt ungefragt   | `handleDoneToggle` in `App.tsx` → `setDialog({ kind: 'complete', task })`                                     |
| Signal-Panel bei offener Checkliste (#2526) — überfällige Deadline führt stattdessen zur Pünktlich-Nachfrage (`MissedCompleteDialog`, #1964) | `handlePanelComplete` in `Dashboard.tsx` → `onCompleteTask` → `completeFromPanel`/`openComplete` in `App.tsx` |
| Verpasst-Nachfrage mit offener Checkliste (#1964) — Antwort „pünktlich" schickt die Deadline als `completedAt` mit                           | `answerMissedComplete` in `App.tsx` → `setDialog({ kind: 'complete', task, completedAt })`                    |

## Vertrag `CompleteTaskDialog`

| Prop               | Bedeutung                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `task`             | betroffene Aufgabe (Titel im Dialogtext, `task.checklist` für die Checklisten-Sektion)                            |
| `onConfirm`        | `(checklist, allChecked) => Promise<void>` — speichert den Checklisten-Stand, `status: Done` nur bei `allChecked` |
| `onClose`          | Schließen ohne Statusänderung (Abbrechen, Escape)                                                                 |
| `onCompleted`      | nach erfolgreichem Bestätigen (Ansicht neu laden + Dialog schließen)                                              |
| `fallbackFocusRef` | an `Modal` durchgereicht (Trigger-Button fällt nach Erfolg aus dem DOM)                                           |

- Buttons in der Reihenfolge Abbrechen (zuerst, Initialfokus, `_variant="secondary"`) → Hauptknopf
  (`_variant="primary"`, kein Danger); während des Bestätigens sind beide deaktiviert.
- Label des Hauptknopfs abhängig vom Stand (i18n `completeTask.*`): beim Bestätigen „Wird erledigt…",
  bei vollständig abgehakter Checkliste „Als erledigt markieren", sonst „Checkliste speichern".
- Checklisten-Sektion nur, wenn die Aufgabe beim Öffnen offene Einträge hat (`hasOpenChecklistItems`);
  sie bleibt sichtbar, auch wenn der letzte offene Eintrag lokal abgehakt wird (#1583 AK8).
  „Alle abhaken" setzt alle Einträge auf einmal; Einträge sind KoliBri-Switches
  (`KolInputCheckbox _variant="switch"`) mit sichtbarem Titel.
- Schlägt `onConfirm` fehl, bleibt der Dialog offen und zeigt `KolAlert _type="error"
_label="Erledigen fehlgeschlagen"` mit der `toApiError`-Meldung (in `role="alert"`);
  `onCompleted`/`onClose` werden nicht aufgerufen.
- Erfolg: `onCompleted()` wird aufgerufen, kein Fehler-Alert.

## Verdrahtung `App.tsx`

- `DialogState`-Variante `{ kind: 'complete'; task: Task; completedAt?: string }`; geöffnet über
  `openComplete` bzw. die drei Auslöser oben.
- `onConfirm` ruft `completeTask` (`api.updateTask`): nur bei einer beim Öffnen unvollständigen
  Checkliste geht der Stand ins Payload, `status: Done` nur, wenn alle Einträge abgehakt sind oder
  keine offene Checkliste vorlag; `completedAt` reist aus der Verpasst-Antwort mit. Erledigen über
  den Dialog löst dasselbe Konfetti aus wie der Direkt-Pfad (#1182, `shouldCelebrateDone`).
- `onCompleted` → `afterMutation` (Dialog schließen, Ansicht neu laden);
  `fallbackFocusRef={deleteFallbackRef}`.

## A11y

- Initialfokus auf „Abbrechen", wie bei den Lösch-Dialogen.
- `fallbackFocusRef` ist Pflicht an den Aufrufer: der auslösende Button kann nach dem Bestätigen aus
  dem DOM fallen (Panel-Inhalt wird ersetzt, Listenzeile lädt neu).
- Dialog per Escape schließbar, Fokus-Rückgabe an den Auslöser; Fehlermeldung wird über
  `role="alert"` angesagt.
