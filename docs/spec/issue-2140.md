# Spec #2140 — Paketwechsel erst nach Zahlungsbestätigung

Ein Paketwechsel, der eine Abbuchung auslöst, wirkt erst mit dem bestätigten Zahlungseingang. Bis
dahin gelten Abo, Paket und `User.plan` unverändert. Keine Bestandsmigration (AGENTS.md).

## Regel

| Wechsel                        | Wirkung                                                |
| ------------------------------ | ------------------------------------------------------ |
| Upgrade (höherer Rang)         | zahlungsgebunden: erst mit Zahlungseingang             |
| Gleichrangiger Zeitraumwechsel | zahlungsgebunden: erst mit Zahlungseingang             |
| Downgrade                      | unverändert: Vormerkung zum Periodenende (#1896/#2049) |

Bestätigung: PayPal `PAYMENT.SALE.COMPLETED`, Google Play Stand `ACTIVE` (Kauf bzw. RTDN).

## Vormerkung

Zahlungsgebunden = `pendingPlan`/`pendingPeriod` gesetzt, `pendingPlanEffectiveAt = null`.
`applyDuePendingPlan` wendet nur Vormerkungen mit Zeitpunkt an, `null` nie. Eine neue Vormerkung
ersetzt eine ältere (auch eine Downgrade-Vormerkung). Ein Ereignis ohne Änderung (gleiches Paket,
gleicher Zeitraum) merkt nichts vor.

## Ablauf PayPal

1. `UPDATED`/`ACTIVATED` mit abweichendem `plan_id` → nur vormerken; `plan`, `period`, `User.plan` bleiben (AK1, AK5).
2. `PAYMENT.SALE.COMPLETED` → Vormerkung vor der Periodenverlängerung anwenden (Zeitraum des Ziels
   gilt für die Verlängerung), `User.plan` abgleichen, Vormerkung löschen (AK2).
3. Ausbleibende Abbuchung oder `PAYMENT.FAILED` → altes Paket bleibt dauerhaft (AK3).
4. Upgrade über neues Abo (#1912): `ACTIVATED` des neuen Abos kündigt das alte nicht und ändert `User.plan`
   nicht; erst `PAYMENT.SALE.COMPLETED` des neuen Abos löst `replacePredecessors` + `User.plan` aus (AK4).

## Ablauf Google Play

`PENDING` (Kauf oder RTDN) ändert weder Abo noch `User.plan`; der Kauf antwortet 409. Erst `ACTIVE`
setzt das Zielpaket (AK7). Im Kern bereits so umgesetzt — die Tests sichern es ab.

## Anzeige

Konto-Ansicht bei `pendingPlanEffectiveAt === null`: „Wechsel zu X, aktiv mit Zahlungseingang";
„Aktuelles Paket" zeigt weiter das alte (AK8).

## Testzuordnung

| AK  | Test                                                                                          |
| --- | --------------------------------------------------------------------------------------------- |
| 1   | `server/src/logics/paypal-payment-bound.test.ts`, `server/src/express/billing.test.ts`        |
| 2   | `server/src/logics/paypal-payment-bound.test.ts`, `server/src/express/billing.test.ts`        |
| 3   | `server/src/logics/paypal-payment-bound.test.ts`                                              |
| 4   | `server/src/logics/billing/paypalProvider.test.ts`                                            |
| 5   | `server/src/logics/paypal-payment-bound.test.ts`, `server/src/express/billing.test.ts`        |
| 6   | unverändert in `server/src/express/billing.test.ts` (Downgrade-Tests)                         |
| 7   | `server/src/express/billing-google.test.ts`, `server/src/express/billing-google-rtdn.test.ts` |
| 8   | `frontend/src/components/SubscriptionSection.test.tsx`                                        |

Zero-Cent-Upgrade (erster Zyklus 0 Cent, keine Abbuchung) wirkt wie bisher mit `ACTIVATED` — im Ticket
nicht als eigenes Kriterium gefasst, daher ohne Test (siehe PR „Offene Fragen").
