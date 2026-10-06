# Spec #2306 — Abo: Mail bei Zahlungsausfall und bei Paketentzug

## Ziel

Der Kunde erfährt vom ersten Zahlungsausfall (mit Fristende und Link zur Zahlungsmethode) und vom
Paketentzug nach der Kulanzfrist (Abo beendet, jetzt Free). Texte folgen `docs/fuersorge-tonalitaet.md`.

## Voraussetzungen

- Mailversand ist injiziert (`mailSend?: MailSender`, Muster `invoices.ts`) — in Tests nie echter SMTP.
- Fristende = `firstFailureAt` + `GRACE_PERIOD_DAYS` (15 Tage, `billing/lifecycle.ts`).
- Ausfall-Mail nur PayPal (`applyPaymentEvent`); Entzugs-Mail für alle Anbieter (`applyDueGracePeriod`).

## Erwartetes Verhalten

- **AK1** `BILLING.SUBSCRIPTION.PAYMENT.FAILED` / `PAYMENT.SALE.DENIED` bei Abo ohne `firstFailureAt`:
  genau eine Mail an den Abo-Inhaber; Text enthält das Fristende und einen PayPal-Link.
- **AK2** Ist `firstFailureAt` bereits gesetzt, folgt keine weitere Mail.
- **AK3** `applyDueGracePeriod` mit Entzug (`true`): genau eine Mail „Abo beendet, jetzt Free"; ohne
  fällige Frist (`false`) keine.
- **AK4** Wirft der Mailversand, bleiben `past_due`/`firstFailureAt` bzw. `plan: free`/`grace_expired` erhalten.
- **AK5** Tonalität: Textprüfung im Review, kein Test.

## Test-Seam

`ApplyPaymentEventDeps.mailSend` und `GracePeriodDeps.mailSend`; Tests: `server/src/logics/billing/payment-mail.test.ts`.
