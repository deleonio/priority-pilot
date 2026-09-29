# Spec: #1646 — Access-Token- und Rechnungskarte: Fehler und Leer-Zustand nie gleichzeitig

## Ziel

Die Karte „Vergebene Tokens" (`ApiTokensSection`) zeigt nach dem Laden genau einen Zustand:
Liste, Leer-Zustand oder Ladefehler — nie Fehler und Leer-Zustand gleichzeitig. Die
Rechnungsliste (`SubscriptionSection`) erfüllt diese Regel bereits; ein Absicherungstest
schützt den Spiegel.

## Vorbedingung

`ApiTokensSection` bzw. `SubscriptionSection` ist gemountet, `api.listApiTokens` bzw.
`GET /api/v1/billing/invoices` ist gemockt.

## AK1 — Ladefehler zeigt keinen Leer-Zustand

**Schritte:** `api.listApiTokens` rejected.
**Erwartung:** Die Karte zeigt „Die Token-Liste konnte nicht geladen werden." — NICHT „Noch
kein Token vergeben.".

## AK2 — Leere/gefüllte Liste zeigt keinen Fehler

**Schritte:** a) `api.listApiTokens` liefert `[]`. b) `api.listApiTokens` liefert einen Token.
**Erwartung:** a) „Noch kein Token vergeben." erscheint, keine Fehlermeldung. b) Die
Token-Zeile (`data-testid="api-token-row"`) erscheint, weder Leer-Zeile noch Fehlermeldung.

## AK3 — Während des Ladens weder Fehler noch Leer-Zustand

**Schritte:** `api.listApiTokens` liefert ein Promise, das noch nicht aufgelöst ist.
**Erwartung:** Weder „Noch kein Token vergeben." noch die Fehlermeldung ist sichtbar.

## AK4 — Rechnungsliste (Absicherung, bereits erfüllt)

**Schritte:** `GET /api/v1/billing/invoices` antwortet mit Fehler (Status 500).
**Erwartung:** Der Alert „Die Rechnungen konnten nicht geladen werden." erscheint in
`billing-invoices`, `invoices-empty` hat Anzahl 0.
