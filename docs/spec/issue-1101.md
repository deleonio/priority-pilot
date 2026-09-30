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
5. **Flanke + Tagesfenster (#1926):** Gemeldet wird eine Aufgabe nur beim **Eintritt** in den Alarmabstand: Sie liegt jetzt im Alarmabstand, die zuletzt gespeicherte Position des Nutzers (`User.lastGeoLatitude`/`lastGeoLongitude`) fehlt oder lag außerhalb des Alarmabstands dieser Aufgabe. Zusätzlich höchstens ein Push je Aufgabe in 24 h (`NotificationLog`, `sentAt >= now - 24 h`). `intervalMinutes` steuert nur noch das Client-Intervall, nicht das Dedup-Fenster.
6. **Letzte Position:** Nach jeder Auswertung wird die gemeldete Position als letzte Position gespeichert — auch ohne Push (kein Kandidat, Paket gesperrt, keine Subscription). Die Speicherung läuft innerhalb der Per-User-Serialisierung, damit parallele Meldungen dieselbe alte Position nicht doppelt als Eintritt werten.

## Erwartetes Ergebnis

- Positionsmitteilung mit nahen offenen Tasks: Push je Nutzer mit der gebündelten Payload, `NotificationLog`-Zeilen je gemeldetem Task.
- Aufenthalt oder App-Öffnen im Alarmabstand: kein Versand, auch nach > 24 h.
- Verlassen und Wiedereintritt: Versand erst, wenn der letzte Push dieser Aufgabe > 24 h zurückliegt.
- Kein Versand, wenn keine Position, keine nahen Tasks, keine Subscription oder keine Push-Konfiguration vorliegt.

## Bausteine

Der Job nutzt die bestehende Web-Push-Infrastruktur (`/push/vapid-public-key`, `/push/subscribe`, `/push/unsubscribe`, `sendPushToUser`) und den Nearby-Zugriff auf Tasks mit Koordinaten; er reproduziert sie nicht.
