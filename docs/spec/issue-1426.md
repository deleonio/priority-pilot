# SMTP-Feature: Mail-Kanal neben Web-Push

**Stand:** 2026-09-13

## Ziel

Neben Web-Push (`logics/push.ts`) erhält der Server einen zweiten Benachrichtigungskanal per SMTP-Mail. Konfiguration ausschließlich über die Umgebung (serverweite Infrastruktur, keine Nutzer-Einstellung, kein Admin-UI). Ein Admin kann den Kanal über `POST /mail/test` prüfen; drei bestehende fachliche Trigger verschicken zusätzlich zur Push-Nachricht eine Mail.

## Konfiguration

Env-Variablen: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. `isMailConfigured()` prüft, ob die Pflichtwerte (`SMTP_HOST`, `MAIL_FROM`) gesetzt sind — Spiegel von `isPushConfigured()` in `logics/push.ts:32`.

## Baustein `logics/mail.ts` (neu)

- `MailSender` — injizierbarer Versand-Typ (Vorbild `PushSender`, `logics/push.ts:27`): `(payload: { to: string; subject: string; text: string }) => Promise<void>`.
- `isMailConfigured()` — wie oben.
- `sendMailToUser(user, payload, send?)` — verschickt an `user.email`; Nutzer ohne `email` werden übersprungen (kein Fehler, kein Log). Ein Fehler des Transports wird protokolliert, **ohne** `SMTP_USER`/`SMTP_PASSWORD` im Log-Text, und nicht erneut geworfen (Aufrufer bleibt unberührt — Spiegel `sendPushToUser`).

## Baustein `POST /mail/test` (neu, `express/routes/mail.ts`)

Nur für Admins (`requireRole('admin')`, Vorbild `routes/admin.ts`).

- Vollständige SMTP-Umgebung → `200`, Versand genau einmal mit `to` = E-Mail des angemeldeten Admins, `from` = `MAIL_FROM`.
- Unvollständige Umgebung → `503` mit deutscher Meldung, kein Versandversuch (Vorbild: 503-Gate `routes/push.ts:78`).
- Wirft der Transport → `502` mit deutscher Meldung ohne `SMTP_USER`/`SMTP_PASSWORD`; dieselben Werte erscheinen in keiner Log-Ausgabe.
- `member`-Rolle → `403`; keine Session → `401`.

## Fachliche Trigger (Erweiterung, kein neuer Kanal-`kind`)

Betroffen: `logics/dueTaskReminders.ts`, `logics/seriesGeneratedNotification.ts`, `logics/taskCompletedNotification.ts`. Push und Mail sind zwei Kanäle **derselben** Erinnerung:

- Bei konfiguriertem SMTP verschickt jeder Trigger pro Ereignis zusätzlich zur Push-Nachricht genau eine Mail an denselben Empfänger.
- Der `NotificationLog`-Eintrag wird genau einmal geschrieben, sobald **mindestens ein** Kanal zugestellt hat (`pushSent + mailSent > 0`) — kein zweiter `kind`, kein Kanal-Suffix im `dedupeKey`, sonst würde ein später konfigurierter Mail-Kanal alte Erinnerungen erneut versenden.
- Schlägt der Mail-Versand fehl, wird die Push-Nachricht dennoch zugestellt, der Lauf bricht nicht ab, der Log-Eintrag entsteht trotzdem (mindestens ein Kanal erfolgreich).
- Ohne SMTP-Konfiguration verhält sich jeder Trigger exakt wie heute: kein Mail-Versuch, Push unverändert, Log-Eintrag weiterhin genau dann, wenn Push zugestellt wurde (bereits durch die bestehenden Tests der drei Trigger-Dateien abgedeckt — kein neuer Test nötig, AK6).

## Bewusst außerhalb des Scopes

- `taskCreatedNotification.ts`, `dailyTopTasks.ts`, `milestoneNotification.ts`, `geo-background-job.ts` bleiben push-only.
- Kein Frontend-Anteil, keine Admin-Oberfläche für die Testmail.
