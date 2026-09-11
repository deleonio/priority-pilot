# Spec — Issue #1363: Lobende Push-Meldung bei Meilensteinen

Vertrag für `notifyReachedMilestones` (neues Modul `server/src/logics/milestoneNotification.ts`)
und den Aufruf im `PATCH /tasks/:id`-Handler. Quelle: KI-ANALYSE-Block im Harness-Kommentar von
Issue #1363 (AK1–AK7).

## Ziel

Erledigt ein Nutzer eine Aufgabe und überschreitet damit dadurch eine Streak- oder Punkte-Schwelle
(`berechneMeilensteine`, `server/src/logics/milestones.ts`), bekommt er bei vorhandener
Push-Subscription genau eine lobende Web-Push-Meldung je neu erreichtem Meilenstein.

## Vertrag `notifyReachedMilestones`

```
notifyReachedMilestones(userId: number, vorher: Meilenstein[], nachher: Meilenstein[], send?: PushSender): Promise<void>
```

- Bildet je `schluessel` den Übergang `erreicht: false` (vorher) → `erreicht: true` (nachher).
- Für jeden neu erreichten Meilenstein: Dedupe-Check über `NotificationLog` (`kind: 'milestone'`,
  `dedupeKey: '<userId>:<schluessel>'`). Bereits vorhanden → kein Versand.
- Sonst: `sendPushToUser(userId, payload, send)`; `payload.title`/`payload.body` nennen den
  Meilenstein, `payload.url: '/'`.
- `NotificationLog.create` NUR bei `sent > 0` (kein Versand an 0 Subscriptions sperrt den
  Meilenstein sonst dauerhaft).
- Mehrere gleichzeitig neu erreichte Meilensteine → mehrere Versände (kein Bündeln).

## Precondition / Steps / Expected result

**AK1 — Push bei neu erreichtem Meilenstein**
Vorbedingung: Nutzer mit Push-Subscription, Punktesumme knapp unter einer Schwelle (z. B. 50).
Schritt: `PATCH /tasks/:id` mit `status: 'Done'`, sodass die Schwelle überschritten wird.
Erwartung: genau ein Push-Versand, Payload nennt den Meilenstein, `url: '/'`.

**AK2 — kein Push-Opt-in**
Vorbedingung: Nutzer ohne `PushSubscription`.
Schritt: derselbe PATCH.
Erwartung: 0 Versände, PATCH bleibt 200, keine `NotificationLog`-Zeile.

**AK3 — Dedupe über Prozessgrenzen**
Vorbedingung: Meilenstein bereits einmal gemeldet (`NotificationLog`-Zeile existiert).
Schritt: derselbe Übergang erneut (z. B. Done → ToDo → Done).
Erwartung: kein zweiter Versand.

**AK4 — kein Backfill**
Vorbedingung: Meilenstein in der Vorher-Liste bereits `erreicht: true`.
Schritt: Aufruf mit dieser Vorher/Nachher-Konstellation.
Erwartung: kein Versand, kein Log.

**AK5 — mehrere Schwellen gleichzeitig**
Vorbedingung: Punktesprung, der zwei Schwellen gleichzeitig überschreitet (z. B. 0 → 300: 50 und 250).
Erwartung: zwei Versände mit unterschiedlichen `dedupeKey`s.

**AK6 — Push-Fehler bricht den PATCH nicht**
Vorbedingung: injizierter `PushSender` wirft.
Erwartung: PATCH bleibt 200, Task-JSON wird zurückgegeben.

**AK7 — Score-Rücknahme löst nichts aus**
Vorbedingung: Task ist `Done`.
Schritt: `PATCH /tasks/:id` mit `status: 'ToDo'` (Score-Rücknahme, #228).
Erwartung: 0 Versände.

## Testfälle

- TF1 (AK1), TF2 (AK2), TF6 (AK6), TF7 (AK7): API-Tests in
  `server/src/express/tasks-milestone-push.test.ts`.
- TF3 (AK3), TF4 (AK4), TF5 (AK5): Unit-Tests in
  `server/src/logics/milestoneNotification.test.ts`.

Kein e2e-/Frontend-Test: reiner Server-Code, Web-Push ist in der e2e-Umgebung ohne VAPID nicht
deterministisch prüfbar (Badges-UI liefert bereits #1362).
