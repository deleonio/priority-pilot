# Spec #2243 — Späte Abbuchung auf gekündigtem Abo wird nicht reaktiviert

## Ziel

Ein `PAYMENT.SALE.COMPLETED` auf einer `cancelled`-Zeile (gekündigt oder durch Paketwechsel abgelöst,
#1912) belebt das Abo nicht wieder: kein Statuswechsel, keine Verlängerung, keine Rechnung, kein
Paketwechsel am Konto. Der Fall wird per `console.warn` sichtbar protokolliert (Erstattung prüfen).

## Voraussetzungen

- Verifizierter Webhook erreicht `/webhooks/paypal`, Abo-Suche über `billing_agreement_id`.
- Heute setzt der Zweig `PAYMENT.SALE.COMPLETED` in `applyPaymentEvent` (`paypal.ts`) jede Nicht-`locked`-Zeile
  auf `active`, verlängert `currentPeriodEnd` und stellt eine Rechnung aus.

## Verhalten

1. Status `cancelled` → früh zurück: `status`, `plan`, `currentPeriodEnd`, Vormerkungen und `User.plan`
   bleiben unverändert, es entsteht keine Rechnung.
2. `console.warn` mit externer Abo-ID und Sale-ID (`resource.id`).
3. Antwort 200, das Ereignis gilt als verarbeitet (sonst wiederholt PayPal endlos).
4. Unverändert: `active`/`approval_pending`/`locked` (#2231, #2140, #2242) und unbekanntes Abo (#2237 AK4).
   Eine automatische Erstattung gehört nicht zu diesem Ticket.

## Testfälle

- AK1+AK2: gekündigte Zeile mit laufender Periode → nichts ändert sich, 0 Rechnungen, Warnung, 200.
- AK1: abgelöste Zeile (`plan: 'free'`) neben aktiver Zeile desselben Nutzers → beide Zeilen und `User.plan`
  unverändert, 0 Rechnungen.
- AK3/AK4: durch Bestandstests (#2237 AK4, #2242, #2231) abgedeckt, keine neuen Tests.
