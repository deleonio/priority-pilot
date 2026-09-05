# Issue #1224 — Benachrichtigung, wenn jemand eine Aufgabe für mich anlegt

## Ziel

Legt ein Gruppenmitglied A eine Aufgabe für Konto B an, erhält B (sofern Push-Nachrichten
aktiviert, d. h. mindestens ein `PushSubscription`-Eintrag) genau eine Push-Nachricht, die den
Aufgabentitel und den Anzeigenamen von A nennt. Der Versand ist an den `POST /tasks`-Aufruf
gekoppelt (kein Scheduler-Eintrag), darf das Anlegen weder blockieren noch fehlschlagen lassen
und wird über eine eigene `NotificationLog`-`kind` dedupliziert.

## Vertrag

- Neues Logik-Modul `server/src/logics/taskCreatedNotification.ts` (z. B. `notifyTaskCreated`),
  aufgerufen aus dem `POST /tasks`-Handler (`server/src/express/routes/tasks.ts`) **nach** dem
  erfolgreichen Commit der Transaktion.
- Eigene `kind` `'task-created'`, `dedupeKey` = Task-Id → dedupliziert gegen `due-task` /
  `daily-top-tasks`, deren Schlüssel unverändert bleiben.
- Versand über `sendPushToUser` (`server/src/logics/push.ts`), Payload `{title, body?, url?}`;
  Text nennt `task.title` und `requester.displayName` (`User.displayName`, models/user.ts).
- Testbarkeit: der Tasks-Router erhält den `PushSender` über `AppDeps` (Fabric nach dem
  `createPushRouter`-Vorbild); Tests injizieren einen Mock über `startTestServer({ pushSender })`
  (`server/src/test/helpers.ts:119`) — kein echter Web-Push, keine VAPID-Konfiguration nötig.
- #1213-Verhalten (Empfänger-Prüfung 403, `recipientId`/`requesterId`, Transaktion, Task-DTO)
  bleibt unberührt.

## Ablauf und erwartetes Ergebnis

1. **AK1 — Empfänger wird benachrichtigt.** A (Alice, `displayName: 'Alice Erstellerin'`) legt per
   `POST /tasks` mit `userId` = B (Bob, gemeinsame Gruppe) eine Aufgabe an; B hat Push-Abos.
   Erwartet: je Abo **genau ein** Versand (2 Abos → genau 2 Aufrufe mit unterschiedlichen
   Endpoints); die Payload nennt den Aufgabentitel und den Anzeigenamen von A.
2. **AK2 — Selbst-Anlage ohne Nachricht.** A legt ohne `userId` oder mit der eigenen ID an.
   Erwartet: kein Versand an A, kein `NotificationLog`-Eintrag zur Aufgabe.
3. **AK3 — Empfänger ohne Abo.** B hat kein `PushSubscription`-Eintrag. Erwartet: `POST /tasks`
   antwortet 201, die Aufgabe ist in Bs Liste, kein Fehler.
4. **AK4 — Versandfehler.** Der injizierte `PushSender` wirft. Erwartet: Aufgabe trotzdem
   angelegt, `POST /tasks` antwortet 201, der Fehler wird serverseitig protokolliert, nicht an
   den Aufrufer durchgereicht. Die 201-Antwort hängt nicht am Push-Ergebnis.
5. **AK5 — Dedupe.** `NotificationLog`-Eintrag mit `kind='task-created'` und `dedupeKey` = Task-Id
   (Unique-Index `kind`+`dedupeKey`, notificationLog.ts:52). Ein erneuter Auslöser für dieselbe
   Aufgabe sendet nicht erneut; eine zweite Aufgabe (zweiter POST) erhält ihre eigene Nachricht —
   die Dedupe gilt pro Aufgabe, nicht global pro Nutzer.
6. **AK6 — Testbarkeit ohne VAPID.** Der komplette Ablauf läuft über die `AppDeps.pushSender`-
   Injektion, ohne dass Web-Push konfiguriert ist (`isPushConfigured() === false`) — der neue
   Codepfad darf nicht hinter dem 503-Konfigurations-Gate der Push-Endpunkte hängen.

## Testfälle (rot, bis implementiert)

Datei: `server/src/express/tasks-created-notification.test.ts` (Gerüst wie
`tasks-created-by.test.ts`: Alice/Bob/Carol, Gruppe direkt am Modell geseedet, `startTestServer`).

- **TF1 (AK1):** Alice POST mit `userId: bobId`, Bob mit 2 Abos → Mock genau 2× aufgerufen (je
  Endpoint 1×), Payload enthält Titel und „Alice Erstellerin".
- **TF2 (AK2):** Alice POST ohne `userId` und mit eigener ID → Mock 0×, kein `NotificationLog`-
  Eintrag (`kind='task-created'`).
- **TF3 (AK3):** Bob ohne Abo → 201, Aufgabe in Bs `GET /tasks`, Mock 0×.
- **TF4 (AK4):** Mock wirft → 201, Aufgabe vorhanden, Protokoll-Ausgabe (console.warn/error)
  erfolgt, keine 5xx-Antwort.
- **TF5 (AK5):** Nach AK1-artigem Versand existiert genau eine `NotificationLog`-Zeile
  (`kind='task-created'`, `dedupeKey` = String(Task-Id)); ein zweiter POST legt eine zweite
  Aufgabe mit eigenem `dedupeKey` an und sendet erneut (Dedupe pro Aufgabe).
- **TF6 (AK6):** Ohne `VAPID_*`-Umgebung (`isPushConfigured() === false`) wird der Versand über
  den injizierten Mock dennoch ausgelöst.

## Offene Fragen

- keine.
