# Spec #2231 — Erstabschluss schaltet das gebuchte Paket frei

Ziel: Mit der ersten Abbuchung (`PAYMENT.SALE.COMPLETED`) steht `User.plan` auf dem gebuchten Paket.

## Regeln

1. Der Checkout (`POST /billing/subscriptions`) legt das Abo schon mit dem Zielpaket an (`approval_pending`); `User.plan` bleibt `free`.
2. `BILLING.SUBSCRIPTION.ACTIVATED` schaltet nichts frei (keine Abbuchung, #2230).
3. `PAYMENT.SALE.COMPLETED` synchronisiert `User.plan` auf das Paket des Abos — Zahlungseingang = Freischaltung (Muster #2140).
4. Gesperrte Abos (`locked`, Admin-Sperre) bleiben gesperrt: `User.plan` bleibt `free`.
5. Ein abgelöstes Abo (`cancelled`, `plan: free`, #1912) stuft den Nutzer durch ein spätes `PAYMENT.SALE.COMPLETED` nicht herab; das Paket trägt das Nachfolge-Abo.

## Ablauf (Free → Plus)

| Schritt             | Erwartung                               |
| ------------------- | --------------------------------------- |
| Checkout            | Abo `plus`, `User.plan = free`          |
| ACTIVATED           | `User.plan = free`                      |
| SALE.COMPLETED (1.) | `User.plan = plus`, `/auth/me` → `plus` |

Tests: `server/src/express/billing-first-activation.test.ts` (Regel 2/3), `server/src/logics/paypal-payment-bound.test.ts` (Regel 4/5).
