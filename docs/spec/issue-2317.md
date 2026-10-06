# Spec #2317 — Kündigung ohne Login über die Website (§ 312k BGB)

Ergänzt den In-App-Weg aus #2308 (`POST /billing/subscriptions/cancel`), der unverändert bleibt.

## Seite `/kuendigen/` (AK1, AK2)

- Ziel: Kunde kündigt ohne Login. Statisch gebaut, `lang="de"`, im Footer jeder Sprachseite verlinkt (`footer.cancellation`, `hreflang="de"`, neben `/widerruf/`), in der Sitemap.
- Formular: E-Mail, Vertrag (Select Paket × Laufzeit), Art (ordentlich/außerordentlich), Grund (bei außerordentlich Pflicht), Zeitpunkt, Knopf „Jetzt kündigen“.

## Anfrage-Endpunkt (AK3, AK6)

`POST /public/cancellation/request` mit `{ email, kind, reason?, effective? }`, ohne Login.

- Antwort immer 202 `{}` — identisch für unbekannte Adresse, Adresse ohne kündbares Abo und Adresse mit offenem PayPal-Abo.
- Nur im letzten Fall genau eine Mail an die Konto-Adresse mit Link `…/kuendigen/bestaetigen/?token=<klartext>`.
- Limit je Adresse (3 je Stunde) und je IP (20 je Stunde): Überschreitung → 429 `THROTTLED_MESSAGE`, kein Mailversand.

## Token (AK4)

Modell `CancellationToken` (`server/src/models/cancellationToken.ts`, Muster `loginToken.ts`): `email`, `tokenHash` (SHA-256-Hex), `expiresAt`, `usedAt`, die Anfragedaten. Klartext nie persistiert, einmalig, läuft ab.

## Bestätigung (AK5)

- `GET /public/cancellation/confirm?token=…` ist reine Anzeige: 200, kündigt nichts, verbraucht nichts.
- `POST /public/cancellation/confirm` mit `{ token }`: ruft `checkout.cancel(externalSubscriptionId)`, speichert `cancellationKind/-Reason/-Email/-RequestedAt` am Abo, sendet `sendCancellationConfirmation` (bei außerordentlich zusätzlich die Admin-Mail) → 200 `{}`. Ungültig, abgelaufen oder verbraucht → 400, keine Kündigung.

## Bedienbarkeit (AK7)

375 px: kein horizontaler Überlauf, Absenden möglich, Rückmeldung sichtbar (Playwright `website/e2e/kuendigen.spec.ts`, Umsetzungsphase; Website-E2E ohne Backend).
