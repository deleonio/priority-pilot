# Jahrespreis als Monatsäquivalent auf Preiskarten (#1898)

**Stand:** 2026-09-30

## Ziel

Wer ein Jahresabo erwägt, sieht neben dem Monatspreis, was der Monat bei Jahreszahlung kostet. Website-Preiskarte und App-Paketmatrix (Einstellungen → Pakete) zeigen denselben Wert.

## Berechnung

`yearlyMonthlyEquivalent(yearlyCents)` in `server/src/logics/plans.ts`: `Math.floor(yearly / 12)` Cent, bei `yearly === 0` (Free) `null`. Quelle bleibt `PLAN_PRICES`, keine Preiskopie.

| Paket | yearly | Hinweis |
| ----- | ------ | ------- |
| Free  | 0      | keiner  |
| Plus  | 4790   | 3,99 €  |
| Pro   | 9590   | 7,99 €  |

## Verhalten

| Ort                                 | Erwartung                                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Website, Plus-/Pro-Karte            | Zusatzzeile `plan__yearly` aus `pricing.yearlyPerMonth` (`{price}` = Monatsäquivalent); Quartals- und Jahreszeile bleiben               |
| Website, Free-Karte                 | keine Hinweiszeile                                                                                                                      |
| Website, alle 10 Sprachen           | `pricing.yearlyPerMonth` vorhanden, enthält `{price}`                                                                                   |
| App, Monatszelle Plus/Pro           | Hinweis mit Monatsäquivalent in der Monatszelle (keine neue Tabellenzeile); Jahreszeile zeigt weiter den Gesamtbetrag (47,90 €/95,90 €) |
| App, Free-Spalte                    | unverändert „0,00 €", kein Hinweis                                                                                                      |
| App, Store-Modus (`purchase.price`) | Hinweis entfällt, wenn ein Store-Preis vorliegt                                                                                         |
| 375 px                              | Hinweis bricht um, nichts ragt aus dem Viewport                                                                                         |
