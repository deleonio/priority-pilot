# Spec #2237 — Erstattung und Rückbuchung: Gutschrift statt refunded am Original

## Ziel

PayPal-Erstattungen (`PAYMENT.SALE.REFUNDED`) und Rückbuchungen (`PAYMENT.SALE.REVERSED`) erzeugen je
genau einen sichtbaren Gutschriftsbeleg mit eigener Nummer und Bezug auf die Originalrechnung, ziehen
das Paket sofort ab und beenden das PayPal-Abo. Die Originalrechnung bleibt vollständig unverändert —
die #2086-Entscheidung („Original wird `refunded`") wird bewusst umgekehrt (PO-Entscheid
2026-10-05). Nicht zuordenbare Ereignisse werden sichtbar protokolliert statt still verarbeitet.

## Voraussetzungen

- Verifizierte PayPal-Webhooks erreichen `/webhooks/paypal`; die Abo-Suche läuft über
  `billing_agreement_id` (`billing.ts`, `receiveProviderEvent`).
- Heute markiert REFUNDED nur die Originalrechnung `refunded` (`paypal.ts:524`), REVERSED und DENIED
  sind No-ops, und ein Ereignis ohne Abo-Match wird still als `processed` abgelegt.

## Fachliche Entscheidungen (Spec-Entscheid, vom Analyse-Block offen gelassen)

1. **Gutschrift = eigene Zeile in `invoices`** (gleiche Tabelle — erscheint damit automatisch in
   `GET /billing/invoices` und der Admin-Liste, bestehender DTO unverändert): eigene Nummer
   `GS-<Jahr>-<6-stellig>` aus eigenem Sequenzkreis nach dem `invoice_sequences`-Muster (atomarer
   INSERT, kein `count() + 1`, In-Memory-SQLite-`).`-safe).
2. **Bezug aufs Original über neue Spalte `invoices.creditForInvoiceId`** (nullbar): die
   Originalrechnung wird über die Sale-Referenz (`saleId`) gefunden, sonst — wie bisher — die
   neueste Rechnung des Abos (Fallback für Altrechnungen bleibt erhalten).
3. **Gutschriftsinhalt:** `amountCents` = negativer Betrag der Originalrechnung,
   `paymentStatus: 'refunded'`. Die Originalrechnung bleibt unverändert (`paymentStatus 'paid'`,
   Nummer, Betrag).
4. **Paketentzug (REFUNDED/REVERSED):** `User.plan` sofort `free` (`syncUserPlan`), Subscription
   `plan: 'free'`, `status: 'cancelled'`, Vormerkungen (`pendingPlan`/`pendingPeriod`/
   `pendingPlanEffectiveAt`) geleert. Gutschrift und Abo-Update in **einer** Transaktion
   (#2233-Muster); der PayPal-`cancel` (`client.cancel` mit `externalSubscriptionId`) läuft
   außerhalb der Transaktion (Muster `replacePredecessors`) — schlägt er fehl, bleibt die
   Gutschrift erhalten (nur loggen).
5. **`PAYMENT.SALE.DENIED`** wirkt wie `BILLING.SUBSCRIPTION.PAYMENT.FAILED`: nur beim ersten
   Auftreten `firstFailureAt` setzen und `status: 'past_due'`; ein weiterer Fehlschlag verlängert
   die Frist nicht.
6. **Ereignis ohne zuordnbares Abo:** weiterhin ablegen und mit 200 quittieren (eine 503 würde
   PayPal endlose Wiederholungen kosten), aber mit Warn-Log (Anbieter + Event-ID) statt stiller
   `processed`-Quittung. Der Wiederholungspfad nach Verarbeitungsfehlern (`stored.destroy()` + 503) bleibt unverändert; der Dedup über den Unique-Index bleibt intakt.

## Akzeptanzkriterien → Tests

| AK                                                                                            | Test                                          |
| --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| AK1 Gutschrift mit eigener Nummer + Originalbezug, Original bleibt paid (Sale-Ref / Fallback) | TF1/TF1b `server/src/express/billing.test.ts` |
| AK2 REVERSED wie REFUNDED                                                                     | TF2 `server/src/express/billing.test.ts`      |
| AK3 Sofortiger Paketentzug + PayPal-Kündigung                                                 | TF3 `server/src/express/billing.test.ts`      |
| AK4 Warn-Log ohne Abo-Match                                                                   | TF4 `server/src/express/billing.test.ts`      |
| AK5 Dedup: keine zweite Gutschrift                                                            | TF5 `server/src/express/billing.test.ts`      |
| AK6 DENIED → firstFailureAt + past_due                                                        | TF6 `server/src/express/billing.test.ts`      |

## Test-Pflege (bestehende Tests, die der neue Vertrag berührt)

- `server/src/express/billing.test.ts` (#2086 AK3, ehem. Z. 961-1029): erwarten
  `refunded`-am-Original — vom neuen Vertrag bewusst umgekehrt, beide Tests entfernt; die
  Gutschrift-Verträge (inkl. Fallback) leben in #2237 TF1/TF1b weiter.
- Die fixture-basierten DTO-Tests (`billing-subscriptions.test.ts:455-502`,
  `admin-invoices.test.ts:75-100`) bleiben unberührt: sie testen nur das Feld-Mapping, und
  Gutschriftszeilen tragen `paymentStatus 'refunded'`.
