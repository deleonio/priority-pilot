# Spec: Upgrade räumt ältere offene Checkouts bei PayPal ab (#2547)

## Ziel

Der Upgrade-Zweig von `POST /billing/subscriptions/change` (credited change) storniert eine
ältere offene Checkout-Zeile (`approval_pending`) vor dem neuen Anlauf **bei PayPal**
(`checkout.cancel`), bevor sie aus der DB verschwindet — Schwester-Muster von
`discardPendingCheckout` in derselben Datei. Heute löscht ein Bulk-`Subscription.destroy` die
Zeile lokal, ohne PayPal zu rufen; ein verwaistes PayPal-Abo bleibt zurück.

## Regeln

1. **Stornierung vor dem Löschen (AK1):** Ein Upgrade mit älterer `approval_pending`-Zeile
   ruft `checkout.cancel` mit deren `externalSubscriptionId` auf, solange die Zeile noch in
   der DB liegt; danach ist sie weg, das Upgrade antwortet 200 + `approvalUrl`.
2. **5xx/Netzfehler bricht ab (AK2):** Wirft `cancel` einen `PaypalHttpError` ≥ 500 oder einen
   Netzfehler, antwortet die Route 502 (‚PayPal war nicht erreichbar.‘) — die ältere Zeile
   bleibt erhalten und es entsteht kein neues Abo.
3. **4xx räumt trotzdem auf (AK3):** Wirft `cancel` einen `PaypalHttpError` < 500 (nie
   zugestimmt/nicht mehr kündbar), wird die ältere Zeile trotzdem entfernt und das Upgrade
   läuft weiter (200 + `approvalUrl`).

## Unverändert

Downgrade/Zeitraumwechsel ohne Rangsprung (`revise`-Weg), gekündigtes Abo mit Restlaufzeit
(#2049), die Aufräum-Logik von `POST /billing/subscriptions` und `.../cancel`
(`discardPendingCheckout`), Bestandstest #1912 (zwei Upgrade-Anläufe) — dessen Standard-Client
lässt das Stornieren gelingen, Assertions bleiben unverändert.
