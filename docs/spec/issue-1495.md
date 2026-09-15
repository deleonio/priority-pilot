# Spec — Issue #1495: PayPal-Anbindung, Webhook-Verarbeitung und Rechnungen

Teil-Issue T6b von #1461 (T6), baut auf #1494 (T6a, Modell `Subscription` + `PAYPAL_PLAN_IDS`).

## Neue Module (Vertrag für die Impl-Phase)

- `server/src/models/webhookEvent.ts` — `WebhookEvent`: `provider`, `externalEventId`, `eventType`,
  `rawPayload` (TEXT, unveränderter JSON-Rohbody als String), `verified` (boolean, Default `false`),
  `processedAt` (nullable Date), `receivedAt` (Date). Unique-Index `(provider, externalEventId)` —
  Dedup-Grundlage für AK3. Kein Zahlungsdatenfeld (AK9).
- `server/src/models/invoice.ts` — `Invoice`: `userId`, `subscriptionId`, `number` (String, unique,
  lückenlos aufsteigend je Kalenderjahr, Format `INV-<Jahr>-<6-stellig>`), `periodStart`, `periodEnd`,
  `amountCents` (Rechnungsbetrag, kein Zahlungsdatum-/-mittelfeld), `taxNote` (fester §19-UStG-Text),
  `deliveredAt` (nullable Date). Kein Zahlungsdatenfeld (AK9).
- `server/src/logics/paypal.ts`:
  - `verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string>, fetchImpl?: typeof fetch): Promise<'verified' | 'invalid' | 'unreachable'>`
    — ruft `POST /v1/notifications/verify-webhook-signature` auf; `fetchImpl` injizierbar für Tests
    (Fake simuliert Erreichbarkeit/Antwort, kein echter Netzaufruf in Tests).
  - `applyPlanChange(subscription, event, now: Date): Promise<void>` — Upgrade sofort, Downgrade erst
    ab `currentPeriodEnd` (AK4).
  - `isGracePeriodExpired(firstFailureAt: Date, now: Date): boolean` — `true` erst ab Tag 15 (AK7).
- `server/src/logics/invoices.ts`:
  - `nextInvoiceNumber(now: Date): Promise<string>` — lückenlos aufsteigend, robust gegen parallele
    Aufrufe (AK8).
  - `issueInvoiceForPeriod(subscription, now: Date, mailSend?: MailSender): Promise<Invoice>` — legt
    genau eine Rechnung je Abrechnungszeitraum an, kein Steuerausweis, §19-Hinweis, Zustellung über
    `logics/mail.ts`.
- `server/src/express/routes/billing.ts` — `createBillingRouter(deps): Router` mit
  `POST /webhooks/paypal` (eigene `express.raw({ type: 'application/json' })`-Middleware auf
  Router-Ebene) und `GET /billing/return` (Rückkehr-URL, AK5: löst selbst keine Planänderung aus).
  In `server/src/express/index.ts` VOR `express.json()` (Zeile 82), CSRF (Zeile 160) und
  `requireAuth` (Zeile 243) zu mounten (Impl-Phase) — die Route braucht den unveränderten Rohbody
  und ist ohne Session/CSRF erreichbar (PayPal sendet beides nicht).

## Testfälle → Dateien

Deckungsgleich mit der Testfälle-Liste im Analyse-Block der Issue (KI-ANALYSE, Harness-Kommentar):

- AK1 → `server/src/express/billing.test.ts`
- AK2 → `server/src/logics/paypal.test.ts`
- AK3 → `server/src/express/billing.test.ts`
- AK4 → `server/src/express/billing.test.ts`
- AK5 → `server/src/express/billing.test.ts`
- AK6 → `server/src/express/billing.test.ts`
- AK7 → `server/src/logics/paypal.test.ts`
- AK8 → `server/src/logics/invoices.test.ts`
- AK9 → `server/src/models/webhookEvent.test.ts` + `server/src/models/invoice.test.ts`

## Offene Fragen (aus dem Analyse-Block, nicht spec-blockierend)

- Sandbox-Zugangsdaten/Plan-IDs fehlen noch — Tests laufen ausschließlich gegen injizierte Fakes.
- PayPal-Proportionalverrechnung bei Plan-Wechsel: AK4 ist absichtlich so formuliert, dass die Antwort
  die Impl nicht ändert.
