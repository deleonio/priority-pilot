# Spec — Issue #1502: Feedback auch an Admins per E-Mail

Quelle: Harness-Marker-Kommentar (KI-ANALYSE, stand=2026-09-16T17:41:18Z), AK1–AK6.

## Ziel

`POST /feedback` (#1435) legt weiterhin den Obsidian-Commit an. Zusätzlich erhält jeder Nutzer
mit Rolle `admin` und gesetzter E-Mail eine Mail mit Kategorie, Titel, Beschreibung, absendendem
Nutzer und App-Version. Der Mail-Kanal ist rein ergänzend: sein Fehlen oder Fehlschlagen ändert
weder Statuscode noch Vault-Ergebnis, und umgekehrt bleibt der Mail-Versand vom Ausgang des
Obsidian-Commits unabhängig (Ticket-Formulierung, AK5).

## Erweiterter Seam

`createFeedbackRouter({ obsidianGithubClient, mailSender })` — `mailSender` ist der bestehende
`MailSender`-Typ aus `logics/mail.ts` (Muster `logics/startupStatusMail.ts:27-58`:
`User.findAll({ where: { role: 'admin' } })`, Versand je Admin über `sendMailToUser(user,
payload, send)`; Nutzer ohne `email` werden dort bereits übersprungen). `AppDeps.mailSender`
existiert bereits (`express/index.ts:71`) und wird in `express/index.ts:269` zusätzlich an
`createFeedbackRouter` durchgereicht.

## Ablauf im Router (Ergänzung zu #1435)

Nach erfolgreichem `commitFile` **und** unabhängig von dessen Ausgang (AK5) werden alle Admins
geladen und je Admin `sendMailToUser` aufgerufen — Betreff nennt Kategorie und Titel, Text enthält
Kategorie, Titel, Beschreibung, absendenden Nutzer (Session-E-Mail oder `unbekannt`) und
`readAppVersion()`. Ist `isMailConfigured()` false, wird kein Sender-Aufruf versucht (AK3). Wirft
`sendMailToUser`/der injizierte `MailSender`, bleibt Status/Commit unverändert (AK4) — kein
`SMTP_USER`/`SMTP_PASSWORD`/Tokenwert im Log.

## Akzeptanzkriterien → Testfälle

| AK  | Testfall (in `server/src/express/feedback.test.ts`, describe `#1502`)                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------ |
| AK1 | TF1 (zwei Admins + ein Member → genau zwei Mails, Commit unverändert), TF2 (Admin ohne E-Mail → kein Aufruf für ihn)           |
| AK2 | TF3 (Mailtext enthält Kategorie/Titel/Beschreibung/Nutzer/Version, kein Tokenwert)                                             |
| AK3 | TF4 (SMTP nicht konfiguriert → kein Sender-Aufruf, 201 bleibt)                                                                 |
| AK4 | TF5 (Sender rejectet → 201 bleibt, Log ohne SMTP-Zugangsdaten)                                                                 |
| AK5 | TF6 (Obsidian-Commit wirft → trotzdem Mailversand an alle Admins)                                                              |
| AK6 | bereits durch #1435-Bestandstests abgedeckt (`createBranch` von `main`, `commitFile` auf Feedback-Branch) — keine Duplizierung |

## Annahme (dokumentiert, nicht blockierend)

Das `User`-Modell hat `email` als `allowNull: false` (`models/user.ts:49`) — ein Admin „ohne
E-Mail" kann in der DB nur als leerer String (`email: ''`) abgebildet werden, nicht als `null`.
`sendMailToUser` prüft `!user.email` (falsy), das schließt `''` mit ein — TF2 nutzt deshalb
`email: ''` statt `null` als Fixture für „Admin ohne E-Mail".
