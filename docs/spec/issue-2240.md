# Spec #2240 — Abo mit Zahlungsrückstand gilt als offen

Ein Abo mit Status `past_due` oder `suspended` ist wie `active`/`approval_pending` ein offenes Abo.

| AK  | Voraussetzung                                                | Erwartung                                                                              |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 1   | PayPal-Abo `past_due`/`suspended`, `POST .../cancel`         | 200, `checkout.cancel(externalSubscriptionId)`                                         |
| 2   | Abo `past_due`/`suspended`, `POST /billing/subscriptions`    | 409, kein Checkout, keine neue Zeile                                                   |
| 3   | PayPal-Abo `past_due`/`suspended`, Play-Kauf                 | 409                                                                                    |
| 4   | `deleteAccount(userId, { paypalClient })`                    | kündigt das Abo bei PayPal, löscht dann das Konto; Fehler der Kündigung → Konto bleibt |
| 5   | PayPal-Ende (`syncUserPlan(sub, 'free')`)                    | `User.plan` bleibt, solange ein offenes Abo eines anderen Anbieters besteht            |
| 6   | `SubscriptionSection`, PayPal-Web-Abo `past_due`/`suspended` | Knopf „Abo kündigen" sichtbar                                                          |
| 7   | `/auth/me` mit `past_due`-Abo plus `approval_pending`        | `subscription` ist das `past_due`-Abo                                                  |
