# Spec — Issue #1912: PayPal-Upgrade verrechnet Restlaufzeit

Teil (a) von #1895. Vertrag für die Impl-Phase; Tests: `server/src/logics/proration.test.ts`,
`server/src/express/billing-subscriptions.test.ts` (#1912-Fälle), `server/src/logics/invoices-upgrade.test.ts`.

## Rechenfunktion (`server/src/logics/proration.ts`)

`prorateUpgrade({ oldPriceCents, newPriceCents, periodStart, periodEnd, now }) → { creditCents, firstCycleCents }`

- Guthaben = floor(Preis alt × Resttage / Periodentage), taggenau (UTC-Tage), auch bei Zeitraumwechsel.
- Erster Zyklus = max(0, Preis neu − Guthaben). Beispiel: 499 Cent, 15/30 Tage, Ziel 999 → 249 / 750.

## Upgrade-Route (`POST /billing/subscriptions/change`)

- Upgrade (höherer Rang): `PaypalClient.createSubscription(planId, { firstCycleCents })` statt `revise`;
  Antwort trägt `approvalUrl`. Das Guthaben wird am neuen Abo als `Subscription.creditCents` (INTEGER, Default 0) gehalten.
- Altes Abo wird erst nach Bestätigung des neuen gekündigt (nicht im Route-Aufruf).
- Downgrade und Google Play unverändert (`revise`, Wechsel zum Periodenende).

## Rechnung

- `Invoice.lineItems` (JSON, Default leer): Positionen `{ label, amountCents }`. Mit `creditCents > 0`:
  Paketpreis (+) und Verrechnung (−); `amountCents` = Summe. Altrechnungen ohne Positionen bleiben gültig.
