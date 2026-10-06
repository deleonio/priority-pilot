# Spec #2304 — Kontolöschung bei abgebrochenem PayPal-Checkout

Ergänzt [issue-2276.md](issue-2276.md). Ein PayPal-Abo in `approval_pending` (Checkout begonnen, nie bestätigt) blockiert die Löschung nicht mehr (DSGVO Art. 17). Reihenfolge in `deleteAccount`: Vorprüfung → Gruppen-Admin-Prüfung → PayPal-Kündigung → Transaktion (Checkout-Zeile verwerfen, Konto löschen).

| AK  | Voraussetzung                                                            | Erwartung                                                                                                                |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | genau ein PayPal-Abo `approval_pending`, `cancel` gelingt                | `cancel` mit `externalSubscriptionId` gerufen, `'deleted'`, `DELETE /auth/me` → 204, Subscription-Zeile weg, Sitzung tot |
| 2   | wie 1, `cancel` wirft `PaypalHttpError` 404 oder 422                     | `'deleted'`, Zeile weg                                                                                                   |
| 3   | wie 1, `cancel` wirft 5xx oder Netzfehler                                | `'paypal_unavailable'`, Konto und Zeile bleiben                                                                          |
| 4   | Abo `active`                                                             | `'subscription_active'` (409), kein `cancel`-Ruf; #2276-Verhalten (`past_due`/`suspended`) unverändert                   |
| 5   | letzter Admin einer Gruppe mit weiteren Mitgliedern + `approval_pending` | `'last_group_admin'` (409), kein `cancel`-Ruf, Zeile bleibt                                                              |
