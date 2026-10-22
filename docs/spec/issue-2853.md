# Issue 2853 — Höchstens drei Pushes am Tag, gebündelt als „Dein Tag“

## Ziel

Je Nutzer und lokalem Tag gehen höchstens **drei fachliche Pushes** raus (Konzept §4). Bei mehr
Kandidaten gewinnen die höheren Vorrangstufen. Fällige Aufgaben und Top-Aufgaben werden zu **einer**
Morgen-Nachricht „Dein Tag“ gebündelt. Jede Payload trägt einen **Gruppen-Tag**, damit sich
Nachrichten derselben Gruppe in der Mitteilungszentrale ersetzen, verschiedene Gruppen sich aber
nicht verdrängen (Konzept §2.3).

## Vertrag: Budget-Tor (`server/src/logics/pushBudget.ts`, neu)

- `BUDGET_KIND = 'push-budget'` — Marker-KIND: je zugestelltem fachlichen Push entsteht eine
  `NotificationLog`-Zeile mit diesem Kind und dem lokalen Tag des Empfängers im `dedupeKey`
  (keine neue Tabelle, Konzept §4). Kein Marker bei Verdrängung und bei `sent = 0`.
- `SERVICE_KINDS: string[]` — explizite Liste der Service-Kinds (Gruppe Abo & Rechnungen, Konzept
  §7.3), heute leer; `istServiceKind(kind)` prüft dagegen. Service-Kinds zählen nicht und werden
  nie verdrängt.
- `waehleImBudget(kandidaten, freie)` — Auswahl nach Vorrang (Konzept §4, von oben nach unten):
  1. Direkt an mich gerichtet (`task-created`, `task-completed`, `series-generated`)
  2. Ortserinnerung (`geo-nearby-task`)
  3. „Dein Tag“ (`due-task`, `daily-top-tasks`)
  4. Fürsorge/Streak (`care-push`, `streak-reminder`)
  5. Erfolge/Rückblicke (`milestone`, `monthly-recap`)
  6. Tipps und Angebote (heute ohne Kind)
- `tagVon(kind)` — Gruppen-Tag je Push-Art, immer einer aus `pp-aufgaben`, `pp-fuersorge`,
  `pp-erfolge`, `pp-gruppen`, `pp-abo`, `pp-tipps`. Die Zuordnung von `geo-nearby-task` ist
  bewusst offen (Schaltergruppe „Ortung“ hat keinen eigenen Tag); getestet wird nur die Gültigkeit.
- Das Budget zählt **Marker-Zeilen** (nicht rohe Logzeilen) je Nutzer und **lokalem** Kalendertag
  (`users.zeitzone`, Fallback UTC — wie `tagIn`/`nutzerZeitzone` aus `streak.ts`). Grenze: 3.

## Vertrag: Budget-Tor im Versand (`server/src/logics/dedupedPush.ts`)

- `sendDedupedPush`/`sendDedupedPushBulk` prüfen vor dem Versand, ob das Budget des Nutzers für
  den lokalen Tag erschöpft ist: fachlicher Push bei vollem Budget → `sent: 0`, kein Versand,
  kein Fach-Log, kein Budget-Marker. Service-Kinds umgehen das Tor.
- Nach erfolgreicher Zustellung (`sent > 0`) eines fachlichen Pushes: Budget-Marker schreiben.
- Die Payload wird mit `tag: tagVon(kind)` angereichert (`PushPayload.tag?`, neu in `push.ts`).
- `sendDedupedPush` erhält wie `sendDedupedPushBulk` einen optionalen `sentAt`-Parameter
  (Default `new Date()`), damit Scheduler-Läufe ihren Tick durchreichen und Tests das Budget-Tag
  steuern können.

## Vertrag: „Dein Tag“ (`server/src/logics/dailyDigest.ts`, neu)

- `runDailyDigest(now, send?)` ersetzt die zwei getrennten Morgen-Pushes: sammelt fällige Aufgaben
  (`collectDueTaskReminders`) und Top-Aufgaben (`collectDailyTopTasks`), verschickt **genau eine**
  Payload je Nutzer im Morgenfenster (lokale Stunde 7–9, #2849). Titel: „Dein Tag“.
- URL-Regeln (Konzept §6): genau eine Aufgabe → `/tasks/<id>`; mehrere mit fälliger dabei →
  `/#karte-deadlines`; mehrere ohne fällige → `/#karte-top-aufgaben`.
- Kein zweiter Versand am selben lokalen Tag — auch nicht, wenn zwischen zwei Ticks neue fällige
  Aufgaben dazukommen (Tag-Deckel-Muster wie `dueTaskReminders.ts:131`, #2849 AK2).
- Die Verdrahtung von `startScheduler` (`server/src/index.ts:345`) auf `runDailyDigest` ist
  Umsetzungsarbeit (nicht unit-getestet).

## Kanäle

- FCM: Payload-`tag` wird als `message.android.notification.tag` gesetzt; **ohne** `tag` bleibt
  das `android`-Feld weg (bestehende `deepEqual`-Tests im `fcm.test.ts` bleiben sonst rot).
- Web (Service Worker `frontend/public/push-sw.js`): `tag: payload.tag || 'priority-pilot'` — der
  Fallback für Payloads ohne Tag bleibt.

## Erwartetes Ergebnis / Nachweis

- AK1: fünf fachliche Kandidaten an einem lokalen Tag → genau drei Sends; Auswahl nach Vorrang
  (§4); Budget-Zähler = 3; Budget folgt dem lokalen Kalendertag. → `pushBudget.test.ts` TF1.
- AK2: Service-Nachricht bei vollem Budget → Zustellung erfolgt, Budget-Zähler bleibt 3.
  → `pushBudget.test.ts` TF2.
- AK3: „Dein Tag“ — genau eine Payload je Nutzer und lokalem Tag, URL-Regeln, Wiederholungstick
  ist ein No-op. → `dailyDigest.test.ts` TF3.
- AK4: `tagVon` liefert für alle zehn Push-Arten gültige Gruppen-Tags; Payload-Anreicherung;
  FCM `android.notification.tag`; Service Worker zeigt `payload.tag` (Fallback bleibt).
  → `pushBudget.test.ts` TF4, `fcm.test.ts`, `frontend/src/lib/push-sw.test.ts`.

## Bewusste Änderungen am Bestand (Test-Pflege durch die Umsetzung)

- Bestehtende Tests, die exakte `NotificationLog.count()`-Werte je fachlichem Send prüfen, bekommen
  je Send einen zusätzlichen Budget-Marker (+1): `dedupedPush.test.ts:127`, `dueTaskReminders.test.ts:155`,
  `dueTaskReminders.test.ts:225`, `dailyTopTasks.test.ts:148`, `dailyTopTasks.test.ts:166`, `fcm.test.ts` („zählt … nur einmal“).
- `dueTaskReminders.test.ts` und `dailyTopTasks.test.ts` prüfen die zwei getrennten Morgen-Pushes
  (`url: '/'`, eigene Titel); mit der Bündelung „Dein Tag“ sind beide Dateien auf Digest-Verhalten
  umzustellen bzw. die Trigger dort zu integrieren (Pflege in der Umsetzungsphase, nicht in diesem Spec-PR).
