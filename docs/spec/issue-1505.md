# Spec — Issue #1505: Abo-Routen für Anlegen, Kündigen, Wechsel und Rechnungsabruf

Teil-Issue T6d von #1461 (T6), baut auf #1494 (T6a, Modell `Subscription`) und #1495 (T6b, Modell
`Invoice`, `logics/paypal.ts`). Vier neue, authentifizierte Routen (hinter `requireAuth`) plus
Erweiterung von `GET /auth/me`.

## Neue Module (Vertrag für die Impl-Phase)

- `server/src/logics/paypal.ts` — neuer injizierbarer Client-Typ neben `PaypalVerifier`
  (Vorbild-Musterhinweis im Harness-Kommentar: "`AppDeps.paypalVerifier` als Muster für einen
  injizierbaren PayPal-Client"):

  ```ts
  export interface PaypalClient {
  	createSubscription(planId: string): Promise<{ approvalUrl: string; externalSubscriptionId: string }>;
  	cancel(externalSubscriptionId: string): Promise<void>;
  	revise(externalSubscriptionId: string, targetPlanId: string): Promise<{ approvalUrl?: string }>;
  }
  ```

- `server/src/express/routes/billingSubscriptions.ts` — `createBillingSubscriptionsRouter(deps): Router`
  mit den vier Routen (siehe unten). Gemountet in `index.ts` HINTER `app.use(requireAuth)` (anders
  als der bestehende, öffentliche `createBillingRouter` aus #1495) — Impl-Entscheidung.
- `server/src/express/index.ts` — `AppDeps.paypalClient?: PaypalClient` (neuer, injizierbarer Eintrag,
  Muster `paypalVerifier`/`obsidianGithubClient`).

### Routen

- `POST /billing/subscriptions` `{ plan, period }` — AK1: legt `Subscription` mit
  `status: 'approval_pending'` an, liefert `{ approvalUrl }` aus `client.createSubscription()`.
  AK2: 409, wenn für den Nutzer bereits ein Abo mit Status `active` oder `approval_pending` existiert.
- `POST /billing/subscriptions/cancel` — AK3: ruft `client.cancel(externalSubscriptionId)` auf;
  `plan` am Datensatz bleibt unverändert (Wirksamkeit erst über das Webhook-Ereignis, ADR 0013,
  Präzedenz #1495 AK5/AK6).
- `POST /billing/subscriptions/change` `{ plan, period }` — AK4: ruft
  `client.revise(externalSubscriptionId, targetPlanId)` auf, liefert `{ approvalUrl }`, falls der
  Client eine liefert (sonst kein `approvalUrl`-Feld/`undefined`); `plan` am Datensatz bleibt
  unverändert.
- `GET /billing/invoices` — AK5: `Invoice`-Zeilen des angemeldeten Nutzers (`userId`-Filter).
- `GET /billing/invoices/{id}` — AK5: 404 bei fremder oder nicht existierender Rechnung (Muster
  `ownerScope`/404-statt-403, wie `apiTokens.ts`).

Alle vier Routen: 401 ohne Session (AK7) — ergibt sich bereits aus der Mount-Position hinter dem
globalen `app.use(requireAuth)`, unabhängig davon, ob der Router selbst schon existiert.

### `/auth/me`

- `server/src/express/routes/auth.ts` — `subscription`-Objekt um `pendingPlan`,
  `pendingPlanEffectiveAt`, `graceUntil` ergänzen (AK6). `pendingPlan`/`pendingPlanEffectiveAt`
  kommen vom bestehenden `Subscription`-Modell (#1495 AK4); `graceUntil` ist bis zur Umsetzung von
  T6e (#1506, Kulanzfrist) konstant `null`.

### `openapi.yml`

- AK8: die vier Routen (Request-/Response-Schemas, Statuscodes 200/201/401/404/409) sowie das
  erweiterte `subscription`-Schema in `/auth/me` (falls dort noch nicht vorhanden — `/auth/me` ist
  im Vertrag aktuell nicht dokumentiert; die Impl-Phase ergänzt es als Teil dieses Issues, da AK6
  es erstmals vertraglich verlangt).

### AK9

Bereits durch bestehende Tests abgedeckt (kein neuer Test — Dedup, siehe unten):
`server/src/models/subscription.test.ts` und `server/src/models/invoice.test.ts` prüfen je, dass
die Modelle kein Zahlungsdatenfeld tragen. #1505 führt keine neuen Felder an diesen Modellen ein.

## Testfälle → Dateien

- AK1, AK2, AK3, AK4, AK7 → `server/src/express/billing-subscriptions.test.ts`
- AK5 → `server/src/express/billing-subscriptions.test.ts`
- AK6 → `server/src/express/auth.test.ts`
- AK8 → `server/src/express/openapi-billing-subscriptions.test.ts`
- AK9 → keine neuen Tests (Dedup, s. o.)

## Offene Fragen (aus dem Analyse-Block, nicht spec-blockierend)

- Proportionalverrechnung bei Revise (Offene Frage im Harness-Kommentar) bestimmt laut Analyse nur
  den Hinweistext in T6c — kein Einfluss auf diese Routen/Tests.
