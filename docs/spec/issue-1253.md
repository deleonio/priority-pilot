# Spec #1253 — Push-Benachrichtigung bei fremd angelegten Serien-Instanzen

## Ziel

Erzeugt ein Generierungslauf Instanzen einer Serie, die Konto A für Konto B angelegt hat
(`createdById` = A, `userId` = B), erhält B **höchstens eine zusammengefasste Push-Nachricht je
Serie und Lauf** — mit Serientitel, Ersteller-Anzeigename und Zahl der neuen Aufgaben. Eigene
Serien und Bestandsserien ohne Ersteller bleiben still.

## Vertrag

- **Auslöseort:** Die Benachrichtigung wird in der **Generierungslogik** angestoßen (in bzw.
  direkt über `generateDueInstances`/`materializeDueSeries`, `server/src/logics/series.ts`) —
  NICHT im Router. Damit lösen `POST /series/generate-all` und `POST /series/:id/generate`
  (sowie künftige Aufrufer) die Nachricht aus.
- **Neues Modul** `server/src/logics/seriesGeneratedNotification.ts` mit
  `notifySeriesGenerated(series, createdTasks, creator, send?)` (Muster
  `taskCreatedNotification.ts`, #1224):
  - schweigt, wenn `series.createdById == null || createdById === series.userId` (Selbst-Anlage,
    Alt-Bestand);
  - Empfänger ist `series.userId`; Ersteller-Name aus `User.displayName` (Fallback E-Mail, im
    Text „Jemand“ falls nicht ladbar);
  - Payload (Vertrag `sendPushToUser`): `title` nennt den Ersteller, `body` nennt Serientitel
    (in Anführungszeichen) und die Zahl der neuen Aufgaben, z. B.
    `Neue Aufgaben von Alice` / `„Wochenputz“: 3 neue Aufgaben.`;
  - **Dedupe** über `NotificationLog` mit eigener `kind = 'series-generated'` und
    `dedupeKey = '<seriesId>:<ersteInstanzIdDesLaufs>'` (bindet an die erzeugte Aufgabe);
    Log-Eintrag nur bei `sent > 0`.
- **Router-Injektion (AK7):** `seriesRouter` wird zur Factory `createSeriesRouter({ pushSender })`
  (Muster `createTasksRouter`, `routes/tasks.ts:407`); Mount `express/index.ts:240`.
- **Fehlisolation:** Versandfehler brechen Generierung und HTTP-Antwort nicht
  (try/catch + `console.warn`, Muster `routes/tasks.ts:530-543`). Ohne Push-Abo liefert
  `sendPushToUser` `sent = 0` → kein Log-Eintrag, Generierung/Antwort unverändert.
- **Idempotenz-Basis** bleibt `seriesOccurrence`: ein zweiter Lauf über dasselbe Fenster erzeugt
  0 Instanzen und damit gar keinen Trigger; der Dedupe ist zusätzliches Sicherheitsnetz.

## Akzeptenzkriterien (AK1–AK7)

Wie im Harness-Kommentar des Issues (Ampel 🟢): genau eine Nachricht je Serie und Lauf (AK1),
Stillheit bei Selbst-/Bestandsanlagen ohne Log-Eintrag (AK2), kein zweiter Versand bei
Wiederholungslauf, dedupeKey bindet an die erzeugte Aufgabe (AK3), Bündelung mehrerer Instanzen
zu einer Nachricht mit Anzahl (AK4), Versandfehler ohne 5xx, Fehler protokolliert (AK5),
Verlauf ohne Abo unverändert (AK6), Prüfbarkeit über `PushSender`-Injektion statt echtem
Web-Push (AK7).

## Tests

- API: `server/src/express/series-generated-notification.test.ts` (TF1–TF6, Muster
  `tasks-created-notification.test.ts`).
- Unit: `server/src/logics/seriesGeneratedNotification.test.ts` (TF7 — Dedupe-Bindung und
  Bündelung isoliert, gemocktes `send`).
