# Spec #2235 — Abgebrochener PayPal-Checkout, kein Guthaben aus unbezahltem Abo

## Ziel

Ein abgebrochener oder nie bestätigter PayPal-Checkout (`approval_pending`) blockiert nichts, erzeugt kein Guthaben und erscheint nicht als aktuelles Paket.

## Regeln

1. **Cancel-URL (AK1):** `createSubscription` sendet `application_context.cancel_url` verschieden von `return_url` (Default mit `billing=cancelled`), solange `PAYPAL_CANCEL_URL` fehlt.
2. **Neubuchung (AK2/AK3):** `POST /billing/subscriptions` antwortet nur bei `active`-Abo mit 409. Ein `approval_pending` desselben Nutzers wird vorher über den PayPal-Kündigungsruf verworfen (Zeile gelöscht, `cancel(externalSubscriptionId)` aufgerufen) und das neue Abo angelegt (201). 5xx beim Verwerfen: 502, keine neue Zeile, alte bleibt.
3. **Verrechnung (AK4/AK5):** Guthaben nur aus bezahltem Abo (`active`, gekündigt mit Restlaufzeit). Aus `approval_pending`: `/change/preview` liefert `creditCents: 0` und den vollen Preis als `dueCents`; `/change` legt kein Abo mit `creditCents > 0` an. Verrechnung aus `active` unverändert.
4. **Paketansicht (AK6):** `status === 'approval_pending'` zeigt weder „Aktuelles Paket: <Ziel>" (`SubscriptionSection`) noch „Aktuelles Paket" in der Paket-Tabelle (`PaypalPurchase`); dort „Buchen".
5. **Rückkehr (AK7):** Einstellungen mit `?billing=cancelled` rufen genau einmal `POST /billing/subscriptions/cancel` auf und entfernen den Parameter; danach ist „Buchen" verfügbar (375 px).

## Test-Pflege

`billing-subscriptions.test.ts` „AK2: zweiter POST … laufendem Abo → 409" setzte ein `approval_pending` voraus (Anlage per POST) und widerspricht Regel 2; entfernt. Der `active`-Fall steht im Test direkt darunter (AK3).
