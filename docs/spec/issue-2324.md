# Spec #2324 — Paketwechsel-Dialog: Preis, Guthaben, fälliger Betrag; Downgrade zum Laufzeitende

## Vorschau (`POST /billing/subscriptions/change/preview`)

- Beide Zweige liefern `priceCents` = Katalogpreis Ziel × Laufzeit.
- Upgrade (`immediate: true`): fällig = `priceCents` − `creditCents` (Sonderregel #2241 unverändert).
- Downgrade (`immediate: false`, laufendes Abo mit niedrigerem Rang): `dueCents` 0, `startsAt` = `currentPeriodEnd`, dazu `currentPlan`/`currentPeriod` des laufenden Abos.

## Dialog

- Upgrade: Zeilen „Preis <Paket> (<Laufzeit>)“, „Guthaben aus dem laufenden Abo“ (−Betrag), Fällig-Zeile, dann „Wirksam ab“.
- Downgrade: „Aktuelles Paket bis <Datum>“, „Ab <Datum>: <Paket> für <Preis> je <Laufzeit>“, „Jetzt fällig“ 0,00 €; keine Guthaben-Zeile, keine „Wirksam ab“-Zeile.
- 375 px: keine Zeile ragt über den Viewport (Bounding-Box).

## Downgrade-Kette (AK4)

Bereits durch Bestandstests belegt, kein neuer Test: Wechsel → `revise` (`billing-subscriptions.test.ts` #1912 AK6), Webhook-Vormerkung und `applyDuePendingPlan` (`billing.test.ts` „ein Downgrade mit Zeitraumwechsel …“), Rechnung zum niedrigeren Preis (`invoices-charged.test.ts` AK2).
