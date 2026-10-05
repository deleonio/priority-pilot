# Spec #2232 — Rechnungsbetrag aus dem PayPal-Zahlungsereignis

Eine Rechnung aus `PAYMENT.SALE.COMPLETED` trägt Betrag und Währung der tatsächlichen Abbuchung
(`resource.amount = { total, currency }`), nicht den Katalogpreis. Keine Bestandsmigration (AGENTS.md):
Altrechnungen bekommen per Spalten-Default `EUR`.

## Vertrag

- `applyPaymentEvent` rechnet `resource.amount.total` in Cent um (`"6.50"` → `650`) und reicht
  `{ amountCents, currency }` als vierten Parameter an `deps.issueInvoice(subscription, now, saleId, charged)`.
  Fehlt `resource.amount`, ist `charged` `undefined` (AK6).
- `issueInvoiceForPeriod(subscription, now, mailSend, saleId, charged?)` übernimmt `charged`:
  - `amountCents` und neue Spalte `Invoice.currency` = abgebuchter Betrag/Währung.
  - Ohne `charged`: bisheriger Katalogpreis-Pfad, Währung `EUR`.
  - Weicht der Betrag vom Katalogpreis des Pakets ab: Positionen `Paket <Label>` (Katalogpreis) plus
    Differenzposition (Betrag − Katalogpreis); Summe der Positionen = `amountCents`. Gleicher Betrag: keine Positionen.
  - Ist das Paket `free` (abgelöstes Abo, #1912), gibt es keinen Katalogpreis: die Rechnung trägt den
    abgebuchten Betrag, das Label enthält nicht „Free“.
- Mailtext und PDF geben die gespeicherte Währung statt des festen „EUR“ aus (AK5).
- Idempotenz je `subscriptionId` + `periodEnd`, `saleId`-Speicherung und Nachholversand bleiben.

## Fälle

| AK  | Ereignis                                     | Ergebnis                                              |
| --- | -------------------------------------------- | ----------------------------------------------------- |
| 1   | Pro monatlich, 6,50 EUR (Einrichtungsgebühr) | Betrag 650, Positionen 899 + (−249)                   |
| 2   | Downgrade Pro→Plus fällig, Plus-Preis        | Betrag Plus-Preis, Label „Plus (…)“, keine Positionen |
| 3   | abgelöstes Abo (cancelled/free), 8,99 EUR    | Betrag 899, Label ohne „Free“                         |
| 4   | Betrag = Katalogpreis                        | Betrag Katalogpreis, keine Positionen                 |
| 5   | Ereigniswährung USD                          | `currency` USD, Mailtext „USD“ statt „EUR“            |
| 6   | kein `resource.amount`                       | Katalogpreis, `charged` `undefined`                   |
