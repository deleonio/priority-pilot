# Geo-Push: gebündelte Nähe-Benachrichtigung

**Stand:** 2026-08-30

## Ziel

Meldet ein Client die aktuelle Geräteposition, prüft der Server die offenen Aufgaben im Alarmabstand und verschickt **eine gebündelte** Web-Push-Nachricht je Nutzer an alle abonnierten Clients.

## Ablauf

1. **Positionsmitteilung:** Der Client meldet jede ermittelte Position an `POST /geo/position` (`lat`/`lon`, auth-pflichtig — ohne Session 401 „Anmeldung erforderlich."; Koordinaten außerhalb der gültigen Bereiche → 400). Der Versand läuft Fire-and-forget: die Antwort (204) wartet nicht auf den Push, ein Push-Fehler blockiert die Positionsbehandlung nicht.
2. **Auswahl:** offene Tasks (Status ≠ „Done") **mit** Koordinaten im Umkreis des Alarmabstands (Default 1 km, `DEFAULT_ALARM_DISTANCE_KM`) zur gemeldeten Position (Haversine). Tasks ohne Koordinaten, erledigte und fremde Tasks erscheinen nie.
3. **Versand:** je Nutzer **eine** aggregierte Payload (nicht eine je Task — der Service Worker ersetzt über `tag: 'priority-pilot'` aufeinanderfolgende Pushes), zugestellt an **alle** Subscriptions des Nutzers (Datenisolation über `ownerScope`).
4. **Inhalt:** Die Payload bleibt im Service-Worker-Vertrag `{ title, body?, url? }`.
   - 1 Task: `title` = Aufgabentitel, `body` = Entfernung im de-DE-Format mit einer Nachkommastelle („0,4 km"), `url` = Deep-Link auf die Aufgabe (`/tasks/{id}`).
   - n Tasks: `title` = „{n} Aufgaben in der Nähe", `body` = Liste „Titel (Entfernung)", `url` = Deep-Link auf die nächstgelegene Aufgabe.
5. **Dedup:** Ein Task, der innerhalb des letzten Intervallfensters (Default 5 Minuten, `GEO_PUSH_INTERVAL_MS`) bereits gemeldet wurde, wird nicht erneut gemeldet — `NotificationLog` mit eindeutigem `dedupeKey` je Task und Fenster (Unique-Index `kind + dedupeKey`). Innerhalb des Fensters kein erneuter Versand, nach Ablauf des Fensters wieder keiner ausgeschlossen.

## Erwartetes Ergebnis

- Positionsmitteilung mit nahen offenen Tasks: Push je Nutzer mit der gebündelten Payload, `NotificationLog`-Zeilen je gemeldetem Task.
- Erneute Mitteilung im selben Intervallfenster: kein Versand, kein neuer Log-Eintrag.
- Mitteilung nach Ablauf des Fensters: Versand erneut.
- Kein Versand, wenn keine Position, keine nahen Tasks, keine Subscription oder keine Push-Konfiguration vorliegt.

## Bausteine

Der Job nutzt die bestehende Web-Push-Infrastruktur (`/push/vapid-public-key`, `/push/subscribe`, `/push/unsubscribe`, `sendPushToUser`) und den Nearby-Zugriff auf Tasks mit Koordinaten; er reproduziert sie nicht.
