# Spec — Issue #1101: Geo-Hintergrund-Job mit Push-Benachrichtigung

## Ziel

Ein serverseitiger Hintergrund-Trigger (neu: `server/src/logics/geo-background-job.ts`, nach dem
Muster von `server/src/logics/dueTaskReminders.ts` + `scheduler/index.ts`) ermittelt für Nutzer mit
bekannter Position die offenen Aufgaben im Alarmabstand und verschickt **eine gebündelte**
Push-Nachricht je Nutzer pro Lauf an alle abonnierten Clients.

**Nicht Bestandteil dieses Tickets** (bereits gebaut, siehe `#355`/`#386`/`#971`/`#1066`):
Web-Push-Infrastruktur, `/push/vapid-public-key`, `/push/subscribe`, `/push/unsubscribe`,
`sendPushToUser`, `GET /tasks/nearby`. Der Job **nutzt** diese Bausteine, er reproduziert sie nicht.

## Vertrag des neuen Moduls

| Export                                            | Bedeutung                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GEO_PUSH_INTERVAL_MS`                            | Lauf-Intervall in ms — Default `5 * 60 * 1000` (AK1). Gleichzeitig das Dedup-Fenster (AK6).                                     |
| `DEFAULT_ALARM_DISTANCE_KM`                       | Alarmabstand in km — Default `1` (AK2).                                                                                         |
| `collectGeoPushGroups(positions, now)`            | Ermittelt je Nutzer die offenen Tasks im Alarmabstand zur übergebenen Position, inkl. `distanceKm`.                             |
| `runGeoPushNotifications(positions, send?, now?)` | Versendet je Nutzer **eine** aggregierte Payload und protokolliert je Task einen `NotificationLog` (`kind: 'geo-nearby-task'`). |

`positions` wird als Parameter injiziert (`{ userId, lat, lon }[]`): die Speicherung der
Nutzerposition (Vorläufer von #1098) ist hier bewusst **nicht** Teil des Vertrags — der Job hängt
nur an der Schnittstelle, nicht am Speicherort. Der Versand läuft über `sendPushToUser`
(`server/src/logics/push.ts`), `send` ist wie dort injizierbar.

## Ablauf

1. **Intervall (AK1):** der Job läuft alle `GEO_PUSH_INTERVAL_MS` (Default 5 min).
2. **Auswahl (AK2):** offene Tasks (`status != 'Done'`) **mit** Koordinaten im Umkreis von
   `DEFAULT_ALARM_DISTANCE_KM` der Nutzerposition (Haversine wie `routes/tasks.ts:336`); Tasks ohne
   Koordinaten, erledigte und fremde Tasks erscheinen nie.
3. **Versand (AK3):** je Nutzer **eine** aggregierte Payload (nicht eine je Task — der Service
   Worker ersetzt über `tag: 'priority-pilot'` ohnehin aufeinanderfolgende Pushes,
   `frontend/public/push-sw.js:29-32`), zugestellt an **alle** Subscriptions des Nutzers
   (Datenisolation über `ownerScope`).
4. **Inhalt (AK5):** Payload bleibt im SW-Kontrakt `{ title, body?, url? }`
   (`server/src/logics/push.ts:19-26`), keine neuen Felder.
   - 1 Task: `title` = Aufgabentitel, `body` = Entfernung im `formatKm`-Format (de-DE, eine
     Nachkommastelle, „0,4 km" — Konvention aus `frontend/src/components/NearbyCard.tsx:22-24`),
     `url` = Deep-Link, der die Task-ID enthält (kein generisches `/`).
   - n Tasks: `title` nennt die Anzahl, `body` listet Titel mit Entfernung, `url` = Übersicht.
5. **Dedup (AK6):** ein Task, der innerhalb des letzten Intervalls bereits gemeldet wurde, wird
   nicht erneut gemeldet — `NotificationLog` mit eindeutigem `dedupeKey` je Task und Fenster
   (Muster: `dueTaskReminders.ts`, Unique-Index `models/notificationLog.ts`). Innerhalb des Fensters
   kein erneuter Versand, nach Ablauf des Fensters wieder keiner ausgeschlossen.

## Erwartetes Ergebnis

- Erster Lauf: Push je Nutzer mit nahen offenen Tasks; `NotificationLog`-Zeilen je gemeldetem Task.
- Zweiter Lauf im selben Intervall: kein Versand (Dedup), kein neuer Log-Eintrag.
- Lauf nach Ablauf des Intervalls: Versand erneut (Dedup-Fenster abgelaufen).
- Kein Versand, wenn keine Position, keine nahen Tasks oder keine Subscription existiert.

## Abdeckung / bewusste Auslassungen

- **AK4 ist bereits durch `server/src/express/push.test.ts` abgedeckt** (subscribe/unsubscribe,
  Idempotenz, 400/503, Datenisolation `push-dataisolation.test.ts`) → keine Duplikate.
- `sendPushToUser` für sich ist durch `server/src/logics/push.test.ts` abgedeckt; die neuen Tests
  prüfen nur die Job-seitige Nutzung (Aggregation, Isolation, Inhalt).
- **TF5 (E2E)** ist nicht umsetzbar: ein echter Web-Push-Zyklus (VAPID-Keys, Push-Dienst,
  Service-Worker-Registrierung) ist in Playwright nicht deterministisch abbildbar — dieselbe
  Begründung steht im Kopf von `frontend/e2e/pwa-update-prompt.spec.ts`. Verwiesen wird auf
  `frontend/e2e/issue-1061-task-address.spec.ts` (Nearby-Anzeige), die das Client-seitige
  Distanzformat bereits sichert. → offene Frage im Spec-PR.
