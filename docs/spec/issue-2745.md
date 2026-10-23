# Spec #2745 — Quartals-/Jahresabo nach der ersten Laufzeit monatlich kündbar (§ 309 Nr. 9 BGB)

## Ziel

Kündigt ein Nutzer ein PayPal-Quartals- oder -Jahresabo nach der ersten Laufzeit (App-Abo-Bereich
oder `/kuendigen/`), endet das Abo **einen Kalendermonat nach `cancellationRequestedAt`** statt zum
Ende der bezahlten Periode. Für die bezahlte Zeit nach diesem Ende wird anteilig über PayPal
erstattet (Sale-Referenz `Invoice.saleId` der aktuellen Periode, taggenaue Cent-Berechnung nach dem
Muster `proration.ts`) und eine Rechnungskorrektur über `issueCreditNote` ausgestellt. App,
Bestätigungsmail und `/kuendigen/`-Bestätigung nennen das neue Enddatum.

## Voraussetzungen

- PayPal-Abo (`provider === 'paypal'`), `period` ∈ `quarterly | yearly`.
- „Ab der zweiten Laufzeit" = es existiert mindestens eine bezahlte Rechnung für eine **frühere**
  Periode dieses Abos (`Invoice.subscriptionId` + `periodEnd <= cancellationRequestedAt`) — die
  Upgrade-Ablösung (#1912, neues Abo mit sofortigem Erstzyklus) beginnt wieder bei der ersten
  Laufzeit.
- Erste Laufzeit, Monatsabos und Google-Play-Abos (`provider !== 'paypal'`) behalten das bisherige
  Verhalten (Ende = `currentPeriodEnd`, kein Refund, keine Gutschrift).

## Schritte (Server-Vertrag)

1. Kündigung läuft über `recordCancellation` (setzt `cancellationRequestedAt`) und den
   `BILLING.SUBSCRIPTION.CANCELLED`-Webhook-Zweig von `applyPlanChange`.
2. Neuer Seam `server/src/logics/cancellationRefund.ts`:
   - `resolveCancellationEnd(subscription, now)` → `cancellationRequestedAt + 1 Kalendermonat`,
     wenn zweite Laufzeit + Quartal/Jahr + PayPal; sonst `null` (Aufrufer behält
     `pendingPlanEffectiveAt = currentPeriodEnd`).
   - `refundRemainingTerm({ subscription, now, refund })` → berechnet
     `floor(amountCents * verbleibendeTage / periodTage)` zwischen neuem Ende und `periodEnd` der
     aktuellen Rechnung (utcDay-Muster `prorateUpgrade`), ruft `refund(saleId, centBetrag)` und
     stellt über `issueCreditNote` eine Gutschrift zur Originalrechnung (`creditForInvoiceId`).
3. Fehlschlagender Refund (AK6): der Aufruf rejected; `applyPlanChange` fängt ihn — Vertragsende
   greift trotzdem, Fehlschlag wird geloggt und wiederholt (Retry-Muster #2606).

## Erwartete Ergebnisse

- AK1 `pendingPlanEffectiveAt` = `cancellationRequestedAt` + 1 Monat (z. B. 2026-11-15 →
  2026-12-15); Anzeige in Abo-Bereich und Kündigungsbestätigung.
- AK2 Refund mit korrekter Sale-ID und Cent-Betrag, Gutschrift mit negativem Betrag zur
  Originalrechnung.
- AK3/AK4 Gegenfälle: Ende bleibt `currentPeriodEnd`, kein Refund-Aufruf.
- AK6 Refund-Fehler ändert das Ende nicht.

## Randbedingungen (KI-UX)

- Das neue Enddatum steht bereits im Bestätigungsschritt VOR dem verbindlichen Klick (§ 312k);
  kurzer Hinweis auf anteilige Erstattung + Rechnungskorrektur per Mail, Details in Mail/Beleg.
- Datum als Satztext mit `formatDate` (mobile-first 375 px, kein Überlauf), Gekündigt-Hinweis
  behält `aria-live="polite"`.
