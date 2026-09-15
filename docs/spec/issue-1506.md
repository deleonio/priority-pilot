# Spec — Issue #1506: T6e Zahlungsereignisse verarbeiten (Rechnung je Periode, Kulanzfrist)

Teil-Issue T6e von #1461 (T6), baut auf #1495 (T6b, `logics/paypal.ts` + `logics/invoices.ts`) und
#1505 (T6d, `graceUntil`-Platzhalter in `GET /auth/me`, konstant `null`). Erweitert die bestehende
Webhook-Verarbeitung um Zahlungsereignisse (statt nur Kündigung/Planwechsel) und macht die
Kulanzfrist bei Zahlungsausfall wirksam.

## Neue/geänderte Verträge (für die Impl-Phase)

- `server/src/models/subscription.ts` — neues, nullable Feld `firstFailureAt: Date | null`
  (AK8). Kein Betrags-/Zahlungsfeld — einziger Modellzuwachs dieses Issues.

- `server/src/logics/paypal.ts`:
  - `GRACE_PERIOD_DAYS` von `14` auf `15` (AK5). Der Doc-Kommentar von `isGracePeriodExpired`
    („Tag 14 noch innerhalb … ab Tag 15 abgelaufen") wird auf Tag 15/16 gezogen.
  - Neue Funktion `applyPaymentEvent(subscription, event, now, deps?): Promise<void>` (Vorbild
    `applyPlanChange`) mit `deps: { issueInvoice?: (subscription, now) => Promise<unknown> }`:
    - `PAYMENT.SALE.COMPLETED` (ersatzweise `BILLING.SUBSCRIPTION.ACTIVATED`) → `currentPeriodEnd`
      um genau einen Zeitraum gemäß `subscription.period` verschieben (`monthly` +1, `quarterly`
      +3, `yearly` +12 Monate — Muster `invoices.ts` `PERIOD_MONTHS`), `status: 'active'`,
      `firstFailureAt: null`, danach `deps.issueInvoice?.(subscription, now)` aufrufen (AK1).
    - `BILLING.SUBSCRIPTION.PAYMENT.FAILED` → nur wenn `firstFailureAt` noch nicht gesetzt ist:
      `firstFailureAt = now`, `status: 'past_due'`. Ist es bereits gesetzt, bleibt es unverändert
      (AK3) — kein erneutes Anstoßen der Frist durch einen zweiten Fehlschlag.
    - `BILLING.SUBSCRIPTION.SUSPENDED` → `status: 'suspended'`, `firstFailureAt` unverändert
      (AK4) — die Frist läuft unabhängig vom PayPal-eigenen Status weiter.
    - Unbekannter Ereignistyp → No-Op.
  - Neue Funktion `applyDueGracePeriod(subscription, now): Promise<boolean>` (Vorbild
    `applyDuePendingPlan`): ist `firstFailureAt` gesetzt und `isGracePeriodExpired(firstFailureAt,
now)` wahr, wird `status: 'grace_expired'` gesetzt und `firstFailureAt` auf `null` zurückgesetzt
    (AK6). `plan` bleibt unverändert (der Downgrade selbst ist T7, #1462). Ohne fällige Frist ein
    No-Op (liefert `false`).

- `server/src/express/routes/billing.ts`:
  - `BillingDeps` bekommt `mailSender?: MailSender` (Muster `paypalVerifier`); Tests injizieren
    einen Fake, damit `issueInvoiceForPeriod` nicht den echten SMTP-Transport erreicht.
  - Die Abo-Suche vor `applyPlanChange` erweitert sich um den Fallback
    `event.resource?.billing_agreement_id` (zusätzlich zum bisherigen `event.resource?.id`) —
    Zahlungsereignisse tragen die Abo-Referenz unter `billing_agreement_id`.
  - Nach `applyPlanChange(subscription, event, now)` zusätzlich
    `applyPaymentEvent(subscription, event, now, { issueInvoice: (s, n) =>
issueInvoiceForPeriod(s, n, deps.mailSender) })` aufrufen.
  - `index.ts` reicht `deps.mailSender` beim Mounten von `createBillingRouter` durch (zusätzlich zu
    `paypalVerifier`).

- `server/src/express/routes/auth.ts` — vor dem Befüllen des `subscription`-DTOs zusätzlich zu
  `applyDuePendingPlan` auch `applyDueGracePeriod(dbSubscription, new Date())` aufrufen. Das Feld
  `graceUntil` wird berechnet: `firstFailureAt` gesetzt → `firstFailureAt + GRACE_PERIOD_DAYS Tage`,
  sonst `null` (AK7) — durch das Zurücksetzen von `firstFailureAt` in `applyDueGracePeriod` ist der
  Wert nach Fristablauf automatisch wieder `null`.

## Akzeptanzkriterien → Tests

- AK1, AK2, AK3, AK4 → `server/src/express/billing.test.ts` (neue Describe-Gruppe „#1506")
- AK5 → `server/src/logics/paypal.test.ts` (bestehende Tag-14/15-Fälle auf Tag-15/16 gezogen —
  Test-Pflege-Bedarf, s. PR-Body)
- AK6, AK7 → `server/src/express/auth.test.ts` (relative Zeitstempel um den Testlaufzeitpunkt,
  kein injizierbarer Server-Takt vorhanden)
- AK8 → `server/src/models/subscription.test.ts`

## Offene Fragen (aus dem Analyse-Block, nicht spec-blockierend)

- Keine.
