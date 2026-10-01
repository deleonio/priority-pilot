# Spec #1955 — Rechtskonforme PDF-Rechnungen erzeugen und per E-Mail versenden

## Ziel

Nach jedem PayPal-Zahlungseingang erzeugt der bestehende Rechnungslauf (#1495, `issueInvoiceForPeriod`)
zusätzlich zur Rechnungsmail ein **PDF**, versendet es als **Anhang** und bewahrt die PDF-Bytes
serverseitig auf, sodass die Rechnung in der App **jederzeit — auch nach Ende der Mitgliedschaft —
byte-identisch** als PDF abrufbar bleibt. Google-Play-Zahlungen lösen weiterhin **keine** eigene
Rechnung aus (Google stellt den Beleg, ADR 0017).

## Vertrag (Seams für die Umsetzung)

- **Invoice-Modell** (`server/src/models/invoice.ts`): neues, nullable Feld `pdfBytes` (Blob) — die
  PDF-Bytes werden **zum Erzeugungszeitpunkt** gespeichert (kein Dateisystem, Aufbewahrung über die
  Mitgliedschaft hinaus).
- **PDF-Bau** (`server/src/logics/invoicePdf.ts`, neu):
  - `invoicePdfLines(invoice, operator, recipient): string[]` — die Textzeilen des PDFs (AK2-Inhalt).
  - `buildInvoicePdf(invoice, operator, recipient): Promise<Uint8Array>` — das echte PDF-Document
    (beginnt mit `%PDF`-Magic), gezeichnet aus genau diesen Zeilen.
  - `operator = { name: string; address: string[]; email: string; ustId: string }` (Spiegel
    `frontend/src/lib/operator.ts`); `recipient = { displayName: string; email: string }`
    (User-Modell hat keine Anschrift — B2C-Status quo aus #1495).
- **Mail** (`server/src/logics/mail.ts`): `MailPayload`/`sendMailToUser`-Payload um
  `attachments?: { filename: string; contentType: string; content: Uint8Array }[]` erweitert;
  `sendMailToUser` reicht Attachments **unverändert** an den Sender durch.
- **Rechnungslauf** (`server/src/logics/invoices.ts`): `issueInvoiceForPeriod` baut das PDF,
  speichert es in `pdfBytes` und hängt es als Attachment (filename `<Rechnungsnummer>.pdf`,
  contentType `application/pdf`) an die Rechnungsmail. Der Idempotenz-Guard bleibt: ein
  Wiederholungslauf erzeugt keine zweite Rechnung und versendet **keine zweite Mail**.
  Nummernkreis (`nextInvoiceNumber`) unangetastet.
- **Download-Endpunkt**: `GET /billing/invoices/{id}/pdf` — auth-geschützt, nur der Eigentümer;
  fremde/unbekannte Id → 404 (Muster `GET /billing/invoices/{id}`, nichts über fremde Rechnungen
  verraten). Antwort: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename`
  aus der Rechnungsnummer, Body byte-identisch zu `pdfBytes`.
- **UI** (`frontend/src/components/SubscriptionSection.tsx`): je Eintrag der Rechnungsliste eine
  Download-Aktion (`data-testid="invoice-download"`), die den PDF-Endpunkt aufruft und die Datei
  unter der Rechnungsnummer speichert; bei 375 px ohne horizontalen Overflow.
- **Betreiberangaben serverseitig**: Name, Anschrift, Kontakt und optional `ustId` müssen dem
  Server vorliegen — Quelle ist Umsetzungsentscheid (Spiegel zu `frontend/src/lib/operator.ts`,
  `ustId` aktuell leer).
- **Kein Steuerausweis** (Kleinunternehmer, §19 UStG): das PDF übernimmt die bestehende `taxNote`;
  eine Steuernummer-/USt-IdNr.-Zeile erscheint **nur**, wenn `operator.ustId` gefüllt ist.

## PDF-Inhalt (AK2)

Zeilen enthalten: Rechnungsnummer, Rechnungsdatum, Betreiberangaben (Name, Anschriftszeilen,
Kontakt-E-Mail), Empfänger (Anzeigename, E-Mail), Leistungszeitraum als ISO-Datum (`JJJJ-MM-TT`),
Betrag in Euro mit Komma (z. B. `7,99`), den `taxNote`-Text (§19-UStG-Hinweis); bei gesetztem
`ustId` zusätzlich die USt-IdNr., sonst **keine** Zeile mit „USt-IdNr“.

## Schritte / erwartetes Ergebnis

1. Zahlungslauf (PayPal-Webhook bzw. Ablauf) stößt `issueInvoiceForPeriod` an → Rechnung entsteht
   wie bisher **und** trägt PDF-Bytes; Mail geht mit PDF-Anhang raus.
2. Wiederholungslauf für denselben Zeitraum → keine zweite Rechnung, keine zweite Mail.
3. `GET /billing/invoices/{id}/pdf` liefert dem Eigentümer die gespeicherten Bytes zurück.
4. Rechnungsliste in der App bietet je Zeile den PDF-Download an.

## Testfälle

- TF1 (AK1, `server/src/logics/invoice-pdf.test.ts`): Zahlungslauf erzeugt PDF (`%PDF`-Magic), legt
  es an der Rechnung ab und übergibt es als Attachment an den Mail-Sender; Zweitlauf versendet keine
  zweite Mail.
- TF2 (AK2, `server/src/logics/invoice-pdf.test.ts`): `invoicePdfLines` enthält Nummer, Datum,
  beide Parteien, Zeitraum, Betrag, §19-Hinweis; ohne `ustId` keine USt-IdNr.-Zeile, mit `ustId`
  erscheint sie.
- TF2b (AK1 Mail-Interface, `server/src/logics/mail.test.ts`): Attachments kommen 1:1 beim Sender an.
- TF3 (AK3, in TF1 enthalten): gespeicherte Bytes sind byte-identisch zum Anhang.
- TF4 (AK4, `server/src/express/billing-subscriptions.test.ts`): GET-Download 200 + Header +
  byte-identischer Body für den Eigentümer; 404 für fremden Nutzer.
- TF5 (AK5, `frontend/e2e/billing.spec.ts`): Download-Aktion je Listeneintrag sichtbar und verdrahtet
  (Download unter dem Dateinamen aus der Rechnungsnummer); 375 px ohne Overflow.
- TF6 (AK6, `server/src/logics/billing/googlePlayProvider.test.ts`): Play-Pfad erzeugt keine
  Rechnung (Regressionsschutz — bewusst bereits vor der Umsetzung grün, das Verhalten ist heute
  korrekt und soll es bleiben).
