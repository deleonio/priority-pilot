# Spec #2086 — Echter Zahlungsstatus je Rechnung (paid/refunded)

## Ziel

Beide Rechnungslisten (Einstellungen → Abo-Bereich, Admin → Nutzerverwaltung) zeigen je Rechnung
den echten Zahlungsstatus („Bezahlt“/„Erstattet“). Das feste Label „Ausgestellt“ entfällt überall.
Meldet PayPal nachträglich eine Erstattung, folgt der Status der betroffenen Rechnung.

## Voraussetzungen

- Rechnungen entstehen heute erst nach bestätigter Abbuchung (`applyPaymentEvent`, `paypal.ts`) —
  der komplette Bestand ist damit `paid`.
- PayPal-Ereignisse erreichen die App als verifizierte Webhooks (`/webhooks/paypal`); die
  Abo-Suche läuft über `resource.billing_agreement_id` (`paypalProvider.ts`).

## Fachliche Entscheidungen (Spec-Entscheid, vom Analyse-Block offen gelassen)

1. **Statusquelle provider-neutral:** neue Spalte `invoices.paymentStatus` (`STRING NOT NULL`,
   Default `'paid'`, Werte `paid`/`refunded`) — Google Play (#1688) kann dieselbe Quelle nutzen.
   `failed` wird bewusst nicht aufgenommen (Minimalprinzip: kein Ereignis setzt es heute).
2. **Zuordnung Erstattung → Rechnung über die Sale-Referenz** (Empfehlung des Analyse-Blocks):
   - neue Spalte `invoices.saleId` (`STRING`, nullbar), befüllt aus `resource.id` des
     `PAYMENT.SALE.COMPLETED`-Ereignisses bei Rechnungserstellung;
   - `PAYMENT.SALE.REFUNDED` trägt im Refund-Resource die `sale_id` des ursprünglichen Verkaufs —
     die Rechnung mit dieser `saleId` wird auf `refunded` gesetzt; alle anderen Rechnungen bleiben
     unberührt.
   - Fallback „neueste Rechnung des Abos“ nur, wenn keine Rechnung die `sale_id` trägt
     (Altrechnungen vor der Spalte): Erstattungen dürfen nie still verloren gehen, und ohne
     Spezialreferenz ist die neueste Rechnung des Abos die beste Zuordnung.
3. **`BILLING.SUBSCRIPTION.ACTIVATED`** erzeugt die Rechnung ebenfalls mit `paymentStatus 'paid'`,
   aber ohne `saleId` (kein Sale-Objekt, damit keine falsche Erstattungs-Referenz).

## Verhalten

1. Migration zieht `paymentStatus` (mit Default `'paid'`) und `saleId` an `invoices` nach —
   Bestandsrechnungen sind damit alle `paid`, bevor `sequelize.sync()` läuft
   (Muster `migrateInvoicePdfBytesColumn`).
2. `PAYMENT.SALE.COMPLETED` → erzeugte Rechnung trägt `paymentStatus 'paid'` und die
   Sale-Referenz in `saleId`.
3. `PAYMENT.SALE.REFUNDED` → genau die Rechnung mit passender `saleId` wird `refunded`
   (Fallback: neueste Rechnung des Abos, wenn keine `saleId` passt).
4. `serializeInvoice` liefert `paymentStatus`; `/billing/invoices` und
   `/admin/users/:id/invoices` geben das Feld je Rechnung zurück (OpenAPI-Schema `Invoice`
   miterweitern, Client-Typen neu generieren — Impl-Phase).
5. Eigentümer-Liste (`SubscriptionSection`) zeigt je Rechnung ein Text-Badge (`KolBadge`,
   Muster `AdminUsersSection.tsx`) mit „Bezahlt“/„Erstattet“; Admin-Liste ersetzt das feste
   „Ausgestellt“ durch denselben Status. Dieselben Wörter für denselben DTO-Wert in beiden
   Sichten (KI-UX), Information nie allein über Farbe.

## Akzeptanzkriterien → Tests

| AK                                                       | Test                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| AK1 Migration + Backfill `paid`                          | TF1 `server/src/logics/migrate.test.ts`                        |
| AK2 `paid` bei Rechnungserstellung (COMPLETED/ACTIVATED) | TF2 `server/src/express/billing.test.ts`                       |
| AK3 REFUNDED → zugehörige Rechnung `refunded`            | TF3 `server/src/express/billing.test.ts`                       |
| AK4 DTO `paymentStatus` in beiden Routen                 | TF4 `billing-subscriptions.test.ts` + `admin-invoices.test.ts` |
| AK5 Eigentümer-Liste zeigt Status                        | TF5 `SubscriptionSection.test.tsx`                             |
| AK6 Admin-Liste dynamischer Status, kein „Ausgestellt“   | TF6 `AdminUsersSection.test.tsx`                               |
| AK7 Admin-Liste 375 px ohne Clipping                     | TF7 `frontend/e2e/admin-invoices.spec.ts`                      |

## Test-Pflege (bestehende Tests, die der neue Vertrag berührt)

- `server/src/express/admin-invoices.test.ts` (AK1 #1958): exakte DTO-Feldliste → `paymentStatus`
  aufnehmen.
- `frontend/src/components/AdminUsersSection.test.tsx` (Z. ~657): festes „Ausgestellt“ →
  dynamischer Status.
- `frontend/e2e/admin-invoices.spec.ts` (Z. ~79): „Ausgestellt“ → „Bezahlt“/„Erstattet“.
