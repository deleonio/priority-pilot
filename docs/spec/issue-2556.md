# Spec #2556 — Regel „Guthaben deckt den ersten Zyklus“ an einer Stelle

G = Guthaben (`creditCents`), P = Katalogpreis `getPlansCatalog().prices[plan][period]`.

## Eine Funktion als einzige Vergleichsstelle (AK2)

`server/src/logics/paypal.ts` exportiert `coversFirstCycle(subscription)` mit der Regel `G >= P`. Alle drei bisherigen Vergleichsstellen rufen sie ohne eigenen Preisvergleich auf:

- `paypalProvider.ts` (`applyEvent`, ACTIVATED-Zweig): `replacePredecessors` nur bei `coversFirstCycle(subscription)` (#2230).
- `paypal.ts`, `chargesOnActivation`: `G > 0 && !coversFirstCycle(subscription)` — der `G > 0`-Guard bleibt an der Stelle (kein Preisvergleich; ohne Guthaben aktiviert das Upgrade weiterhin sofort, #2238/#2049).
- `billingSubscriptions.ts`, Change-Preview: Carry-Entscheidung (#2241) über `coversFirstCycle(subscription, { amountCents, plan, period })` statt eigenem `creditCents >= price` — die Preview rechnet das Guthaben erst (Proration), daher die explizite Übergabe.

Preisquelle bleibt die live gelesene Preisliste (`getPlansCatalog()`) — keine Snapshots. Beobachtbares Verhalten bleibt identisch; die Tests sichern den Grenzfall als Spiegel zwischen den Stellen.

## Grenzfall G = P deckt überall (AK1)

- Aktivierung (`BILLING.SUBSCRIPTION.ACTIVATED`): bei `G = P` sofort `status: 'active'` — kein `approvedAt`-Aufschub bis zum Zahlungseingang.
- Change-Preview: bei `G = P` ist `creditCoversUntil` gesetzt und `dueCents` 0 (exakte Deckung, keine Gebühr). Verändert eine Implementierung die Regel (z. B. `>` statt `>=`), fehlt `creditCoversUntil` — das ist die trennscharfe Assertion.

## Vertragstests (rot)

- TF2 direkt gegen die exportierte Funktion: `G = P` → `true`; `G = P − 1` → `false`; `G = 0` → `false`.
- TF1 Grenzfall-Parität: ACTIVATED mit `G = P` aktiviert sofort; Preview mit `G = P` nennt `creditCoversUntil`. Konstruktion Preview: plus quartal → plus monatlich im 89-Tage-Fenster 1. Feb → 1. Mai (Nicht-Schaltjahr, Uhr per `mock.timers` fixiert), genau 33 Resttage — `floor(1347 · 33 / 89) = 499 = P`.
