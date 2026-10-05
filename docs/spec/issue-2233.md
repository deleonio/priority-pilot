# Spec #2233 — Rechnungs-PDF mit Unicode-Schrift, Zahlungsereignis atomar

## Rechnungs-PDF (AK1/AK2)

- Ziel: Rechnungen entstehen für Namen in allen App-Sprachen (Latein, Kyrillisch, polnische Sonderzeichen).
- Schritte: `buildInvoicePdf` / `issueInvoiceForPeriod` mit „Иван Петров", „Łukasz Żółć Ślęzak", „Anna 🎉".
- Erwartung: gültiges PDF (`%PDF-`), kein Wurf; `pdfBytes` an der Rechnung gespeichert. Zeichen ohne Glyphe (Emoji) werden ersetzt statt den Bau scheitern zu lassen.

## Atomares Zahlungsereignis (AK3–AK5)

- Vorbedingung: Abo mit Periodenende, Status `past_due`, Vormerkung; `PAYMENT.SALE.COMPLETED` trifft ein.
- Scheitert der Rechnungsbau, bleiben `currentPeriodEnd`, `status`, `firstFailureAt`, Plan/Vormerkungen und `User.plan` unverändert; keine Rechnung existiert (eine Transaktion über Abo-Updates und Rechnung).
- Die Wiederholung desselben Ereignisses verlängert genau einmal und erzeugt genau eine Rechnung.
- Webhook-Route: erster Versuch mit Rechnungsfehler → 503 ohne Verlängerung; zweiter mit gleicher `event.id` → 200.
- Tests: `invoice-pdf.test.ts` (AK1/AK2), `paypal-atomic.test.ts` (AK3/AK4), `express/billing.test.ts` (AK5). Test-Seam: `deps.issueInvoice` reicht zusätzliche Argumente (Transaktion) durch; `Invoice.create` wird gemockt.
