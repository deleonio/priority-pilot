# Dashboard-Signal-Panel: „Jetzt starten" → „Erledigt" mit Bestätigungsdialog

**Stand:** 2026-09-02

Der Aktionsbutton im Panel „Nächste Aufgabe" (`Dashboard.tsx:198-205`) heißt „Jetzt starten" und öffnet
heute den Edit-Dialog (`App.tsx:611`, `onStartTask={openEdit}`). Er wird ersetzt: Label „Erledigt",
Klick öffnet einen nicht-destruktiven Bestätigungsdialog; Bestätigen setzt die Aufgabe auf `Done` und
das Panel zeigt danach ohne manuellen Reload die nächste Aufgabe aus `GET /next`.

## Vertrag `Dashboard`

- Prop `onStartTask?: (task: Task) => void` wird ersetzt durch `onCompleteTask?: (task: Task) => void`.
- Im Panel „Nächste Aufgabe" (`.dashboard-next-task-content`) rendert bei gesetztem `onCompleteTask` ein
  `KolButton _label="Erledigt"` (Icon `fa-solid fa-check`, `_variant="primary"`); ein Button „Jetzt
  starten" existiert nicht mehr. Klick ruft `onCompleteTask(nextTask)`.

## Vertrag `CompleteTaskDialog` (neu, `frontend/src/components/CompleteTaskDialog.tsx`)

Nicht-destruktiver Bestätigungsdialog auf Basis von `Modal` (NICHT `ConfirmDeleteDialog` mit
`_variant="danger"` — Erledigen ist keine destruktive Aktion). `Modal`-Titel: „Aufgabe erledigen".

| Prop               | Bedeutung                                                               |
| ------------------ | ----------------------------------------------------------------------- |
| `task`             | betroffene Aufgabe (ID + Titel werden im Dialogtext genannt)            |
| `onConfirm`        | Erledigt-Aktion des Aufrufers (setzt `status: Done`)                    |
| `onClose`          | Schließen ohne Statusänderung (Abbrechen, Escape)                       |
| `onCompleted`      | nach erfolgreichem Bestätigen (Panel neu laden + Dialog schließen)      |
| `fallbackFocusRef` | an `Modal` durchgereicht (Trigger-Button fällt nach Erfolg aus dem DOM) |

- Buttons in der Reihenfolge Abbrechen (zuerst, Initialfokus) → „Als erledigt markieren" (`_variant="primary"`, kein Danger).
- Während des Bestätigens sind beide Buttons deaktiviert.
- Schlägt `onConfirm` fehl, bleibt der Dialog offen und zeigt `KolAlert _type="error" _label="Erledigen fehlgeschlagen"` mit der `toApiError`-Meldung; `onCompleted`/`onClose` werden nicht aufgerufen.
- Erfolg: `onCompleted()` wird aufgerufen, kein Fehler-Alert.

## Verdrahtung `App.tsx`

- `DialogState`-Union erhält eine Variante `{ kind: 'complete'; task: Task }`.
- `Dashboard` erhält `onCompleteTask={(task) => setDialog({ kind: 'complete', task })}` statt `onStartTask={openEdit}`.
- `CompleteTaskDialog.onConfirm` ruft denselben Erledigt-Pfad wie `handleDoneToggle` (PUT `/tasks/{id}` mit `status: Done`), `onCompleted` schließt den Dialog und lädt `GET /next` (`reload()`) frisch — anders als der sticky-Pfad der Aufgabenliste (`DONE_REMOVAL_DELAY_MS`), der für das Dashboard-Panel nicht greift.

## Nutzersicht

1. Panel „Nächste Aufgabe" zeigt Titel, Priorität und den Button „Erledigt".
2. Klick auf „Erledigt" öffnet den Bestätigungsdialog mit Aufgaben-ID und -Titel; Initialfokus liegt auf „Abbrechen".
3. „Abbrechen" oder Escape schließt den Dialog ohne Statusänderung, Fokus kehrt zum „Erledigt"-Button zurück.
4. „Als erledigt markieren" setzt den Status auf `Done`; das Panel zeigt danach ohne manuellen Reload die nächste Aufgabe aus `GET /next` bzw. den Leer-Text, falls keine ansteht.
5. Schlägt die Aktion fehl, bleibt der Dialog offen und zeigt die Fehlermeldung; das Panel bleibt unverändert.

## A11y

- Initialfokus auf „Abbrechen" (AK2), wie bei `ConfirmDeleteDialog`.
- `fallbackFocusRef` ist Pflicht: der auslösende Button fällt nach erfolgreichem Bestätigen aus dem DOM (die nächste Aufgabe ersetzt den Panel-Inhalt).
- Button per Tastatur erreichbar und mit Enter auslösbar; Dialog per Escape schließbar, Fokus-Rückgabe an den Auslöser.

## Layout

- Der „Erledigt"-Button übernimmt den bestehenden Layout-Vertrag aus #1042 unverändert: mobil (375px) volle Innenbreite von `.dashboard-next-task-content`, ab 768px inhaltsbreit und linksbündig mit dem Titel.
