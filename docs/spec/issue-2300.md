# Spec #2300 — Täglicher Abgleich der PayPal-Abos

Ziel: Verpasste Webhooks (Kündigung, Verlängerung, nie bestätigter Checkout) werden nachgezogen.
Webhooks bleiben der primäre Weg (ADR 0013); der Abgleich korrigiert nur.

## Vertrag

- `PaypalClient.getSubscription(id)` → `GET /v1/billing/subscriptions/{id}`, Rückgabe
  `{ status, nextBillingTime? }` (`status` = PayPal-Status, `nextBillingTime` = `billing_info.next_billing_time`).
  Antwort 404 → wirft `PaypalHttpError` mit `status` 404.
- `reconcilePaypalSubscriptions(now, deps: { getSubscription })` in `billing/lifecycle.ts`, gibt die Anzahl der Korrekturen zurück.
- Kandidaten: nur `provider = 'paypal'`; (a) `status = 'active'` mit `currentPeriodEnd` mehr als 3 Tage vor `now`;
  (b) `status = 'approval_pending'` mit `createdAt` älter als 1 h. Alle anderen werden nicht abgefragt.

## Ablauf je Kandidat

| Fall | PayPal-Antwort                     | Ergebnis lokal                                                                  |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------- |
| (a)  | `CANCELLED`/`EXPIRED`/`SUSPENDED`  | Status `cancelled`, `plan` `free`, `User.plan` per `syncUserPlan` neu berechnet |
| (a)  | `ACTIVE`                           | `currentPeriodEnd` = `nextBillingTime`, Plan bleibt                             |
| (b)  | nicht `ACTIVE`/`APPROVED` oder 404 | Abo verworfen (gelöscht, wie `deleteAccount`), `User.plan` unverändert          |
| (b)  | `ACTIVE`/`APPROVED`                | unangetastet                                                                    |

- Jede Korrektur: genau eine `console.info`-Zeile, beginnt mit `[paypal-reconcile]`, enthält Abo-ID sowie alten und neuen Stand.
- Fehler (5xx/Netz) bei einem Abo: übrige laufen weiter, das betroffene bleibt unverändert, keine Korrektur gezählt.
