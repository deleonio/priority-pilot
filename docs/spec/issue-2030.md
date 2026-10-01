# Spec #2030 — Rechnungsmail nach fehlgeschlagenem Versand erneut zustellen

## Ziel

Eine Rechnung, deren Mail nicht zugestellt wurde (`deliveredAt === null`), wird in Folgeläufen von `issueInvoiceForPeriod` (`server/src/logics/invoices.ts`) nachgestellt.

## Vorbedingung

Abo mit PayPal-Zahlung; `sendMailToUser` schluckt Transportfehler und liefert `false`, `deliveredAt` bleibt leer.

## Schritte / erwartetes Ergebnis

1. **AK1:** Folgelauf zum selben Zeitraum mit unzugestellter Rechnung versendet genau diese Rechnung erneut: gleiche `number`, unveränderte gespeicherte `pdfBytes` (kein PDF-Neubau, keine neue Nummer, keine zweite Zeile). `deliveredAt` wird nur nach erfolgreichem Versand gesetzt.
2. **AK2:** Rechnung mit gesetztem `deliveredAt`: kein erneuter Mailversand, Rückgabe der existierenden Rechnung.
3. **AK3:** Lauf für eine neuere Periode stellt zusätzlich alle älteren unzugestellten Rechnungen desselben Abos nach.
4. **AK4:** `BILLING.SUBSCRIPTION.PAYMENT.FAILED` versendet keine Rechnungsmail und legt keine Rechnung an (weiterhin `firstFailureAt` + `past_due`).

## Tests

`server/src/logics/invoices-issue.test.ts` (AK1-AK3), `server/src/express/billing.test.ts` (AK4, Schutztest, schon heute grün).
