# Spec #2070 — Erststart-Flow Abschluss (Startgewichtung, Abschluss-Karte, Beispielaufgaben, Wiedereinstieg)

## Ziel

Der Erststart-Flow (Basis #2069) wird um Startgewichtung und Abschluss-Erlebnis erweitert: Flow erst
nach erfolgreicher Gewichtung abschließbar, Abschluss-Karte mit direkt abhakbarer nächster Aufgabe und
Balance-Hinweis, leeres Dashboard mit abhakbaren Beispielaufgaben, Wiedereinstieg ohne Datenverlust.

## Vertrag

### AK1 — Startgewichtung als eigener Schritt (dynamische Schritt-Anzeige)

- Vorher: 3 Schritte (1 Freitext, 2 Vorschläge, 3 Zusammenfassung), Anzeige „Schritt {{step}} von 3“ hart.
- Nachher: 4 Schritte — als Schritt 3 kommt die **Startgewichtung** (`PillarWeightsForm` eingebettet,
  ohne `onCancel`, ohne Modal-Rahmen), danach Schritt 4 = Zusammenfassung/Apply.
- Ohne gespeicherte Gewichtung kein `Übernehmen`: der Button taucht erst nach dem Gewichtungsschritt auf.
- Schritt-Anzeige zählt dynamisch mit: „Schritt 1 von 4“ … „Schritt 4 von 4“.
- `PillarWeightsForm` bleibt unverändert geteilt (Settings + Modal) — keine Regression; der #1574-
  Bestätigungsdialog bei starker Unausgewogenheit bleibt.

### AK2 — Abschluss-Karte

- Nach erfolgreichem Apply bleibt der Flow **offen** (`onClose` nicht sofort) und zeigt eine Karte:
  - nächste Aufgabe (= oberste übernommene; ohne eigene Aufgaben die erste Beispielaufgabe) als direkt
    abhakbare Checkbox-Zeile (Schritt-2-Muster),
  - Balance-Hinweis als Fließtext mit Bezugsgröße („stärkste Säule mit X %“),
  - sekundär „Fertig“ → beendet den Flow (`onClose`; App navigiert zum Aufgaben-Tab).
- Kein Auto-Navigate weg von der Karte; Haken sofort sichtbar.

### AK3 — Beispielaufgaben im Leerzustand

- `EmptyState` zeigt (immer bei leerem Dashboard) mindestens drei abhakbare Beispielaufgaben als Gruppe
  mit Gruppen-Beschriftung „Beispiele zum Ausprobieren“.
- Rein lokal/virtuell: **kein** api-Call je Haken (Spy im Unit-Test), auf dem Server entsteht keine Aufgabe.

### AK4 — Wiedereinstieg ohne Datenverlust

- Die Leerzustand-Karte heißt „Was beschäftigt dich gerade?“ (Wortlaut der Schritt-1-Überschrift) und
  bietet „Flow fortsetzen“ → `onReenter` (App hält den Flow-Zustand über dem Remount, kein localStorage).
- Abbruch in Schritt 2 + Wiedereinstieg: Freitext und Auswahl stehen wieder.

### AK5 — 375 px (e2e, Implementierungsphase)

- Abschluss-Karte und Beispielaufgaben bedienbar, kein horizontales Abschneiden — Bounding-Box-Prüfung
  (`x + width <= Viewport`), nicht `scrollWidth` (App-Shell clippt `overflow-x`).

## Testabdeckung

| TF              | Ebene                                      | Datei                                                                       | AK                                                                                   |
| --------------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| TF1/TF2/TF3/TF5 | e2e `frontend/e2e/onboarding-flow.spec.ts` | —                                                                           | AK1–AK3, AK5 — **folgt im Impl-/Nachlauf** (dieser Lauf: Unit zuerst, Soft-Deadline) |
| TF6a            | Vitest `OnboardingFlow.test.tsx`           | Schrittfolge inkl. Gewichtungsschritt, „von 4“, kein `Übernehmen` vor Apply | AK1                                                                                  |
| TF6b            | Vitest `OnboardingFlow.test.tsx`           | Abschluss-Karte: offen bleiben, nächste Aufgabe, Balance-Hinweis, „Fertig“  | AK2                                                                                  |
| TF6c            | Vitest `EmptyState.test.tsx`               | ≥3 Beispielaufgaben, Gruppen-Label, keine api-Calls                         | AK3                                                                                  |
| TF6d            | Vitest `EmptyState.test.tsx`               | Karte „Was beschäftigt dich gerade?“ + „Flow fortsetzen“ → `onReenter`      | AK4                                                                                  |
