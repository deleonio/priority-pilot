# Streak: verspätet erledigte Aufgaben füllen ihren Fälligkeitstag

## Ziel

Ein laufender Streak bricht nicht mehr, nur weil eine Aufgabe erst nach ihrer Fälligkeit abgehakt wurde.

## Regel

- `streakZeitpunkte(eintraege, zeitZone)` (`server/src/logics/streak.ts`) liefert je Eintrag `zeitpunkt`; ist der Eintrag verspätet (`tagIn(deadline, zeitZone) < tagIn(zeitpunkt, zeitZone)`), zusätzlich die `deadline`.
- `berechneStreak` bleibt unverändert; `GET /scores/streak`, `GET /scores/milestones` und die Meilenstein-Meldung in `tasks.ts` nutzen den Helfer.
- Der Abhake-Tag zählt weiterhin. Pünktliche Erledigungen und Tasks ohne `deadline` ändern nichts.

## Beispiel

Aktiv vorgestern, Task gestern fällig, heute erledigt ⇒ `aktuell` = 3.
