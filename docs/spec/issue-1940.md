# Rechnungen auch ohne aktives Abo (#1940)

Ändert bewusst #1902 AK3 (dort: ohne Abo nur ein Hinweis). Komponente: `SubscriptionSection`.

## Ziel / Vorbedingung

Konto im Tab „Pakete & Abo“; die Rechnungen werden immer geladen (`listBillingInvoices`).

## Schritte / erwartetes Ergebnis

1. **Kein Abo (`subscription === null`), ≥ 1 Rechnung:** Hinweis `subscription-empty` UND ein `KolDetails` mit `billing-invoices` (Nummer, Zeitraum, Betrag) (AK1).
2. **Kein Abo, 0 Rechnungen (auch während Laden / bei Ladefehler):** keine Rechnungsgruppe (AK2).
3. **Kein Abo:** kein `cancel-subscription` (AK3).
4. **Gruppen-Label:** „Rechnungen“ ohne Kündigungsmöglichkeit (kein Abo, Store-Abo, PayPal im nativen Kanal); „Rechnungen und Kündigung“ bei PayPal im Web (AK4).
5. **375 px, kein Abo, Rechnungen:** aufgeklappte Liste ohne horizontalen Überlauf (AK5).
6. Mit Abo und `subscription === undefined` unverändert (#1902).
