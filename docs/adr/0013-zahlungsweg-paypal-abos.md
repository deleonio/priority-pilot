# ADR 0013 — Zahlungsweg: PayPal-Abos direkt, Stripe als späteres Zielbild

- **Status:** Accepted (2026-09-15)
- **Datum:** 2026-09-15
- **Kontext:** [Gesamtkonzept Monetarisierung](../gesamtkonzept-monetarisierung.md), Issue #1461 (T6), Issue #1456 (T1), Issue #1462 (T7)

## Kontext

Das Monetarisierungskonzept sieht vier Pakete mit drei Zeiträumen vor, hat den Zahlungsweg aber offengelassen: Entscheidung Nr. 1 nennt Stripe-Web-Abos als Empfehlung und verweist die endgültige Festlegung auf T6. Ohne sie lässt sich T6 nicht spezifizieren, weil Datenmodell, Webhook-Vertrag und Buchungsflow je Anbieter anders aussehen.

Zu klären waren drei Ebenen, die in der Diskussion zunächst vermischt wurden:

1. Der Zahlungsabwickler, der Abos führt, abrechnet und verwaltet (PayPal, Stripe, Paddle).
2. Die Zahlungsart, die der Kunde im Checkout wählt (PayPal, Karte, Google Pay, Apple Pay, SEPA-Lastschrift, Wero). Sie läuft immer durch einen Abwickler und ist kein eigener Anbieter.
3. Das Store-Billing, das bei In-App-Verkauf digitaler Abos auf Android und iOS verpflichtend ist.

Die Empfehlung im Konzept und in der Vorbereitung dieses ADR lautete, mit Stripe zu beginnen und PayPal als Zahlungsart darin zu führen. Der Product Owner hat sich nach Abwägung der unten aufgeführten Konsequenzen für den umgekehrten Weg entschieden: erst PayPal direkt, Stripe später. Ausschlaggebend war die Reichweite von PayPal im deutschen Markt bei gleichzeitig niedrigerer Gebührenlast ohne Stripe Billing.

## Entscheidung

Der Zahlungsweg wird in drei Phasen aufgebaut.

**Phase 1 (Gegenstand von T6): PayPal direkt.** Abwickler ist PayPal über die Subscriptions-API, angebunden ohne zwischengeschalteten Dienstleister. Vertragspartner ist die PayPal (Europe) S.à r.l. et Cie, S.C.A. mit Sitz in Luxemburg.

**Phase 2: Wero**, sobald es Abos trägt. Heute kann es das nicht — Wero ist eine vom Kunden angestoßene Echtzeitüberweisung, jede Zahlung wird einzeln freigegeben, eine automatische Verlängerung gibt es nicht. Stripe führt Wero entsprechend mit „Recurring payments: No" und schließt es für Checkout im Subscription- wie im Setup-Modus aus. Wiederkehrende Wero-Zahlungen sind für 2027 angekündigt. Phase 2 ist deshalb nicht terminiert und nicht Teil von T6.

Zu beachten ist eine Verwechslungsgefahr: Stripes Support-Tabelle der Bank-Redirects führt eine Zeile „iDEAL | Wero" mit einem Haken bei Subscriptions. Das ist das niederländische iDEAL nach der Umbenennung, eine andere Zahlungsart mit eigener ID, nicht das deutsche Wero. Auch dort schließt eine Fußnote `charge_automatically` aus.

**Phase 3: Stripe** als Zielbild, wenn Karte, Wallets und SEPA-Lastschrift dazukommen sollen oder der Verwaltungsaufwand aus Phase 1 den Gebührenvorteil aufwiegt. Stripe bündelt diese Zahlungsarten samt PayPal hinter einer Schnittstelle und bringt Abo-Verwaltung, anteilige Verrechnung, Customer Portal und Rechnungserzeugung mit.

**Store-Billing bleibt außerhalb dieser Entscheidung**, weil die App eine PWA ist und kein In-App-Kauf stattfindet. Es wird erst mit einem nativen Wrapper relevant und dann neu entschieden.

**Umsatzsteuer nach der Kleinunternehmerregelung (§19 UStG).** Rechnungen weisen keine Umsatzsteuer aus und tragen den entsprechenden Hinweis. Die Preise des Konzepts sind damit Endpreise.

**Rechnungen erzeugen wir selbst.** PayPals Subscriptions-API stellt keine Rechnungen je Abrechnungszeitraum aus; PayPal Invoicing ist ein getrenntes, manuell bedientes Produkt und nicht an den Abo-Zyklus gekoppelt. Damit fällt die ursprünglich vorgesehene Auslagerung an den Anbieter weg. Im eigenen Datenbestand stehen weiterhin keine Zahlungsdaten, nur externe Referenzen — die Rechnung selbst kommt jetzt allerdings hinzu.

**Die Provider-Schnittstelle ist tragend, nicht dekorativ.** Das Konzept sieht Checkout, Webhook-Verarbeitung, Plan-Sync und Abo-Status hinter einer schmalen Schnittstelle vor. Weil Phase 3 von Anfang an geplant ist, entscheidet ihre Qualität darüber, wie teuer der spätere Wechsel wird. Das Abo-Modell führt `provider` und anbieterspezifische Referenzen getrennt von der Fachlogik.

## Gebührenvergleich

Grundlage sind PayPals Händlerkonditionen für den Inlands- und EWR-Verkauf und [Stripes deutsche Preisseite](https://stripe.com/de/pricing), Stand September 2026. Stripe Billing schlägt mit 0,7 % des Abo-Volumens zu Buche und hat kein Freikontingent; es ist in den Stripe-Zeilen enthalten, weil Abos ohne Billing nicht gebaut werden.

| Weg                           | Gebühr          | Netto bei 7,99 € | Netto bei 239,90 € (Ultimate jährlich) |
| ----------------------------- | --------------- | ---------------- | -------------------------------------- |
| PayPal direkt (Phase 1)       | 2,49 % + 0,35 € | 7,44 €           | 233,58 €                               |
| PayPal über Stripe (Phase 3)  | dazu 0,7 %      | 7,39 €           | 231,90 €                               |
| EWR-Karte über Stripe         | 1,5 % + 0,25 €  | 7,56 €           | 234,37 €                               |
| EWR-Karte Premium über Stripe | 2,8 % + 0,25 €  | 7,46 €           | 231,25 €                               |
| Internationale Karte          | 3,15 % + 0,25 € | 7,43 €           | 230,41 €                               |
| SEPA-Lastschrift über Stripe  | 0,35 € pauschal | 7,58 €           | 237,87 €                               |

Der Unterschied zwischen Phase 1 und Phase 3 ist die Stripe-Billing-Gebühr von 0,7 % des Abo-Volumens. Bei der realistischen Umsatzgröße des Konzepts liegt die Ersparnis im niedrigen zweistelligen Eurobereich pro Jahr.

Zwei Beobachtungen für Phase 3: Premium-Karten (Firmen- und Rewards-Karten) kosten fast das Doppelte der Standardkarte, und weil die SEPA-Gebühr pauschal ist, wächst ihr Vorteil mit dem Betrag — beim Jahresabo Ultimate rund 6 € gegenüber PayPal.

## Vertragspartner und Datenschutz

Für einen deutschen Händler ist der Vertragspartner nicht die US-Muttergesellschaft, sondern die jeweilige europäische Tochter: in Phase 1 die PayPal (Europe) S.à r.l. et Cie, S.C.A. in Luxemburg, in Phase 3 die Stripe Payments Europe, Limited in Irland. Beide sind in der EU ansässig und beaufsichtigt, was den Auftragsverarbeitungsvertrag nach Art. 28 DSGVO und die Angaben in der Datenschutzerklärung vereinfacht.

Die Konzernmütter sitzen in den USA (PayPal Holdings in San José, Stripe Inc. in South San Francisco). Ein Datentransfer ins Drittland lässt sich deshalb nicht ausschließen, auch wenn der Vertragspartner europäisch ist; abgedeckt wird er über den Auftragsverarbeitungsvertrag und die Standardvertragsklauseln des Anbieters.

Drei Punkte für die Umsetzung:

- Vor dem Start ist der Auftragsverarbeitungsvertrag mit PayPal abzuschließen und die Datenschutzerklärung um den Zahlungsdienstleister zu ergänzen.
- Zahlungsdaten werden nicht bei uns gespeichert, nur externe Referenzen. Das hält die eigene Verarbeitung klein.
- Die selbst erzeugten Rechnungen sind die Ausnahme davon: Sie enthalten personenbezogene Daten, unterliegen der handels- und steuerrechtlichen Aufbewahrungsfrist und liegen in unserem System. Sie gehören ins Verarbeitungsverzeichnis. Auf dem Stripe-Weg wäre diese Verarbeitung beim Anbieter verblieben.

## Konsequenzen

- **Die Webhook-Verifikation ist ein Netzaufruf, kein lokaler HMAC.** PayPal prüft Signaturen über `POST /v1/notifications/verify-webhook-signature`, nicht über eine lokal nachrechenbare Prüfsumme. Ist PayPal nicht erreichbar, lässt sich kein Ereignis verifizieren. Die Verarbeitung muss Ereignisse deshalb annehmen, persistieren und die Verifikation wiederholen können, statt sie im Request-Zyklus abschließend zu entscheiden. Auf dem Stripe-Weg wäre die Prüfung offline möglich gewesen.
- **Der Rohbody bleibt nötig.** Die Webhook-Route wird weiterhin mit `express.raw({ type: 'application/json' })` vor dem globalen `express.json()` gemountet und liegt damit zugleich vor CSRF-Prüfung und `requireAuth`, die der Anbieter ohnehin nicht bedienen kann.
- **Der Plan wird ausschließlich aus verifizierten Webhook-Ereignissen gesetzt.** Die Rückkehr aus dem Checkout beweist keine Zahlung, weil jeder die Rückkehr-URL aufrufen kann; sie löst nur das Neuladen der Entitlement-Map aus.
- **Rechnungserzeugung ist neuer Umfang in T6:** fortlaufende Nummer, Erzeugung je Abrechnungszeitraum, Ablage, Zustellung und eine Ansicht in den Einstellungen. Unter §19 und mit allen Beträgen unter 250 € sind die inhaltlichen Anforderungen gering, der Bau bleibt.
- **Die Kulanzfrist von 14 Tagen ist so nicht einstellbar.** PayPal wiederholt eine fehlgeschlagene Abbuchung in festen Abständen von fünf Tagen; steuerbar ist die Anzahl der Versuche, nicht der Abstand. Die Frist landet damit auf einem Vielfachen von fünf; 15 Tage (drei Versuche) ist der nächstliegende Wert zur ursprünglichen Festlegung. Danach greift der Downgrade-Pfad aus T7 (#1462).
- **Es gibt kein Customer Portal.** Kündigen, Paketwechsel und Rechnungsabruf bauen wir selbst. Kunden können wiederkehrende Zahlungen zusätzlich in ihrem PayPal-Konto beenden; dieser Weg läuft an unserer Oberfläche vorbei und muss über die Webhook-Ereignisse zurückgespielt werden, sonst driften Abo-Status und Plan auseinander.
- **„Upgrades wirken sofort, Downgrades zum Periodenende" ist zu verifizieren.** Stripe liefert die anteilige Verrechnung mit; bei PayPal ist vor der Umsetzung zu klären, ob der Wechsel eines laufenden Abos den Restzeitraum verrechnet oder ob wir den Sofort-Effekt selbst herstellen müssen.
- **Der Wechsel zu Phase 3 ist kein Refactoring.** Zahlungsermächtigungen liegen beim Anbieter und lassen sich nicht übertragen; jeder zahlende Kunde müsste sein Abo neu abschließen. Der Zeitpunkt für Phase 3 ist deshalb möglichst früh zu wählen, solange die Zahl der Bestandsabos klein ist, oder gar nicht.
- **Die Ersparnis beträgt 0,7 % des Abo-Volumens** gegenüber dem Weg über Stripe.
- **Nutzer ohne PayPal-Konto können nicht buchen.** In Phase 1 gibt es dazu keine Abhilfe, weil weitere Zahlungsarten einen zweiten Abwickler bräuchten. Auf dem Stripe-Weg wäre es ein Schalter im Dashboard gewesen.
- **Fällt die Kleinunternehmerregelung später weg**, muss der eigene Rechnungsgenerator Umsatzsteuer nach dem Bestimmungslandprinzip ausweisen können. Der Code darf sich deshalb nirgends darauf festlegen, dass keine Steuer anfällt.
