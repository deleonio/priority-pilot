# Spec #2142 — Zeitraumwechsel sofort, Wechsel-Lücke, PDF-Positionen

## Zeitraumwechsel im gleichen Paket (AK1)

- Voraussetzung: laufendes, bezahltes PayPal-Abo; Ziel = gleiches Paket, anderer Zeitraum.
- Schritte: `POST /billing/subscriptions/change/preview` und `/change`.
- Erwartet: wie Upgrade — `immediate: true`, `creditCents` = `prorateUpgrade`-Guthaben, `dueCents` = Listenpreis neu − Guthaben (min. 0); `/change` legt ein neues Abo mit reduziertem ersten Zyklus an, kein `revise`. Ablösung der Annahme aus #1913 AK2 (Test-Pflege).

## Wechsel vor der ersten Abbuchung (AK3)

- Voraussetzung: Abo aus einem Upgrade/Zeitraumwechsel, `PAYMENT.SALE.COMPLETED` steht aus (Periode endet ≤ jetzt, `creditCents` gesetzt).
- Entscheidung: Vorschau und `/change` antworten mit **409**; kein PayPal-Aufruf.

## Unverändert (AK4)

- Downgrade bleibt `revise` zum Periodenende (abgedeckt: #1912 AK6, #2049-Tests).

## Rechnungs-PDF (AK5)

- Hat die Rechnung `lineItems`, steht jede Position (Bezeichnung + Betrag, Komma-Euro) vor der `Betrag`-Zeile; ohne `lineItems` unverändert.

## AK2 (Kette)

- Nicht als roter Test gefasst (Webhook-Kette über mehrere Abos); Vorschau == Abbuchung == Rechnung liegt per #2230/#2232 vor.
