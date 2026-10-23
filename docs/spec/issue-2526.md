# Spec #2526 — Erledigen mit einem Tipp, sichtbarem Erfolg und Rückgängig

Produktvertrag: [ADR 0024](../adr/0024-erledigen-direkt-mit-rueckgaengig.md). Der Bestätigungsdialog
(`CompleteTaskDialog`) bleibt nur für offene Checklisten (`#1583`), die Pünktlich-Nachfrage
(`MissedCompleteDialog`) nur für verpasste Aufgaben.

## Ziel

Der häufigste positive Moment („Erledigt“) kostet einen Tipp statt zwei und meldet an der
Tipp-Stelle Erfolg (Punkte, Streak) mit 7 Sekunden „Rückgängig“ zurück — ohne Toast, ohne Overlay.

## AK1 — Direktes Erledigen (Signal-Panel)

- Voraussetzung: Aufgabe ohne offene Checklisten-Einträge als „Nächste Aufgabe“.
- Schritt: ein Tipp auf „Erledigen“.
- Erwartet: Status wechselt auf `Done` (PATCH), **kein** Bestätigungsdialog (`kol-dialog` mit
  „Aufgabe erledigen“ erscheint nicht).
- Verpasste Deadline (deadline < jetzt): statt Direkt-Erledigen öffnet die Pünktlich-Nachfrage
  (`MissedCompleteDialog`, Knöpfe „Nein, pünktlich“ / „Ja, jetzt“) — kein „Als erledigt markieren“.

## AK2 — Inline-Rückmeldung mit „Rückgängig“

- Direkt nach dem Tipp zeigt das Panel an der Tipp-Stelle die Rückmeldung: vergebene Punkte
  (`+X Punkte`) und Streak (`Streak Y Tage`), dazu Knopf „Rückgängig“ (bestehender Wieder-öffnen-Pfad,
  Server entfernt den ScoreEntry — keine Doppelvergabe, gedeckt durch `tasks-reopen-score.test.ts`).
- Die Rückmeldung liegt in einer `aria-live="polite"`-Region (KI-UX), kein Fokusraub.
- Punkte-Quelle (eine Wahrheit, Server): der echte Done-Übergang über PATCH `/tasks/:id` liefert die
  vergebene Punktzahl als `vergebenePunkte` in der Response (Formel `score.ts`: Basiswert
  `estimatedEffort × priority`, ohne Deadline pünktlich = voll). PATCH ohne Done-Übergang liefert
  das Feld nicht. Streak folgt danach über den bestehenden `api.getStreak()`-Abruf.

## AK3 — 7-Sekunden-Fenster

- Das Fenster dauert 7 s; danach zeigt das Panel die nächste Aufgabe (oder den Leerzustand).
- Navigation/Neuladen im Fenster macht die Erledigung endgültig (kein Rückgängig mehr, Status
  bleibt `Done`).

## AK4 — Aufgabenliste

- „Erledigt“ (hinter dem „…“-Popover, `task-list-item-*`) erledigt ohne offene Checkliste direkt und
  zeigt an der Zeile dieselbe Rückmeldung mit „Rückgängig“; Sticky-Fenster 7 s, danach Zeilen-Abbau
  wie heute.

## AK5 — Dialogfälle unverändert

- Offene Checkliste → `CompleteTaskDialog` (gedeckt `issue-1583`), verpasste Aufgabe →
  `MissedCompleteDialog` (gedeckt `issue-1964`) — kein neuer Test (Dedup).

## AK6 — Aktualisierungstrichter

- Fürsorge-Hinweis, Herz und „Nächste Aufgabe“ aktualisieren sich im Direktpfad wie im Dialog-Pfad
  (`#2522`-Trichter `notifyTasksChanged`), Konfetti bleibt. Gedeckt durch die angepassten Specs
  `issue-2522-care-hint-refresh.spec.ts` und `issue-1182-dashboard-confetti.spec.ts` (Test-Pflege).

## AK7 — Fehlerfall inline

- Schlägt PATCH fehl, erscheint die Fehlermeldung an der Tipp-Stelle (`KolAlert _type="error"` im
  Panel-Inline-Zustand), die Aufgabe bleibt offen sichtbar.

## AK8 — Mobile 375×812

- Rückmeldung und „Rückgängig“ liegen vollständig im Viewport (Bounding-Box, kein Clip),
  „Rückgängig“ ≥ 44 px Touch-Target — auf Dashboard und in der Aufgabenliste.

## Testfälle → Tests

| AC                                  | Test                   | Datei                                             |
| ----------------------------------- | ---------------------- | ------------------------------------------------- |
| AK1 (direkt, kein Dialog)           | e2e                    | `frontend/e2e/issue-2526-complete-inline.spec.ts` |
| AK1 (verpasst → Nachfrage)          | e2e                    | dieselbe Spec                                     |
| AK2 (Rückmeldung, Rückgängig)       | e2e + Unit             | dieselbe Spec + `Dashboard.test.tsx`              |
| AK2 (vergebenePunkte im PATCH)      | Server-API             | `server/src/express/tasks-reopen-score.test.ts`   |
| AK3 (7 s Fenster, Reload endgültig) | e2e (Playwright-Clock) | dieselbe Spec                                     |
| AK4 (Liste inline + Abbau)          | e2e                    | dieselbe Spec                                     |
| AK5                                 | —                      | Dedup: `issue-1583`, `issue-1964`                 |
| AK6                                 | —                      | Dedup/Test-Pflege: `issue-2522`, `issue-1182`     |
| AK7 (inline Fehler)                 | Unit                   | `Dashboard.test.tsx`                              |
| AK8 (375×812 Bounding-Box)          | e2e                    | dieselbe Spec                                     |
| Reopen entfernt ScoreEntry          | —                      | Dedup: `tasks-reopen-score.test.ts` (#228)        |
