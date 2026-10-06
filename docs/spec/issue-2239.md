# Spec #2239 — Abo mit Startaufschub übernimmt das Paket erst zum Start

## Freischaltmatrix (Vertrag für die Impl-Phase)

Maßgeblich ist allein die Gating-Bedingung vor `replacePredecessors` in `applyEvent`
(`server/src/logics/billing/paypalProvider.ts`); `replacePredecessors` selbst bleibt unverändert
(Deckung durch Bestandstests, u. a. #2049 TF5).

| Fall bei `BILLING.SUBSCRIPTION.ACTIVATED`                     | Vorgänger-Ablösung + `User.plan`-Übernahme                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| Startaufschub (#2049, kein Guthaben: `creditCents` = 0)       | nein — erst die erste `PAYMENT.SALE.COMPLETED`                   |
| Guthaben deckt den ersten Zyklus ganz (`creditCents` ≥ Preis) | ja, schon bei ACTIVATED (#2230)                                  |
| Guthaben deckt teilweise (Upgrade #1912/#2140)                | nein — erst `PAYMENT.SALE.COMPLETED` (Bestandstest, unverändert) |

Bis zur ersten Abbuchung behält der Nutzer das bezahlte Paket; die `pendingPlan: free`-Vormerkung
des gekündigten Vorgängers (#1959) bleibt stehen und greift weiter, bleibt die Abbuchung aus.

## TF1 (AK1): ACTIVATED des aufgeschobenen Abos ändert nichts

- Ziel: Wechsel nach Kündigung auf ein niedrigeres Paket (`/change`- und `/subscriptions`-Zweig laufen auf denselben applyEvent-Pfad) übernimmt das Paket nicht vor der ersten Abbuchung.
- Vorbedingung: Gekündigter Vorgänger mit Restlaufzeit (`status: 'cancelled'`, `currentPeriodEnd` in der Zukunft, `pendingPlan: 'free'`, #1959), `User.plan` = bezahltes Paket; aufgeschobene Nachfolgezeile (`status: 'approval_pending'`, `creditCents` = 0).
- Schritte: `BILLING.SUBSCRIPTION.ACTIVATED` auf die Nachfolgezeile anwenden.
- Erwartung: `User.plan` unverändert (bezahltes Paket); Vorgängerzeile unverändert (`status`, `pendingPlan`, `pendingPlanEffectiveAt`). Rot auf Main: ACTIVATED ersetzt heute den Vorgänger und setzt `User.plan` sofort aufs Zielpaket.
- Test: `server/src/logics/billing/paypalProvider.test.ts`.

## TF2 (AK2): POST /billing/subscriptions auf ein höheres Paket schaltet erst mit der Abbuchung frei

- Ziel: Ein höheres Paket gibt es nie ohne Zahlung (Audit L7, zweite Richtung).
- Vorbedingung: wie TF1; danach `POST /billing/subscriptions` mit dem höheren Paket (Route erzeugt die Nachfolgezeile mit `creditCents` = 0 und Start zum Periodenende, #2049).
- Schritte: Webhook `ACTIVATED`, danach `PAYMENT.SALE.COMPLETED` (erste Abbuchung), jeweils über `/webhooks/paypal`.
- Erwartung: Nach ACTIVATED gilt weiter das alte Paket; erst nach der Abbuchung gilt das Zielpaket. Rot auf Main: ACTIVATED schaltet das höhere Paket gratis frei.
- Test: `server/src/express/billing-period-start.test.ts` (Webhook-/Checkout-Helfer aus #2230).

## TF3 (AK3): Erste Abbuchung übernimmt Paket, löst Vorgänger, stellt Rechnung aus

- Vorbedingung: wie TF1.
- Schritte: ACTIVATED (ändert nichts, Vorbedingung), dann `PAYMENT.SALE.COMPLETED` auf der aufgeschobenen Zeile.
- Erwartung: `User.plan` = Zielpaket; Vorgänger-Vormerkungen geleert (`replacePredecessors`); genau eine Rechnung für die Nachfolgezeile (bestehende SALE.COMPLETED-Kette, #1506/#2230). Auf Main grün — sichert die Übernahme-Kette gegen Überkorrekturen.
- Test: `server/src/logics/billing/paypalProvider.test.ts`.

## TF4 (AK4): Guthaben, das den ersten Zyklus ganz deckt, ersetzt weiter schon bei ACTIVATED

- Vorbedingung: wie TF1, Nachfolgezeile mit `creditCents` ≥ Preis des ersten Zyklus.
- Schritte: ACTIVATED auf die Nachfolgezeile.
- Erwartung: Vorgänger-Vormerkungen geleert, `User.plan` = Zielpaket (#2230: Guthaben ist die Zahlung). Auf Main grün — Regressionsspiegel gegen Überkorrektur der Gating-Bedingung.
- Test: `server/src/logics/billing/paypalProvider.test.ts`.

## Abgrenzung

- Der teilweise deckende Guthaben-Fall (Upgrade #1912/#2140) wird nicht neu getestet — der Bestandstest in `paypalProvider.test.ts` pinnt bereits: Vorgänger-Ablösung erst mit `PAYMENT.SALE.COMPLETED`, nicht schon bei ACTIVATED.
- Kein UI-Anteil; Folgewechsel auf Basis einer aufgeschobenen, bereits `active` Zeile (`findChangeBasis`, `revise`) sind außerhalb dieses Tickets (#2239-Analyse, Randbedingungen).
