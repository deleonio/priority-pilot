# Spec #1971 — Ruhetag und ausgewogene Wochen in der Streak

Entscheidung (PO, 2026-10-05): Ruhetag = Kalenderwoche Mo–So in der Nutzer-Zeitzone, höchstens ein
Tag ohne Erledigung je Woche, ungenutzte Ruhetage verfallen. Woche ausgewogen = jede der drei
höchstgewichteten Säulen hat in der Woche mindestens eine Erledigung. Streak-Erinnerung entfällt am
Ruhetag. Tests: `streak.test.ts`, `streakReminder.test.ts`, `express/streak.test.ts`,
`StreakCard.test.tsx`, `e2e/issue-1360-streak.spec.ts`.

## Ruhetag in `berechneStreak` (AK1–AK3, AK9)

- **Ziel:** Ein einzelner freier Tag je Woche bricht die Tageskette nicht.
- **Regeln:** Zwei aktive Tage mit Lücke gehören zur selben Kette, wenn jede Lücke genau ein freier Tag ist und dabei
  keine Kalenderwoche (Mo–So, Nutzer-Zeitzone) zwei freie Tage zwischen aktiven Tagen der Kette enthält. Der freie Tag zählt nicht
  mit: `aktuell` und `best` sind die Anzahl aktiver Tage der Kette. Freie Tage in verschiedenen Wochen (z. B. So und Mo) sind
  zwei Ruhetage.
- **Heute offen:** Ist heute noch nichts erledigt und die Kette hielt bis gestern (gestern evtl. Ruhetag), bleibt `aktuell` > 0.
- **Nachträgliches Abhaken** (#1820, `streakZeitpunkte`) füllt weiter den Fälligkeitstag.

## `istHeuteRuhetag(aktiveTage, heute, zeitZone)` (AK6)

`true`, wenn heute keine Erledigung hat **und** in der laufenden Kalenderwoche vor heute kein freier Tag liegt.
`runStreakReminder` sendet dann keinen Push; ist der Ruhetag verbraucht, gilt das bisherige Verhalten.

## `berechneWochenAusgewogen(eintraege, saeulen, heute, zeitZone)` (AK4, AK5)

- `eintraege`: `{ zeitpunkt, saeulenIds }` (Säulen mit `share` > 0 der erledigten Aufgabe); `saeulen`: `{ id, weight }`.
- Top-Säulen: höchste drei `weight`, Gleichstand kleinere `id`; weniger als drei Säulen: alle.
- Rückgabe: Anzahl aufeinanderfolgender ausgewogener Wochen, endend an der laufenden Woche (zählt, wenn ausgewogen; bricht
  die Folge nicht, wenn offen) bzw. der Vorwoche.
- `GET /scores/streak` und `streak` in `GET /scores/balance` liefern zusätzlich `wochenAusgewogen` (nur eigene Daten).

## Anzeige (AK7, AK8)

`StreakCard` zeigt unter der Tageskette `data-testid="streak-weeks-balanced"` („x Wochen ausgewogen", Plural-Schlüssel
`streak.weeksBalanced_one/_other` in allen 10 Locales) nur bei x ≥ 1; bei 375 px bleibt sie innerhalb der Karte.
Der Hilfetext `streak.help.text` nennt den Ruhetag.
