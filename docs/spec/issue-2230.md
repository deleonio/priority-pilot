# Spec #2230 — Rechnung und Verlängerung nur bei PAYMENT.SALE.COMPLETED

Ziel: Je Abbuchung genau eine Rechnung und genau eine Periodenverlängerung; die erste Periode beginnt mit der ersten Abbuchung.

## Regeln

1. `BILLING.SUBSCRIPTION.ACTIVATED` setzt höchstens `status: 'active'`. Keine Rechnung, keine Änderung von `currentPeriodEnd`.
2. `PAYMENT.SALE.COMPLETED` verlängert `currentPeriodEnd` um genau eine Periode und stellt genau eine Rechnung aus (mit `saleId`).
3. Der Checkout (`POST /billing/subscriptions`, Weiterführen mit Startaufschub, Upgrade) legt `currentPeriodEnd = Start` an (nicht Start + Periode).
4. Die erste Abbuchung eines Abos rechnet ab `max(currentPeriodEnd, now)`; Folgeabbuchungen ab `currentPeriodEnd`.
5. Sonderfall Upgrade, dessen erster Zyklus voll durch Guthaben gedeckt ist (keine Abbuchung): `currentPeriodEnd = Upgrade + 1 Periode` am Checkout, keine Rechnung.

## Ablauf (Monatsabo)

| Schritt             | Erwartung                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Checkout            | Abo `approval_pending`, `currentPeriodEnd` ≈ jetzt                                        |
| ACTIVATED           | `active`, 0 Rechnungen, `currentPeriodEnd` unverändert                                    |
| SALE.COMPLETED (1.) | 1 Rechnung (`saleId`), `periodStart` ≈ Abbuchung, `periodEnd` = +1 Monat, Abo-Ende gleich |
| SALE.COMPLETED (2.) | 2. Rechnung, Ende = vorheriges Ende + 1 Monat                                             |
| CANCELLED           | Ende bleibt Abbuchung + 1 Periode                                                         |

Startaufschub (#2049): ACTIVATED → 0 Rechnungen; SALE.COMPLETED → Ende = Start + 1 Periode.
Upgrade mit Einrichtungsgebühr: ACTIVATED → 0 Rechnungen; SALE.COMPLETED → 1 Rechnung, Ende ≈ Abbuchung + 1 Periode.

Tests: `server/src/express/billing-period-start.test.ts`, `server/src/express/billing.test.ts` (ersetzt „AK2: ACTIVATED erzeugt die Rechnung“).
