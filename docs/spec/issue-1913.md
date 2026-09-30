# Spec — Issue #1913: Paketwechsel zeigt fälligen Betrag vor dem Bestätigen

Teil (b) von #1895, baut auf #1912 ([issue-1912.md](issue-1912.md)). Tests:
`server/src/express/billing-subscriptions.test.ts` (#1913-Fälle), `frontend/src/components/PaypalDialogs.test.tsx`,
`frontend/e2e/issue-1913-upgrade-preview.spec.ts`.

## Vorschau-Endpunkt `POST /billing/subscriptions/change/preview`

- Eingabe `{ plan, period }` wie `POST /billing/subscriptions/change`; Antwort `{ creditCents, dueCents }`.
- Upgrade (höherer Rang, PayPal-Abo): dieselben Werte wie `prorateUpgrade` beim Wechsel, `dueCents = firstCycleCents`.
  Die Eingabe-Ermittlung (Periodenstart, Katalogpreise) liegt in einer gemeinsamen Hilfsfunktion, keine Rechenkopie.
- Sonst (Downgrade, gleicher Rang): `creditCents: 0`, `dueCents` = Katalogpreis von Zielpaket/Zeitraum.
- Keine Nebenwirkung: kein PayPal-Aufruf, keine DB-Schreibung.
- Fehler wie beim Wechsel: 401 ohne Anmeldung, 400 bei ungültigem plan/period, 404 ohne Abo.

## Wechsel-Dialog (`ChangeDialog`)

- Lädt die Vorschau beim Öffnen (`api.previewBillingChange`); Laden: `KolSpin`; „Wechseln bestätigen" bleibt bis zur
  geladenen Vorschau deaktiviert. Fehler: `KolAlert` „Vorschau nicht verfügbar", Wechsel bleibt blockiert.
- Anzeige: „Guthaben" (nur bei `creditCents > 0`) und „Fällig beim ersten Zyklus", Format `formatEuro`.
- Veraltete Antworten bei wechselndem Ziel werden verworfen.
- 375 px: Text vollständig sichtbar, Prüfung per Bounding-Box.

## Offen

- „Lokalisiert formatiert" (AK4): Vertrag folgt `formatEuro` (deutsch), konsistent zur Paketübersicht.
- `billing.spec.ts` AK3 prüft „Restbetrag"/„angerechnet" im Dialog; der UX-Block ersetzt den Satz durch die
  Betragsliste → Test-Pflege in der Impl-Phase.
