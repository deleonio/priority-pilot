# Spec #2541 — Fehler beim Rechnungsversand nach dem Commit abfangen

## Ziel

Scheitert der Versand einer Rechnung oder Gutschrift NACH dem Commit (z. B. `confirmationFor`
oder `invoice.update({ deliveredAt })` wirft), darf der auslösende Aufruf (Webhook/Job) nicht
fehlschlagen und der Prozess nicht über `handleUnhandledRejection` (Exit 1) enden.

## Voraussetzungen

- `sendMailToUser` schluckt nur Mailfehler; `deliverInvoice` (`invoices.ts`) hatte keinen Catch.
- Sequelize 6 awaited `afterCommit`-Hooks: ihr Fehler wirft den bereits committeten Aufruf.

## Vertrag

1. `deliverInvoice` fängt jeden Fehler je Rechnung und loggt ihn per `console.error` mit der
   Nummer der Rechnung bzw. Gutschrift. Kein Retry, kein neuer Mechanismus.
2. Der Aufruf endet ohne Fehler — mit äußerer Transaktion (`issueInvoiceForPeriod`,
   `issueCreditNote`) wie ohne (eigene Transaktion aus `createInvoice`).
3. Rechnung, Nummer und `pdfBytes` bleiben gespeichert, `deliveredAt` bleibt `null`.
4. Der vorhandene Nachholversand (`redeliverPending`, #2030) stellt sie im Folgelauf zu.
5. Fehler VOR dem Commit (PDF-Bau, Nummernvergabe) werfen weiter und rollen zurück (#2236).

## Tests

`server/src/logics/invoices-after-commit.test.ts` (AK1–AK5).
