# Spec #2305 — Warteliste: Mail bei Freischaltung mit Login-Link

Bezug: ADR 0019 (Zugang zum Launch: Warteliste), #1982 (Warteliste), `server/src/logics/accessMail.ts`.

## Ziel

Wer von der Warteliste freigeschaltet wird, erhält eine Mail mit Login-Link; der Admin sieht den Versandstatus am Eintrag.

## Vertrag

- `WaitlistEntry.accessMailStatus`: `'sent' | 'failed' | null` (`null` = nie versucht). Bestandstabellen erhalten die Spalte per Migration (`migrateWaitlistAccessMailStatusColumn`).
- `POST /admin/waitlist/:id/activate` auf einen wartenden Eintrag: Freischaltung (Status + Allowlist), danach genau eine Mail über `sendAccountAccessMail` (deutscher Betreff und Text, Magic-Link im Format `buildMagicLinkUrl`). Antwort `{ status: 'activated', accessMailStatus }`.
- `POST /admin/waitlist/activate-top`: je NEU freigeschaltetem Eintrag genau eine Mail, sequentiell; bereits freigeschaltete Einträge erhalten keine.
- `GET /admin/waitlist`: jedes Element trägt `accessMailStatus`.
- Erfolg → `sent`; Transportfehler oder fehlendes Magic-Link-Setup → `failed`. Die Freischaltung bleibt in beiden Fällen wirksam (Status `activated`, Adresse in der Allowlist).
- Erneute Einzel-Freischaltung: bei `failed` erneuter Versand und Status-Update, bei `sent` kein Zweitversand.
- Das Tageskontingent `claimAccessMailSlot` (#2041) gilt nicht.
- Sprache: Deutsch (Eintrag hat kein Sprachfeld).

## Abdeckung

AK1-AK6: `server/src/express/waitlist.test.ts` (Block „Freischalt-Mail“, Mailversand über den injizierten `mailSender`). AK7: `server/src/logics/migrate.test.ts`.
