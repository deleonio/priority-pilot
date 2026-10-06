# Spec #2303 — Gutschrift als PDF speichern und zustellen

## Ziel

Eine Gutschrift (GS-…, #2237) bekommt beim Anlegen ein gespeichertes PDF, wird per Mail zugestellt
und ist in der Rechnungsliste herunterladbar. Rechnungs-PDF und -Mail bleiben unverändert.

## Voraussetzungen

- `issueCreditNote` legt heute nur die Zeile an; Download-Route liefert 404 mangels `pdfBytes`.
- Muster: `issueInvoiceForPeriod` (PDF in der Transaktion, Versand per `afterCommit`, `redeliverPending` #2030).

## Vertrag

1. Signatur: `issueCreditNote(original, now, transaction?, mailSend?, pdfBuild = buildInvoicePdf)`.
   Kein eigenes `BEGIN` — die Transaktion des Aufrufers wird durchgereicht (ohne sie läuft alles direkt).
2. Nach `Invoice.create` wird das PDF über `pdfBuild(invoice, OPERATOR, recipient, service)` gebaut
   (`service` = `Zur Rechnung <INV-Nr>`) und in derselben Transaktion als `pdfBytes` gespeichert;
   wirft der Bau, rollt alles zurück (keine Gutschrift, Nummer bleibt frei).
3. `invoicePdfLines` titelt bei gesetztem `creditForInvoiceId` `Gutschrift <GS-Nr>` mit
   `Gutschriftdatum:`; `Rechnung GS-…` und `Rechnungsdatum` entfallen; Rechnungen bleiben unverändert.
4. Versand erst nach dem Commit (`transaction.afterCommit`), Betreff „Ihre Gutschrift <GS-Nr>“ mit
   Bezug aufs Original, Anhang = gespeicherte Bytes, `deliveredAt` nur bei Erfolg.
5. Unzugestellte Gutschriften holt der vorhandene `redeliverPending`-Weg der Subscription nach.

## Erwartetes Ergebnis

Download `GET /billing/invoices/{id}/pdf` einer Gutschrift: 200, `application/pdf`, `GS-….pdf`.

## Tests

`invoices-credit-note.test.ts` (AK1, AK3–AK5), `invoice-pdf.test.ts` (AK2),
`billing-subscriptions.test.ts` (AK1 Download). AK6: #2237-Tests in `billing.test.ts` bleiben unverändert.
