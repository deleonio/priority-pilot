# Spec #2767 — App: Erledigt-Feedback nach „Wieder öffnen“ räumen

Teil von #2765. Ursache (im Code verifiziert): das Reopen aus der Erledigt-Tabelle
(`CompletedTasksTable.tsx:92-103`) ruft nur die API und `onReloaded()`; das App-seitige
`doneFeedback` ([App.tsx:265](../../frontend/src/App.tsx)) wird nicht geräumt — nur der
Reopen-Pfad des Toggles räumt taskId-genau ([App.tsx:1053](../../frontend/src/App.tsx)). Der
stale State rendert in der wieder geöffneten Zeile „+X Punkte · Streak N“ samt „Rückgängig“;
ein Klick darauf erledigt erneut und vergibt erneut Punkte.

## Ziel

Nach „Wieder öffnen“ aus der Erledigt-Tabelle trägt die offene Zeile keine
Erledigungs-Rückmeldung mehr; kein Klick kann eine wieder geöffnete Aufgabe erneut erledigen.
Das Undo-Feedback existiert nur im 7-Sekunden-Fenster direkt nach einer echten Erledigung
(ADR 0024, `DONE_UNDO_WINDOW_MS`).

## AK1 — Zeilen-Rückmeldung nach Reopen geräumt

- Voraussetzung: Aufgabe per Toggle/„…“-Popover erledigt (Zeilen-Rückmeldung „+X Punkte“ mit
  „Rückgängig“ sichtbar), 7-s-Fenster abgelaufen (Auto-Reload baut die Zeile ab, die Aufgabe
  erscheint in der Erledigt-Tabelle).
- Schritt: „Wieder öffnen“ in der Erledigt-Tabelle; Umschalter zurück auf „Offen“.
- Erwartet: Die offene Zeile zeigt weder Punkte-Feedback („+X Punkte“) noch Streak-Angabe noch
  „Rückgängig“ — die dauerhaft im DOM stehende Live-Region `.task-tree-done-feedback`
  (Fixup #2572) ist leer.

## AK2 — kein Undo mehr, Punktestand unverändert

- Erwartet: Für die wieder geöffnete Aufgabe existiert kein steuerbares „Rückgängig“-Element
  mehr; die Punktesumme (`GET /scores`) ist nach dem Reopen gleich der vor der Erledigung.
  (Der Server entfernt den ScoreEntry beim Wieder-Öffnen selbst — gedeckt durch
  `tasks-reopen-score.test.ts`; der E2E-Spiegel sichert zusätzlich den UI-Pfad gegen
  Doppelvergabe.)

## AK3 — regulärer Erledigen-Moment unverändert (Dedup)

- Toggle/Popover in der Aufgabenliste, Dashboard-Karte (Signal-Panel) und Erledigen-Dialog
  zeigen die Inline-Rückmeldung unverändert wie heute, inkl. funktionierendem „Rückgängig“ im
  7-Sekunden-Fenster — gedeckt durch `issue-2526-complete-inline.spec.ts` (AK2 Panel mit
  funktionierendem Undo, AK4 Liste mit Rückmeldung + Undo im Fenster). Kein neuer Test; die
  neuen Specs sichern den Erledigen-Moment als Positiv-Kontrolle im selben Ablauf ab.

## AK4 — Mobile 375×812

- AK1 gilt unverändert am Mobil-Viewport: nach „Wieder öffnen“ trägt die offene Zeile keine
  Rückmeldung (die Erledigt-Tabelle ist mobil auf Titel + Aktion reduziert, #1258 — der
  „Wieder öffnen“-Button bleibt rollen-basiert erreichbar).

## Tests

- TF1/TF2: `frontend/e2e/issue-2767-reopen-clears-feedback.spec.ts` (Desktop; AK1 + AK2 in
  einem Ablauf, Clock-Fast-Forward über das 7-s-Fenster wie `issue-2526-complete-inline.spec.ts`).
- TF3: dieselbe Spec mit 375×812 (AK4).
- Kein Server-Test — reines Frontend-Verhalten.
- KoliBri: keine neuen Komponenten; die Locators (KolToolbar-Button „Wieder öffnen“,
  KolButton „Rückgängig“, Umschalter „Erledigte Aufgaben anzeigen“) sind durch die grünen
  Specs `completed-tasks.spec.ts` und `issue-2526-complete-inline.spec.ts` verifiziert.
