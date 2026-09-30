# Spec #1819 — Streak-Karte: Hilfetext zur Zählregel

## Ziel

Die Streak-Card (`data-testid="streak-card"`) erklärt in 1–2 Sätzen, wie der Streak zählt und wann er reißt. Maßgeblich ist `server/src/logics/streak.ts` (seit #1820), nicht der ältere Ticket-Hinweis „Fälligkeit spielt keine Rolle".

## Vorbedingung

Streak geladen (`GET /scores/streak`), egal ob `aktuell > 0` oder `aktuell === 0`.

## Schritte / erwartetes Ergebnis

1. Unter der Bestmarke steht ein zugeklapptes `KolDetails` mit Label `streak.help.label` („So zählt der Streak"). Tippen/Enter klappt es auf.
2. Inhalt (`data-testid="streak-help"`), Text `streak.help.text`: Ein Tag zählt, wenn mindestens eine Aufgabe abgehakt wird; verspätet Erledigtes zählt auch den Fälligkeitstag; Streak = ununterbrochene Folge bis heute oder gestern; Lücke bis gestern setzt auf 0, die Bestmarke bleibt.
3. Beide Schlüssel liegen im Namespace `common` in allen 10 Sprachen (`frontend/src/i18n/locales/*/common.json`, Pfad `streak.help`), nicht leer.
4. Bei 375 px bleibt der aufgeklappte Text innerhalb der Card (Bounding-Box).

## Tests

- `frontend/src/components/StreakCard.test.tsx` — AK1/AK3 (beide Zustände), AK2 (Schlüssel in 10 Sprachen).
- `frontend/e2e/issue-1360-streak.spec.ts` — AK1/AK4 (375 px).
