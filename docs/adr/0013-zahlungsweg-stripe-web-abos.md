# ADR 0013 — Zahlungsweg: Stripe-Web-Abos mit PayPal als Zahlungsart

- **Status:** Accepted (2026-09-15)
- **Datum:** 2026-09-15
- **Kontext:** [Gesamtkonzept Monetarisierung](../gesamtkonzept-monetarisierung.md), Issue #1461 (T6), Issue #1456 (T1), Issue #1462 (T7)

## Kontext

Das Monetarisierungskonzept sieht vier Pakete mit drei Zeiträumen vor, hat den Zahlungsweg aber offengelassen: Entscheidung Nr. 1 nennt Stripe-Web-Abos als Empfehlung und verweist die endgültige Festlegung auf T6. Ohne sie lässt sich T6 nicht spezifizieren, weil Datenmodell, Webhook-Vertrag und Buchungsflow je Anbieter anders aussehen.

Zu klären waren drei Ebenen, die in der Diskussion zunächst vermischt wurden:

1. Der Zahlungsabwickler, der Abos führt, abrechnet und verwaltet (Stripe, PayPal, Paddle).
2. Die Zahlungsart, die der Kunde im Checkout wählt (Karte, PayPal, Google Pay, Apple Pay, SEPA-Lastschrift, Wero). Sie läuft immer durch einen Abwickler und ist kein eigener Anbieter.
3. Das Store-Billing, das bei In-App-Verkauf digitaler Abos auf Android und iOS verpflichtend ist.

## Entscheidung

**Abwickler ist Stripe**, mit Checkout Session zum Buchen und Customer Portal zum Verwalten, Kündigen und Abrufen der Rechnungen.

Ausschlaggebend ist nicht die Transaktionsgebühr, sondern dass Abo-Verwaltung, anteilige Verrechnung beim Upgrade, Kündigung zum Periodenende, Wiederholungsversuche bei Zahlungsausfall und die Rechnungserzeugung fertig vorhanden sind. Jeder dieser Punkte wäre sonst Eigenbau mit eigenem Fehlerrisiko.

**Zahlungsart zum Start ist PayPal.** Es unterstützt laut Stripes Support-Matrix Subscriptions und Customer Portal, trägt das Abo-Modell also vollständig, und ist im deutschen Markt die verbreitetste Online-Zahlungsart. Karte, Google Pay, Apple Pay und SEPA-Lastschrift unterstützen dasselbe und sind bewusst zurückgestellt; sie lassen sich im Stripe-Dashboard einschalten, ohne dass Code geändert wird. Der Preis der Beschränkung ist bekannt: Wer kein PayPal-Konto hat, kann zunächst nicht buchen.

**Wero wird nicht eingebunden.** Stripe führt Wero mit „Recurring payments: No" und schließt es für Checkout im Subscription- wie im Setup-Modus aus; der Zugang läuft zudem über ein Interessenten-Formular. Wiederkehrende Wero-Zahlungen sind für 2027 angekündigt. Der direkte Weg über eine deutsche Acquiring-Plattform wäre zwar mit unter 1 % die günstigste Transaktionsgebühr überhaupt, bringt aber monatliche Fixkosten im Bereich von 25 €, die bei der prognostizierten Umsatzgröße nicht tragen.

Zu beachten ist eine Verwechslungsgefahr in Stripes Dokumentation: Die Support-Tabelle der Bank-Redirects führt eine Zeile „iDEAL | Wero" mit einem Haken bei Subscriptions. Das ist das niederländische iDEAL nach der Umbenennung, eine andere Zahlungsart mit eigener ID, nicht das deutsche Wero. Auch dort schließt eine Fußnote `charge_automatically` aus, der Kunde müsste also jede Verlängerung einzeln bestätigen.

**Store-Billing bleibt außerhalb dieser Entscheidung**, weil die App eine PWA ist und kein In-App-Kauf stattfindet. Es wird erst mit einem nativen Wrapper relevant und dann neu entschieden.

**Umsatzsteuer nach der Kleinunternehmerregelung (§19 UStG).** Rechnungen weisen keine Umsatzsteuer aus und tragen den entsprechenden Hinweis; Stripe Tax wird nicht eingesetzt. Die Preise des Konzepts sind damit Endpreise.

**Rechnungen erzeugt Stripe Billing**, das Customer Portal stellt die Historie zum Herunterladen bereit. Es entsteht kein eigener Rechnungsgenerator. Im eigenen Datenbestand stehen nur Referenzen (Stripe-IDs), keine Beträge als zweite Wahrheit und keine Zahlungsdaten.

## Gebührenvergleich

Grundlage ist [Stripes deutsche Preisseite](https://stripe.com/de/pricing), Stand September 2026. Stripe Billing schlägt mit 0,7 % des Abo-Volumens zu Buche und hat kein Freikontingent; die Zahlen unten enthalten es, weil Abos ohne Billing nicht gebaut werden.

| Zahlungsart          | Gebühr          | Netto bei 7,99 € | Netto bei 239,90 € (Ultimate jährlich) |
| -------------------- | --------------- | ---------------- | -------------------------------------- |
| EWR-Karte (Standard) | 1,5 % + 0,25 €  | 7,56 €           | 234,37 €                               |
| EWR-Karte (Premium)  | 2,8 % + 0,25 €  | 7,46 €           | 231,25 €                               |
| Internationale Karte | 3,15 % + 0,25 € | 7,43 €           | 230,41 €                               |
| PayPal               | 2,49 % + 0,35 € | 7,39 €           | 231,90 €                               |
| SEPA-Lastschrift     | 0,35 € pauschal | 7,58 €           | 237,87 €                               |

Zwei Beobachtungen, die bei einer späteren Erweiterung zählen: Premium-Karten (Firmen- und Rewards-Karten) kosten fast das Doppelte der Standardkarte, was sich der Nutzer aussucht und nicht wir. Und weil die SEPA-Gebühr pauschal ist, wächst ihr Vorteil mit dem Betrag — beim Jahresabo Ultimate sind es rund 6 € gegenüber PayPal, bei der Monatszahlung Pro rund 0,19 €.

## Konsequenzen

- Die Webhook-Route braucht den unveränderten Rohbody für die Signaturprüfung und muss deshalb mit `express.raw({ type: 'application/json' })` vor dem globalen `express.json()` gemountet werden; damit liegt sie zugleich vor CSRF-Prüfung und `requireAuth`, die der Anbieter ohnehin nicht bedienen kann.
- Der Plan wird ausschließlich aus signierten Webhook-Ereignissen gesetzt. Die Rückkehr aus dem Checkout beweist keine Zahlung, weil jeder die Rückkehr-URL aufrufen kann; sie löst nur das Neuladen der Entitlement-Map aus.
- Die Preise stehen doppelt, in `server/src/logics/plans.ts` und als Price-IDs bei Stripe. Maßgeblich ist `plans.ts` für die Anzeige und Stripe für die Abrechnung; die Zuordnung Paket mal Zeitraum zu Price-ID liegt in `plans.ts` und führt den erwarteten Betrag in Cent mit, damit ein Test ohne Netzzugriff beide Seiten vergleichen kann.
- Nutzer ohne PayPal-Konto können zunächst nicht buchen. Die Erweiterung um Karte und Wallets ist eine Dashboard-Einstellung und braucht keinen Release.
- Ein Wechsel des Abwicklers wäre teuer: Abos, Zahlungsmittel und Rechnungshistorie liegen bei Stripe. Das Abo-Modell hält deshalb ein `provider`-Feld, damit ein zweiter Anbieter additiv danebenstehen kann.
- Fällt die Kleinunternehmerregelung später weg, ist der Wechsel eine Stripe-Konfiguration samt Stripe Tax. Der Code darf sich deshalb nirgends darauf festlegen, dass keine Steuer anfällt.
- Bei einer späteren Aufnahme der SEPA-Lastschrift ist die verzögerte Freischaltung zu lösen: Eine SEPA-Zahlung bestätigt sich erst nach Tagen, ein strikt an `invoice.paid` gekoppelter Plan ließe den Nutzer so lange warten.
- Wero wird neu bewertet, sobald Stripe wiederkehrende Wero-Zahlungen anbietet, frühestens 2027.
