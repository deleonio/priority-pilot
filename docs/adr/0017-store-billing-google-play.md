# ADR 0017 — Store-Billing: Google Play Billing mit eigener Server-Verifikation

- **Status:** Accepted (2026-09-24), Preisgestaltung offen
- **Datum:** 2026-09-24
- **Kontext:** [ADR 0016](0016-nativer-wrapper-capacitor-remote-modus.md) (Kanal `play`, ein Zahlungsweg pro Kanal), [ADR 0013](0013-zahlungsweg-paypal-abos.md) (PayPal im Web, Store-Billing vertagt), [Plan native Apps](../plan-native-apps.md) Stufe 2, [Epic #1664](https://github.com/deleonio/priority-pilot/issues/1664)

## Kontext

Die Android-App (ADR 0016) soll in Stufe 2 Abos verkaufen. Für digitale Abos in einer Play-App schreibt Google sein eigenes Billing vor, Google Play Billing. Google Pay ist nur eine Zahlungsart und dafür nicht zulässig. ADR 0013 hat den Store-Weg vertagt, bis es einen nativen Wrapper gibt. Den gibt es jetzt.

Zu klären waren fünf Punkte: mit welchem Plugin die App kauft, wer den Kauf prüft, was der Store kostet, wer die Rechnung stellt und ob das alternative Billing im EWR in Frage kommt.

Das Fundament steht schon. `subscriptions.provider` nimmt weitere Anbieter auf, welche Funktionen jemand nutzen darf, hängt nur am Abo-Status in `/auth/me`, und der PayPal-Weg zeigt das Muster aus verifiziertem Ereignis und anschließendem Planwechsel.

## Entscheidung

**1. Plugin `cordova-plugin-purchase` mit eigener Server-Verifikation.** Das Plugin (CdvPurchase) läuft unter Capacitor und deckt später auch StoreKit für iOS ab. Die App schließt den Kauf ab und schickt den Kauf-Token an den Server. Der Server prüft ihn über die Play Developer API (`purchases.subscriptionsv2.get`), ordnet ihn über die beim Kauf gesetzte `obfuscatedAccountId` dem Nutzer zu, bestätigt ihn (`acknowledge`) und schreibt erst dann das Abo mit dem Provider `google_play`. Einen Token, der zu einem anderen Konto gehört, lehnt er ab.

Verlängerung, Kulanzzeit, Sperre, Kündigung, Ablauf und Widerruf meldet Google über Real-time Developer Notifications (RTDN, Pub/Sub-Push). Der Server behandelt sie wie die PayPal-Webhooks: annehmen, speichern, beim Anbieter nachprüfen und erst danach den Plan setzen. Der vorhandene Kulanz- und Downgrade-Pfad (`firstFailureAt`, T7) gilt unverändert.

Begründung: kein weiterer Auftragsverarbeiter mit Sitz in den USA (Linie aus ADR 0013) und keine Umsatzbeteiligung eines Dienstleisters.

**2. Produkte je Paket, Base Plans je Zeitraum.** In der Play Console gibt es die Abo-Produkte `pro`, `max` und `ultimate`, jeweils mit den Base Plans `monthly`, `quarterly` und `yearly`. Die Zuordnung steht in `server/src/logics/plans.ts` neben den PayPal-Plan-IDs. Ein Upgrade wirkt sofort, ein Downgrade zum Ende der Periode, beides über die Replacement-Modes von Google Play.

**3. Store-Gebühr 15 %.** Für Abos berechnet Google im EWR seit dem 30.06.2026 eine Servicegebühr von 10 % und für Google Play Billing eine Billing-Gebühr von 5 %, zusammen 15 % ([Play Console Hilfe](https://support.google.com/googleplay/android-developer/answer/16954621)). Die Gebühr wird vom Preis ohne Umsatzsteuer berechnet.

**4. Google ist Merchant of Record, wir stellen keine Rechnung.** Google verkauft an den Kunden, zieht die Umsatzsteuer des Kundenlandes ein, führt sie ab und stellt den Beleg aus. Für Store-Abos erzeugt der Server keine Rechnung. Die eigene Rechnungserzeugung aus ADR 0013 bleibt auf den PayPal-Weg beschränkt.

**5. Alternatives Billing im EWR vorerst nicht.** Google erlaubt im EWR einen eigenen Abwickler neben oder statt Google Play Billing. Das spart die Billing-Gebühr von 5 %, dafür fallen die Gebühren des eigenen Abwicklers an. Nötig wären ein zweiter Kaufweg in der App, eigener Support für Rückbuchungen und Streitfälle sowie die Alternative-Billing-API. Die Programmdetails zum neuen Gebührenmodell hat Google noch nicht veröffentlicht (Stand September 2026). Die Option bleibt vermerkt und wird neu bewertet, wenn der Store-Umsatz eine Rolle spielt.

## Erlös im Vergleich

Beispiel für einen Kunden in Deutschland. Im Web gilt die Kleinunternehmerregelung, der Preis enthält keine Umsatzsteuer. Im Store zieht Google 19 % Umsatzsteuer ab und berechnet die Gebühr vom Rest.

| Weg                             | Netto bei 7,99 € (Pro monatlich) | Netto bei 239,90 € (Ultimate jährlich) |
| ------------------------------- | -------------------------------- | -------------------------------------- |
| PayPal direkt (ADR 0013)        | 7,44 €                           | 233,58 €                               |
| Google Play zum gleichen Preis  | 5,71 €                           | 171,36 €                               |
| Google Play mit gleichem Erlös¹ | 7,44 € bei rund 10,42 €          | 233,58 € bei rund 327,01 €             |

¹ Store-Preis, der nach Umsatzsteuer und Gebühr denselben Erlös bringt wie PayPal.

## Offene Entscheidung: Preisgestaltung

Der PO entscheidet, ob die Store-Preise den Web-Preisen entsprechen oder höher liegen. Die Entscheidung muss vor dem Anlegen der Abo-Produkte in der Play Console (#1691) fallen.

- **Gleicher Preis:** einfach zu erklären, überall dieselbe Paketmatrix. Ein Store-Abo bringt je nach Paket und Zeitraum rund 23 bis 27 % weniger als ein PayPal-Abo.
- **Höherer Preis:** gleicher Erlös je Abo. Google erlaubt abweichende Preise, die App darf aber nicht auf den günstigeren Kauf im Web hinweisen (ADR 0016). Die Website zeigt weiter die Web-Preise.

## Verworfene Alternativen

**RevenueCat.** Spart 2 bis 3 Tage Serverarbeit für Beleg-Prüfung, RTDN und Lebenszyklus und bringt ein Dashboard mit. Kostenlos bis 2.500 US-$ Monatsumsatz, darüber 1 % des Umsatzes vor Store-Gebühr ([Preisseite](https://www.revenuecat.com/pricing)). Bei der erwarteten Größe bliebe der Umsatz lange unter der Schwelle. Ausschlaggebend war deshalb nicht der Preis, sondern der zusätzliche Auftragsverarbeiter in den USA, der jede Kaufhistorie sieht und einen AVV braucht. Ein späterer Wechsel bleibt möglich, weil die Abos bei Google liegen und nicht beim Dienstleister.

**Google Pay.** Ist eine Zahlungsart, kein Store-Billing, und für digitale Abos in einer Play-App nicht zulässig.

## Konsequenzen

- Der Server bekommt den Provider `google_play` mit zwei Routen: `POST /billing/google/purchase` hinter Session und CSRF, `POST /billing/google/rtdn` vor CSRF und `requireAuth` mit Prüfung des OIDC-Tokens von Pub/Sub. Für die Play Developer API braucht er einen Service-Account.
- Google erstattet Käufe, die nicht innerhalb von drei Tagen bestätigt werden, automatisch. Kann der Server einen Kauf nicht zuordnen, etwa weil schon ein Abo bei einem anderen Anbieter läuft, bestätigt er ihn nicht.
- Kündigen und Zahlungsdaten ändern laufen über die Abo-Verwaltung von Google Play. Die App verlinkt dorthin, eine eigene Kündigung gibt es für Store-Abos nicht. „Käufe wiederherstellen“ ist Pflicht in der App.
- Ein Nutzer hat höchstens ein aktives Abo über alle Anbieter (ADR 0016). Ein im Web gekauftes Abo zeigt die App nur an, ohne Kauf- oder Wechselknopf.
- Steuerlich liefert Balamentum bei Store-Käufen an Google, nicht an den Kunden. Auf die Store-Gebühr fällt nach unserem Verständnis Umsatzsteuer im Reverse-Charge-Verfahren an, das gilt auch für Kleinunternehmer. Beides klärt der PO vor dem Start mit der Steuerberatung.
- Die Datenschutzerklärung nennt Google Play als Zahlungsweg der Android-App.
