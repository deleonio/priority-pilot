# Job-eigene Fehler-Labels im Intervall-Scheduler

**Stand:** 2026-10-14

## Ziel

Jeder Intervall-Job, der über den generischen Intervall-Starter (`startIntervalScheduler`, `server/src/scheduler/index.ts`) gestartet wird, loggt Fehler unter seinem **eigenen** Namen — nicht unter dem festen Text `Kalender-Abruf fehlgeschlagen:`. Wirft der Kulanzfrist-Sweep, nennt die Fehlerzeile den Sweep (Billing), nicht den Kalender-Abruf.

## Voraussetzungen

- Der Starter wird generalisiert und nimmt ein Label entgegen (z. B. `startIntervalScheduler(label, trigger, intervalMs)`); der Kalender-Abruf behält seinen bisherigen Fehlertext (`Kalender-Abruf fehlgeschlagen:`).
- Muster ist `wireTicker`, der bereits einen Tick-Namen für die Fehlermeldung entgegen nimmt.
- Timer-Verhalten bleibt unverändert: `unref`, Stop-Handle, weiterer Tick nach Fehlschlag.

## Verhalten

1. **AK1 — Job-eigenes Label:** Wirft ein Trigger im Intervall-Job, wird genau eine Fehlerzeile mit dem Job-eigenen Label geloggt (Muster `<Label> fehlgeschlagen:` plus Fehler). Für den Kulanzfrist-Sweep enthält die Zeile den Sweep-Namen und **nicht** `Kalender-Abruf`.
2. **AK2 — Kalender bleibt Kalender:** Fehler des Kalender-Abrufs (`runCalendarSync`) tragen weiterhin das Label `Kalender-Abruf fehlgeschlagen`.
3. **AK3 — Call-Sites:** Alle vier Call-Sites in `server/src/index.ts` (Kalender-Abruf, Serien-Automatik, Kulanzfrist-Sweep, PayPal-Abgleich) übergeben ihr eigenes Label; kein Aufruf verbleibt beim festen Kalender-Text. Statisch — Absicherung über den AK1/AK2-Vertrag plus Review-Grep (`startCalendarSyncScheduler` ohne Resttreffer).
4. **AK4 — Robustheit:** Nach einem fehlerhaften Lauf feuert der Timer im nächsten Intervall erneut; `stop()` beendet ihn endgültig (bestehendes Verhalten).

## Erwartetes Ergebnis

- Kulanzfrist-Sweep-Fehler: Log-Zeile mit Sweep-/Billing-Namen, ohne `Kalender-Abruf`.
- Kalender-Fehler: Log-Zeile mit `Kalender-Abruf fehlgeschlagen` wie bisher.
- Timer läuft nach Fehlern weiter und lässt sich per `stop()` beenden.

## Testfälle

- TF1 (`server/src/scheduler/index.test.ts`): Starter mit werfendem Trigger und Kulanzfrist-Label → genau eine Fehlerzeile mit Sweep-Namen, ohne `Kalender-Abruf`.
- TF2 (gleiche Datei): werfender Trigger mit Kalender-Label → Fehlerzeile enthält `Kalender-Abruf fehlgeschlagen`.
- TF3 (gleiche Datei): nach fehlerhaftem Lauf feuert der nächste Tick; `stop()` beendet den Timer.

Der Kalender-Abruf hat das Label `Kalender-Abruf` für `runCalendarSync` dauerhaft inne — die anderen drei Jobs (Serien-Automatik, Kulanzfrist-Sweep, PayPal-Abgleich) erhalten eigene Namen.
