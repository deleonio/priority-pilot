# Spec #2143 — Anteilige Verrechnung beim Paket-Upgrade

Ziel: Beim Upgrade (Plus → Pro, monatlich) wird nur der ungenutzte Zeitanteil der alten Zahlung angerechnet.

| Vorbedingung                                      | Schritt                                      | Erwartung                                                                                                     |
| ------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Aktives Plus, `currentPeriodEnd` = jetzt +15 Tage | `POST /billing/subscriptions/change` (Pro)   | `creditCents` etwa halb (floor(499×14/31) … floor(499×16/28), < 499); `firstCycleCents` = 899 − `creditCents` |
| wie oben                                          | `POST /billing/subscriptions/change/preview` | gleiche `creditCents`, `dueCents` = `firstCycleCents`                                                         |
| `currentPeriodEnd` = jetzt + 1 Monat (Zahltag)    | Wechsel                                      | `creditCents` = 499, `firstCycleCents` = 400 (taggenau: 0 genutzte Tage)                                      |

Formel und Basis (Katalogpreis alt, Abrunden) bleiben aus #1895/#1912.
