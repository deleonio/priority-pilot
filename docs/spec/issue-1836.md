# Spec: Streak-Erinnerung am Abend (#1836)

## Ziel

Nutzer, deren Streak heute noch nicht gesichert ist (`berechneStreak.aktuell > 0`, letzter aktiver Tag = gestern),
erhalten am Abend **genau einen** Push „Deine N-Tage-Streak wartet" — warm, ohne Vorwurf
(`docs/fuersorge-tonalitaet.md`). Tippen öffnet die Aufgabenliste (`/aufgaben`).

## Vertrag `server/src/logics/streakReminder.ts` (neu)

- `runStreakReminder(now?: Date, send?: PushSender): Promise<{ usersNotified: number }>` — Scheduler-Trigger nach Muster `carePush.ts`, Sender injizierbar.
- Streak-Eingabe wie `routes/scores.ts:107-113` (`ScoreEntry.zeitpunkt` + `Task.deadline` → `streakZeitpunkte` → `berechneStreak`) in der Nutzer-Zeitzone.
- **Gefährdet** = `aktuell > 0` und letzter Eintrag von `aktiveTage` ≠ `tagIn(now, zone)`. Heute erledigt oder `aktuell = 0` → kein Push.
- **Schalter:** `users.carePushEnabled === false` → kein Push (gleiche Fürsorge-Kategorie, kein eigener Schalter).
- **Fenster:** lokale Stunde 18:00–20:59 der Nutzer-Zeitzone; sonst kein Push. Ungültige/fehlende Zone → `'UTC'`.
- **Dedup:** `NotificationLog` `kind: 'streak-reminder'`, `dedupeKey: '<userId>:<lokalesISO-Datum>'`, nur bei `sent > 0` (keine Subscription → kein Log, `usersNotified` 0). Unabhängig von `care-push`.
- **Payload:** `{ title, body, url: '/aufgaben' }`, Sprache `de`; `body` nennt die Streak-Länge.
- **Textkatalog:** `streakReminderText(sprache: CareSprache, streak: number): { titel: string; text: string }` — alle zehn `CARE_SPRACHEN`, nicht leer, Streak-Länge eingesetzt (Titel oder Text).
- Verdrahtung in `server/src/index.ts` (`startScheduler`-Array): bewusst ohne Test (Wiring, ADR 0001).
