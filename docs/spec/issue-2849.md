# Issue 2849 — Push-Zustellung nach Empfänger-Zeitzone (stündlicher Scheduler)

## Ziel

Der Push-Scheduler tickt **stündlich** statt einmal je UTC-Tag; jedes Fenster wird **je Empfänger**
in seiner Zeitzone (`users.zeitzone`, Fallback UTC) geprüft. Zwischen 21 und 7 Uhr Ortszeit wird
kein Ereignis-Push zugestellt.

## Trigger-Fenster (lokale Stunde des Empfängers)

| Trigger                                                                                                | Fenster                                                                                        | Dedup                                                                |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `runDueTaskReminders`                                                                                  | 7–8 (07:00–08:59)                                                                              | je `taskId:deadline` **plus** höchstens 1 Push je Nutzer/lokalem Tag |
| `runDailyTopTasksPush`                                                                                 | 7–8                                                                                            | je Nutzer/lokalem Tag (bisher UTC-Tag)                               |
| `runCarePush`                                                                                          | 9–17 (ersetzt Ruhezeit 21–8)                                                                   | je Nutzer/lokalem Tag (unverändert)                                  |
| `runMonthlyRecapPush`                                                                                  | 9–17 **und** lokaler Monatstag 1–7                                                             | 1 je Monat (unverändert)                                             |
| `runStreakReminder`                                                                                    | 18–21 (unverändert)                                                                            | je lokalem Tag (unverändert)                                         |
| Ereignis-Sender (`task-created`, `task-completed`, `series-generated`, `milestone`, `geo-nearby-task`) | Ruhezeit: Stunde 21–23 oder 0–6 → **nichts** (kein Push, kein NotificationLog, kein Nachholen) | unverändert                                                          |

## Voraussetzungen

- Scheduler-Gates bleiben: Push-Kanal konfiguriert UND `PUSH_REMINDERS_ENABLED=true`.
- `PUSH_REMINDERS_HOUR` entfällt (wird nicht mehr ausgewertet).

## Erwartetes Ergebnis / Nachweis

- AK1: `startScheduler` ruft die Trigger bei jedem Tick (keine Tagesstunden-Bedingung); ohne
  Opt-in kein Timer. → `scheduler/index.test.ts` TF1.
- AK2: Morgen-Trigger nur bei lokaler Stunde 7–8, höchstens ein Push je Nutzer und lokalem Tag —
  ein Wiederholungstick mit neuer fälliger Aufgabe sendet nichts. → `dueTaskReminders.test.ts`,
  `dailyTopTasks.test.ts`.
- AK3: Fenster folgen der Empfängerzeitzone (New York: gleiche UTC-Ticks, andere lokale Stunde).
- AK4: Ereignis-Sender stellen in der Ruhezeit nichts zu und schreiben kein NotificationLog;
  07:00 lokal Zustellung wie bisher. → je Sender-Testdatei.
- AK5: Ohne/ungültige `zeitzone` gelten alle Fenster in UTC.
- AK6: `runCarePush` 9–17; `runMonthlyRecapPush` 9–17 an Monatstag 1–7, weiterhin 1/Monat.

## Bewusste Änderungen am Bestand

- `carePush.test.ts` AK2 (Ruhezeit 21–8) und AK8 sowie die `NOW`-Konstanten von
  `dailyTopTasks.test.ts` (06:00Z) und `monthlyRecapPush.test.ts` (03:00Z) werden auf das neue
  Fenster umgeschrieben (laut Analyse „bewusst mit umzuschreiben“).
- Mail-Fallback von `runDueTaskReminders` läuft im selben Trigger → künftig ebenfalls nur im
  Morgenfenster (Annahme: gewollt, derselbe fachliche Auslöser).
