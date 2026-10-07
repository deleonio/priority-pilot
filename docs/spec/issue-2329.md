# Spec #2329 — Zustimmung zum sofortigen Leistungsbeginn auf dauerhaftem Datenträger bestätigen (§ 312f BGB)

## Ziel

Der Server speichert die Zustimmung aus dem Erstkauf (#2307) mit Zeitpunkt am Abo. Die erste Rechnung
(PDF und Mail) enthält eine Vertragsbestätigung. Texte sind vorläufig; der Autor gibt sie vor dem Go-live frei.

## Vertrag (Seams für die Umsetzung)

- `POST /billing/subscriptions` verlangt im Body `withdrawalConsent: true`. Fehlt es oder ist es nicht `true`: 400, kein Abo.
- `Subscription.withdrawalConsentAt` (DATE, nullable): Serverzeit des Checkout-Starts. Neue Spalte samt Migration (`migrate.ts`).
- "Erste Rechnung" = die Nicht-Gutschrift-Rechnung mit dem frühesten `periodEnd` des Abos, sofern `withdrawalConsentAt` gesetzt ist.
- Bestätigungsabsatz (PDF und Mail) enthält: die Überschrift `Vertragsbestätigung`, Paket-Label, Laufzeit, Preis, den Satz zur Zustimmung zum sofortigen Leistungsbeginn und Kenntnisnahme vom Erlöschen des Widerrufsrechts, das Zustimmungsdatum als ISO-Datum `JJJJ-MM-TT` und den Link `/widerruf/`.
- Das PDF entsteht beim Erstbau und bleibt byte-identisch gespeichert; der Nachholversand (#2030) liefert denselben Mailtext.
- Unverändert: `/billing/subscriptions/change`, `/change/preview`, Weiterführen, Google Play (`rejectStoreChannel`).

## Schritte / erwartetes Ergebnis

1. Checkout ohne `withdrawalConsent: true` → 400, kein Abo. Mit → 201, `withdrawalConsentAt` gesetzt (Zeitpunkt des Aufrufs).
2. Erste Rechnung zu einem Abo mit Zustimmung → PDF und Mail tragen den Absatz mit Datum.
3. Folgerechnung, Gutschrift, Abo ohne gespeicherte Zustimmung → kein Absatz.

## Testfälle

- AK1/AK2: `server/src/express/billing-withdrawal-consent-2329.test.ts`
- AK3-AK5: `server/src/logics/invoices-consent-2329.test.ts`
- AK6: Bestandstests Change/Google (unverändert grün)
- AK7: `frontend/src/components/PaypalPurchase.test.tsx` (Checkout-Aufruf mit `withdrawalConsent: true`)
