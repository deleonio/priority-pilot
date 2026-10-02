# Spec #2031 — Leistungszeile auf Deutsch und eindeutige Download-Buttons

## Ziel

Neue Rechnungen zeigen Paket und Zeitraum in deutscher Schreibweise („Paket Plus (monatlich)“);
jeder Download-Button der Rechnungsliste nennt seine Rechnungsnummer im zugänglichen Namen.

## Vorbedingung

Abo plus/pro mit beliebigem Zeitraum (monthly/quarterly/yearly); Rechnungsliste mit mindestens
einer Rechnung. DB-Werte (`plan`, `period`) bleiben englische Katalog-Schlüssel — nur die Anzeige
wird gemappt.

## Schritte / erwartetes Ergebnis

1. **AK1:** `issueInvoiceForPeriod` erzeugt das Label „Paket <Plan> (<deutscher Zeitraum>)“ — Plan
   großgeschrieben (Plus/Pro), Zeitraum monthly→monatlich, quarterly→vierteljährlich,
   yearly→jährlich — an allen drei Anzeigeorten: Mailzeile `Paket: …` (plus zugehörige
   Positionszeile), `lineItems[0].label` (Rechnungsposition, bei Guthabenverrechnung) und
   PDF-Leistungszeile (4. Argument an `buildInvoicePdf`, sichtbar in den gespeicherten
   `pdfBytes`). Persistierte Altrechnungen behalten ihr altes Label — `lineItems`/`pdfBytes`
   werden nie neu gebaut (#2030).
2. **AK2:** Jeder Download-Button in `billing-invoices` trägt den zugänglichen Namen
   „PDF <Rechnungsnummer> herunterladen“ und unterscheidet sich damit je Zeile.
3. **AK3:** Die Rechnungsliste verursacht bei 375 px keinen horizontalen Überlauf, auch mit den
   längeren Button-Namen (Bounding-Box-Assertion; die App-Shell clippt `overflow-x: hidden`).
   Die Liste ist heute ungestylt (kein CSS-Treffer unter `frontend/src`) — der Test ist der
   lebende Regressions-Schutz für künftiges Layout.

## Tests

`server/src/logics/invoices-issue.test.ts` (AK1, alle 6 Kombinationen plus PDF-Bytes),
`frontend/src/components/SubscriptionSection.test.tsx` (AK2),
`frontend/e2e/issue-1955-invoice-pdf-download.spec.ts` (AK3, zwei Rechnungen bei 375 px).
