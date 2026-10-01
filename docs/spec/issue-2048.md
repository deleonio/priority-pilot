# Spec #2048 — Gekündigtes Abo erkennbar, zweiter Kündigungsversuch sauber abgewiesen

## Ziel

Ein gekündigtes PayPal-Abo (`status = cancelled`, `currentPeriodEnd` in der Zukunft) ist in der
Abo-Verwaltung als „gekündigt, läuft noch bis …" erkennbar, ohne Schalter „Abo kündigen". Ein
zweiter Kündigungsversuch auf der Route wird mit 409 „Das Abo ist bereits gekündigt." beantwortet
(kein 404/502, kein PayPal-Aufruf).

## Kontext

- `SubscriptionSection.tsx` bindet `canCancel` nur an provider/Kanal, nicht an den Abo-Status.
- Route `POST /billing/subscriptions/cancel` sucht nur in `OPEN_SUBSCRIPTION_STATUSES` — ein
  gekündigtes Abo fällt auf 404 durch; ein 4xx von PayPal im `active`-Zweig wird pauschal zu 502.
- `currentPeriodEnd`/`status` liefert `/auth/me` bereits — kein neues DTO-Feld nötig.

## Verhalten

### Frontend (`SubscriptionSection`)

- AK1: `provider=paypal`, `status='cancelled'`, `currentPeriodEnd` Zukunft ⇒ Hinweis (Test-ID
  `subscription-cancelled`) „Gekündigt, läuft bis <TT.MM.JJJJ>, danach Free" (Datum via
  `formatDate`); kein Schalter „Abo kündigen" (`cancel-subscription`), kein `ManagedBy`-Text.
- AK2 (Regression): `status='active'` ⇒ Schalter „Abo kündigen" wie bisher sichtbar, kein
  Gekündigt-Hinweis.
- AK3: Nach erfolgreicher Kündigung im Dialog (Serverstatus noch `active`) verschwindet der
  Schalter sofort ohne Neuladen und der Gekündigt-Hinweis mit Enddatum erscheint — lokaler
  Merker aus `onCancelled`, da der Webhook den Status noch nicht umgestellt hat.
- A11y (KI-UX): Statuswechsel assistiv wahrnehmbar (Alert mit Label oder `aria-live="polite"`),
  Zustand steht im Text (nicht allein Farbe); Warning-Rolle, kein Danger-Rot am Hinweis.

### Server (`POST /billing/subscriptions/cancel`)

- AK4: Jüngstes Abo `status='cancelled'` mit `currentPeriodEnd > now` ⇒ 409
  „Das Abo ist bereits gekündigt."; PayPal (`checkout.cancel`) wird **nicht** aufgerufen.
- AK5: `status='active'`, PayPal antwortet 4xx (z. B. 422 `SUBSCRIPTION_STATUS_INVALID`) ⇒ 409
  mit derselben Meldung; 5xx/Netzfehler bleiben 502.
- AK6: Kein Abo bzw. gekündigtes Abo mit `currentPeriodEnd` vergangen ⇒ 404
  „Kein Abo gefunden.".
- Unverändert: `approval_pending`-Zweig (#1998), Webhook-Logik, Rechnungen-Gruppe.
- OpenAPI: Cancel-Route dokumentiert zusätzlich `409`.

### AK7 (mobile-first)

- Gekündigt-Hinweis bei 375 px vollständig sichtbar, nichts geclippt (Bounding-Box innerhalb
  des Viewports).

## Testlage

- Vitest `frontend/src/components/SubscriptionSection.test.tsx` (AK1–AK3).
- node:test `server/src/express/billing-subscriptions-cancel.test.ts` (AK4–AK6),
  `server/src/express/openapi-billing-subscriptions-cancel.test.ts` (OpenAPI 409).
- e2e `frontend/e2e/issue-2048-abo-gekundigt.spec.ts` (AK1+AK7, 375 px).
