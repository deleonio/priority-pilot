# Checklisten beim Erledigen abhaken müssen

**Stand:** 2026-09-20

Hat eine Aufgabe offene Checklisten-Einträge, öffnet das Erledigen (Toggle in der Aufgabenliste wie
Signal-Panel-Knopf) `CompleteTaskDialog` mit der vollständigen Checkliste statt sie direkt auf `Done`
zu setzen. Ein Sammel-Knopf hakt alle Einträge auf einmal ab; der Hauptknopf speichert immer den
Checklisten-Stand, der Status wechselt auf `Done` nur, wenn dabei alle Einträge abgehakt sind.

## Vertrag `CompleteTaskDialog`

| Prop               | Bedeutung                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `task`             | betroffene Aufgabe (Titel im Dialogtext, `task.checklist` für die Sektion)                                      |
| `onConfirm`        | speichert `checklist` (+ `status: Done`, wenn alle abgehakt); Signatur `(checklist, markDone) => Promise<void>` |
| `onClose`          | Schließen ohne Persistenz (Abbrechen, Schließen-X)                                                              |
| `onCompleted`      | nach erfolgreichem Speichern (Panel/Liste neu laden + Dialog schließen)                                         |
| `fallbackFocusRef` | unverändert an `Modal` durchgereicht                                                                            |

- Hat `task.checklist` mindestens einen Eintrag: Dialog zeigt eine Checklisten-Sektion (Muster
  `TaskForm.tsx:1567-1607`, `data-testid="checklist-section"`/`"checklist-item"`) — je Eintrag Titel
  und ein `KolInputCheckbox _variant="switch"`, vorbelegt mit `item.completed`, in beide Richtungen
  umschaltbar.
- Fehlt `task.checklist` oder ist sie leer: keine Checklisten-Sektion, Verhalten unverändert wie
  bisher (reiner Bestätigungstext, ein Hauptknopf „Als erledigt markieren").
- Ist eine Checklisten-Sektion vorhanden, zusätzlich ein zweiter Knopf „Alle abhaken" (`_variant="secondary"`),
  der lokal alle Einträge auf `completed: true` setzt (keine Persistenz).
- Der Hauptknopf ist nie `_disabled`, außer während des laufenden Speicherns (`completing`). Sein
  Label lautet „Checkliste speichern", solange mindestens ein Eintrag offen ist, und „Als erledigt
  markieren", sobald alle Einträge abgehakt sind (oder keine Checkliste existiert).
- Klick auf den Hauptknopf ruft `onConfirm(checklist, allChecked)`, wobei `checklist` der aktuelle
  lokale Zustand ist und `allChecked` genau dann `true` ist, wenn alle Einträge abgehakt sind.
- Abbrechen und das Schließen-X rufen ausschließlich `onClose()`, nie `onConfirm`.
- Fehlerfall unverändert: Dialog bleibt offen, `KolAlert _type="error" _label="Erledigen fehlgeschlagen"`.

## Verdrahtung `App.tsx`

- `handleDoneToggle`: beim Wechsel Offen→Done mit mindestens einem offenen Checklisten-Eintrag wird
  **kein** PATCH ausgelöst, sondern der Dialog geöffnet (`setDialog({ kind: 'complete', task })`) —
  analog zum bestehenden Signal-Panel-Pfad. Der Wechsel Done→Offen bleibt unverändert ohne Dialog.
  Hat die Aufgabe keine Checkliste oder ist sie vollständig abgehakt, bleibt der direkte Toggle ohne
  Dialog erhalten (AK8).
- `completeTask`/der `onConfirm`-Callback des `'complete'`-Dialogs sendet ein `taskUpdate` mit
  `checklist: <lokaler Stand>` und, nur wenn `allChecked` ist, zusätzlich `status: Done` — in einem
  einzigen `updateTask`-Aufruf. Ohne `allChecked` bleibt `status` im Payload weg (Feld unverändert).
- Konfetti (`shouldCelebrateDone`) und der Sticky-/Undo-Pfad (`DONE_REMOVAL_DELAY_MS`) laufen nur,
  wenn der Aufruf tatsächlich `status: Done` enthielt und der vorherige Status nicht `Done` war.

## Nutzersicht

1. Aufgabe mit offener Checkliste erledigen (Liste oder Signal-Panel) → Dialog mit Checkliste öffnet.
2. Einzelne Einträge abhaken oder „Alle abhaken" klicken.
3. Hauptknopf speichert immer; solange ein Eintrag offen bleibt, bleibt die Aufgabe offen (Fortschritt
   x/y sichtbar in der Liste); sind alle Einträge abgehakt, wird die Aufgabe zusätzlich erledigt.
4. Abbrechen/Schließen-X verwirft alle Änderungen.
5. Aufgabe ohne Checkliste (oder vollständig abgehakt) verhält sich wie bisher — Dialog ohne
   Checklisten-Sektion, Toggle in der Liste direkt ohne Dialog.

## A11y / Layout

- Initialfokus auf „Abbrechen" bleibt (#472-Muster).
- Mobile 375px: Hauptknopf durch Scrollen erreichbar, Knopfleiste nicht sticky am unteren Rand,
  keine horizontale Überbreite auch bei 20 Einträgen (AK9).
