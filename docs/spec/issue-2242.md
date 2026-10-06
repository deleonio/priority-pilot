# Spec #2242 — Admin-Sperre kündigt das PayPal-Abo

**Ziel:** Nach der Admin-Sperre bucht PayPal nicht weiter, und eine späte Abbuchung hebt die Sperre nicht auf.

## Sperre (`POST /admin/users/:id/subscription/lock`)

- Voraussetzung: Abo vorhanden (sonst 404).
- Schritte: lokal sperren (`Subscription.status = locked`, `User.plan = free`); danach bei `provider !== 'google'` das PayPal-Abo über `cancel(externalSubscriptionId)` genau einmal kündigen.
- Ergebnis: 200 mit `subscriptionStatus: 'locked'`.
- PayPal 404/422 (bereits gekündigt, Muster #2276) → 200.
- Jeder andere Fehler (5xx, 401, 403, 429, Netzfehler) → 502; die lokale Sperre bleibt, ein erneutes Sperren versucht die Kündigung erneut.
- Google-Play-Abo: nur lokal sperren, kein `cancel` (200).

## Zahlungseingang (`PAYMENT.SALE.COMPLETED`)

- Auf ein `locked`-Abo: Status bleibt `locked`, `User.plan` bleibt `free`, auch bei wiederholter Abbuchung. Die Rechnung für die eingegangene Zahlung entsteht weiterhin.
- Nicht gesperrte Abos: unverändert (`active`, Verlängerung, Rechnung) — durch bestehende Tests gedeckt.

## Test-Pflege

`admin-subscriptions.test.ts` AK1 behauptete „kein PayPal-Aufruf" bei der Sperre; jetzt genau ein `cancel`.
