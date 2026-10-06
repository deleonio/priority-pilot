# Spec #2236 — Rechnungsnummer erst nach erfolgreichem PDF-Bau vergeben

## Atomare Nummernvergabe ohne äußere Transaktion (AK1)

- Ziel: Ein fehlgeschlagener PDF-Bau hinterlässt weder Rechnung noch Nummern-Reservierung.
- Vorbedingung: Abo ohne Rechnung für den Zeitraum; Aufruf von `issueInvoiceForPeriod` OHNE `transaction` (direkter Aufruf, Unit-Tests, künftige Aufrufer).
- Schritte: PDF-Bau wirft (Test-Seam, siehe unten); danach erfolgreicher Zweitanruf für dasselbe Szenario.
- Erwartung: Der Aufruf rejected; `invoices` bleibt leer und `invoice_sequences` enthält keine Reservierung. Der nächste erfolgreiche Lauf vergibt erneut die niedrigste freie Nummer (`INV-<Jahr>-000001`); `invoice_sequences` enthält genau die Reservierungen der existierenden Rechnungen.

## Parallele Nummernvergabe (AK2)

- Zwei parallele Aufrufe (zwei Abos/Zeiträume, `Promise.all`, ohne äußere Transaktion) liefern zwei verschiedene, aufeinanderfolgende Nummern; `Invoice.number` bleibt eindeutig. Guard: die atomare Umstellung (eigene Transaktion, `pool.max = 1`) darf diese Eigenschaft nicht brechen.

## PayPal-Pfad unverändert (AK3)

- Mit äußerer Transaktion (PayPal-Webhook, #2233) bleibt das Verhalten unverändert — kein eigener Rollback-Kreis, Mailversand weiter nach Commit. TF3 ist kein neuer Test, sondern der grüne Lauf der vorhandenen Suites `paypal-atomic.test.ts` (AK3), `invoices-issue.test.ts`, `invoice-pdf.test.ts`, `invoices-charged.test.ts` (vollständige Server-Suite).

## Test-Seam

- `issueInvoiceForPeriod` erhält einen optionalen siebten Parameter `pdfBuild?: typeof buildInvoicePdf` (Default: echter PDF-Bau) — analog zum bestehenden `mailSend`-Seam. Die Produktions-Signatur ergänzt die Impl-Phase; die Spec-Tests sprechen ihn über einen Cast an (Produktiv-Typ unangetastet, Muster `paypal-atomic.test.ts`).
- Tests: `server/src/logics/invoices-number-gap.test.ts` (TF1 zu AK1, TF2 zu AK2).
