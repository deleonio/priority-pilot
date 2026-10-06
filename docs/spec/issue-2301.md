# Spec #2301 — Ein Beleg je PayPal-Abbuchung (Idempotenz über die Sale-ID)

## Ziel

Jede eingezogene PayPal-Zahlung hat genau einen Beleg mit ihrer Sale-ID. Eine erneut zugestellte
Zahlung (gleiche Sale-ID) erzeugt keinen zweiten. Eine Erstattung trifft die Rechnung ihrer Abbuchung.

## Voraussetzungen

- Heute sucht `issueInvoiceForPeriod` (`invoices.ts`) nur über `subscriptionId` + `periodEnd`. Auf einem
  gekündigten Abo (#2243) wächst `currentPeriodEnd` nicht — die vorhandene Periodenrechnung wird
  zurückgegeben, die neue Sale-ID geht verloren, die Erstattung trifft die falsche Rechnung.

## Verhalten

1. Mit `saleId`: Rechnung mit gleicher Sale-ID (kein Gutschriftsbeleg) → zurückgeben (erneute Zustellung).
2. Sonst Periodenrechnung (kein Gutschriftsbeleg) nur wiederverwenden, wenn sie noch keine `saleId` trägt
   (Sale-ID nachtragen). Trägt sie eine andere Sale-ID → neue Rechnung.
3. Ohne `saleId`: periodenidempotent wie bisher.
4. Gutschriften (`creditForInvoiceId` gesetzt) gelten nie als „vorhandene Rechnung“.

## Testfälle

- AK1: zwei Sale-IDs, gleiche Periode → zwei Rechnungen mit je eigener `saleId`.
- AK2: dieselbe Sale-ID zweimal → eine Rechnung, zweiter Aufruf liefert dieselbe.
- AK3: gekündigtes Abo mit Periodenrechnung (Sale A), `PAYMENT.SALE.COMPLETED` Sale B → zweite Rechnung mit B;
  `PAYMENT.SALE.REFUNDED` für B → Gutschrift verweist auf Rechnung B.
- AK4: ohne `saleId` bleibt es bei einer Rechnung je Periode.
- AK5: Bestandstests (#2086, #2230, #2232, #2236, #2243) bleiben grün.
