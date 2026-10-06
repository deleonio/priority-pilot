# Spec #2238 — Upgrade-Aktivierung erst mit Zahlungseingang

Ziel: Zwischen Upgrade-Bestätigung (`BILLING.SUBSCRIPTION.ACTIVATED`) und Zahlungseingang
(`PAYMENT.SALE.COMPLETED`) zeigt die App das bisherige Paket mit Hinweis „aktiv mit
Zahlungseingang“; es gibt nie zwei aktive Abos, und eine Kündigung trifft eindeutig das
laufende Abo.

## Regeln

1. `ACTIVATED` aktiviert ein Abo mit ausstehender Restschuld nicht: trägt die Zeile
   `creditCents > 0` und übersteigt der Preis des Zielpakets das Guthaben (Muster
   `chargesOnActivation`), bleibt der Status ungleich `active`. Ohne Restschuld (Erstabo,
   Guthaben deckt den ersten Zyklus, Startaufschub #2049) aktiviert `ACTIVATED` weiterhin
   (`active`).
2. Erst `PAYMENT.SALE.COMPLETED` setzt das Upgrade-Abo auf `active` und kündigt den Vorgänger
   (`replacePredecessors`) — danach gibt es je Nutzer genau eine aktive Zeile (Ablösung #1912,
   Vormerk-Mechanik #2140/#2230 unverändert).
3. In dieser Phase liefert `/auth/me` `plan` = `User.plan` (bisheriges Paket) und zeigt das
   laufende, bezahlte Abo; den bevorstehenden Wechsel trägt das `subscription`-DTO als
   zahlungsgebundene Vormerkung: `pendingPlan` = Zielpaket, `pendingPlanEffectiveAt` = `null`
   (Frontend-Vertrag „…, aktiv mit Zahlungseingang“, `SubscriptionSection.tsx`). Ob die
   Vormerkung beim Webhook auf der angezeigten Zeile gesetzt oder beim Lesen zusammengeführt
   wird, entscheidet die Umsetzung — der DTO-Vertrag ist bindend.
4. `POST /billing/subscriptions/cancel` kündigt bei ausstehendem Upgrade eindeutig das
   laufende, bezahlte Abo (PayPal-Aufruf mit dessen `externalSubscriptionId`); die
   ausstehende Upgrade-Zeile bleibt bestehen, bis der Zahlungseingang sie aktiviert.

## Ablauf (Upgrade Plus → Pro mit Restschuld)

| Schritt             | Erwartung                                                                     |
| ------------------- | ----------------------------------------------------------------------------- |
| `/change`           | zweite Zeile `approval_pending`, Zielplan, `creditCents` gesetzt              |
| ACTIVATED           | Upgrade-Zeile bleibt ausstehend; genau eine aktive Zeile (das Plus-Abo)       |
| `/auth/me`          | `plan = plus`, `subscription.plan = plus`, `pendingPlan = pro`, Effektiv `null` |
| `/cancel`           | PayPal-Kündigung trifft die Plus-Zeile; Upgrade-Zeile bleibt                  |
| SALE.COMPLETED      | Pro-Zeile `active`, Plus-Zeile `cancelled`, genau eine aktive Zeile           |

Tests: `server/src/logics/paypal-payment-bound.test.ts` (Regel 1), `server/src/express/billing-subscriptions.test.ts` (Regel 2/4), `server/src/express/auth.test.ts` (Regel 3).
