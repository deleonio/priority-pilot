# Spec #2276 — Kontolöschung bei bereits gekündigtem PayPal-Abo

Ergänzt [issue-2240.md](issue-2240.md) AK4. Kündigung bleibt VOR der Transaktion.

| AK  | Voraussetzung                                                        | Erwartung                                                                                                |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | `past_due`-Abo, `cancel` wirft `PaypalHttpError` 404 bzw. 422        | `deleteAccount` → `'deleted'`, `DELETE /auth/me` → 200, User gelöscht                                    |
| 2   | `past_due`-Abo, `cancel` wirft `PaypalHttpError` 503 oder Netzfehler | `deleteAccount` → `'paypal_unavailable'` (kein Throw), `DELETE /auth/me` → 502 mit „PayPal“, User bleibt |
| 3   | Nicht-PayPal-Fehler in `deleteAccount` (z. B. DB-Transaktion)        | `console.error` mit dem Fehler, 500, Meldung ohne „PayPal“                                               |
