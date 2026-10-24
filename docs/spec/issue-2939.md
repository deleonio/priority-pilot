# Spec #2939 — Aufgaben-Ansicht `/aufgaben/<id>` (Schnitt-Teil 2: Handeln in der Ansicht)

Verbindliche Grundlagen: `docs/ux-konzept-ansichten.md` (Abschnitte 4.3, 7), der KI-UX-Block im
Harness-Kommentar und ADR 0024 (Erledigen direkt mit Rückgängig, kein Bestätigungsdialog).
Aufbau auf Teil 1 (#2938, `docs/spec/issue-2938.md`): die bestehende Leseseite `TaskView`
(`frontend/src/components/TaskView.tsx`) wird um Handeln erweitert — Backend bleibt unverändert
(vorhandene Endpunkte `PATCH /tasks/:id` mit komplettem Checklisten-Array (#531), `POST
/tasks/:id/snooze`, `/archive`, `/unarchive`, `GET /forest`).

## Ziel

Unter `/aufgaben/<id>` lässt sich eine Aufgabe direkt in der Ansicht bedienen: Checklistenpunkt
abhaken, genau eine sticky Primäraktion je Zustand, Anpinnen und Zurückstellen ohne Formular oder
Dialog. Fehler erscheinen als `KolAlert` über der Primäraktion — kein Toast als einziger Ort
(Konzept Abschnitt 7).

## Checkliste (AK1)

- Je Punkt ein `KolInputCheckbox` (Standard-Variante, keine Switch), Label = Klartext des Punkts;
  ganze Zeile tappbar (Touch-Target ≥44px, KI-UX Regel 2).
- Zähler „{{done}} von {{total}}“ (`taskView:checklistCounter`) in der Überschriftenzeile der
  Checkliste, `tabular-nums`, nie nur Farbe.
- Abhaken sendet `PATCH /tasks/:id` mit der **kompletten** Checkliste (geänderter Punkt
  `completed: true`, übrige Punkte unverändert mit `id`/`title`/`completed`) — kein
  Einzelpunkt-Endpunkt (#531). In-Flight am selben Punkt sperren bzw. von den frischesten Daten
  senden (KI-UX: Last-Write-Wins verhindern).
- Optimistische Aktualisierung (Zähler <100 ms); Response/`GET /tasks/:id` spiegelt die geänderte
  Checkliste (Persistenz).

## Primäraktion — genau eine je Zustand (AK2, AK3)

Sticky im unteren Drittel, bei 375×812 ohne Scroll sichtbar, `env(safe-area-inset-bottom)`
respektieren; Fehler-/Info-Alert mit in den Sticky-Bereich.

| Zustand                           | Aktion (Bezeichnung)                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| offen                             | „Erledigt“ (`KolButton` primary) → Status `Done` über den bestehenden App-Flow; bei Überfälligkeit fragt der bestehende #1964-Flow zuerst die Pünktlichkeit (nicht Teil dieser Tests — Test-Aufgaben mit Zukunfts-Deadline)                                                                                                                                                 |
| offene direkte Unteraufgabe       | „Erledigt“ gesperrt (`_disabled`); Grund dauerhaft sichtbar (nicht erst auf Klickversuch) im `doneBlockedHint`-Wortlaut („… N offene Unteraufgabe(n) …“), für Screenreader mit dem Button verknüpft (aria-describedby oder eigenes lesbares Element). Quelle: `GET /forest` — Knoten zur eigenen ID, `isDoneBlockedBySubtasks(node.dependents)`; kein neuer Server-Endpunkt |
| erledigt                          | „Wieder öffnen“ (sekundär) → Status `Open`, `completedAt: null`                                                                                                                                                                                                                                                                                                             |
| archiviert (`archivedAt` gesetzt) | „Wiederherstellen“ (sekundär) → `POST /tasks/:id/unarchive`; darüber „Archiviert“-Banner als `KolAlert _type="info"`                                                                                                                                                                                                                                                        |

Nach jedem Zustandswechsel spiegelt die Ansicht sofort: Status-Badge („Offen“/„Erledigt“),
`completedAt` zurückgesetzt beim Wieder-Öffnen.

## Anpinnen und Zurückstellen (AK4)

- Anpinnen/Abpinnen: Button (Bestands-Keys `tasks:pin`/`tasks:unpin`, „Anpinnen“/„Abpinnen“) →
  `PATCH /tasks/:id` mit `pinned: !task.pinned`; Spiegel sofort in der Ansicht („Angepinnt“-Badge
  über `TaskBadges`/`PinnedBadge` bzw. Label-Wechsel).
- Zurückstellen: Button „Kurz zurückstellen“ (Bestands-Key `common:actions.snooze`) →
  `POST /tasks/:id/snooze`; sichtbare Bestätigung in der Ansicht („Pausiert bis …“,
  `taskView:snoozedBadge` mit formatiertem `snoozedUntil`) — kein schweigender Erfolg.
- Beides ohne Formular oder Dialog.

## Fehler (AK5)

- Schlägt eine Aktion fehl (Server-Guard offene Unteraufgaben, unvollständige Checkliste,
  Netzwerk): `KolAlert _type="error"` **über der Primäraktion** (im Sticky-Bereich) mit
  verständlichem Text; der Zustand springt zurück (Haken/Zähler, Status, Pin) — bei optimistischer
  Aktualisierung revertieren.
- Kein Toast als einziger Fehlerort.

## i18n (`taskView`-Namespace, de/en)

Neu: `checklistCounter` („{{done}} von {{total}}“/"{{done}} of {{total}}"), `markDone`
(„Erledigt"/"Mark done"), `reopen` („Wieder öffnen"/"Reopen"), `restore` („Wiederherstellen"/
"Restore"), `archivedBanner` („Archiviert"/"Archived"), `snoozedBadge` („Pausiert bis {{date}}"/
"Paused until {{date}}"), `actionFailed` („Aktion fehlgeschlagen. Bitte erneut versuchen."/"The
action failed. Please try again."). Wiederverwendet: `tasks:pin`/`tasks:unpin`,
`common:actions.snooze`, `doneBlockedHint` (`taskForm:task.doneBlocked`), Status-Badges über
`TaskBadges` (`common:status.*`).

## Testfälle

| AK  | Ebene | Datei                                       | Kern                                                                                                                                                                                                            |
| --- | ----- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | Unit  | `frontend/src/components/TaskView.test.tsx` | Abhaken → `updateTask` mit kompletter Checkliste (3 Punkte, genau der eine ändert sich), Zähler „1 von 3“ → „2 von 3“                                                                                           |
| AK1 | e2e   | `frontend/e2e/aufgaben-ansicht.spec.ts`     | Punkt abhaken, Reload → Haken + Zähler persistiert; `GET /tasks/:id` liefert geänderte Checkliste                                                                                                               |
| AK2 | Unit  | `frontend/src/components/TaskView.test.tsx` | gemockter Forest mit offener Unteraufgabe → „Erledigt“ disabled + Hinweistext sichtbar                                                                                                                          |
| AK2 | e2e   | `frontend/e2e/aufgaben-ansicht.spec.ts`     | Eltern-/Unteraufgabe per API, Ansicht: Button disabled + Grund-Text                                                                                                                                             |
| AK3 | e2e   | `frontend/e2e/aufgaben-ansicht.spec.ts`     | „Erledigt“ → Status-Badge „Erledigt“, „Wieder öffnen“ → „Offen“ + `completedAt null`; sticky: Button-Unterkante ≤ Viewport bei 375×812; archiviert → Banner + „Wiederherstellen“ stellt her (`archivedAt null`) |
| AK4 | Unit  | `frontend/src/components/TaskView.test.tsx` | „Anpinnen“ → `updateTask` mit `pinned: true` + „Angepinnt“-Badge; „Kurz zurückstellen“ → `snoozeTask` + Notice „Aufgabe zurückgestellt …“ sichtbar                                                              |
| AK5 | Unit  | `frontend/src/components/TaskView.test.tsx` | abgelehnter PATCH → Fehler-`KolAlert` (type=error), Haken + Zähler zurück; abgelehntes Snooze → Fehler-Alert, Ansicht bleibt offen                                                                              |
