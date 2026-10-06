# Spec #2308 — Verträge hier kündigen (Kündigungsbutton und Bestätigungsschritt)

Grundlage: § 312k BGB (Kündigungsbutton). Der bestehende `CancelDialog` in `SubscriptionSection.tsx` wird zum
Bestätigungsschritt erweitert, keine eigene Route. Kündigung ohne Login ist nicht Teil (#2317).

## Ziel

Ein Kunde mit laufendem PayPal-Abo kündigt mit zwei Schritten und erhält die Bestätigung per Mail.

## Vorbedingung

PayPal-Abo im Web mit Status `active`/`past_due`/`suspended` (nicht `cancelled`); Google Play ausgenommen.

## Ablauf

1. Der Button „Verträge hier kündigen" (`data-testid="cancel-subscription"`) steht im Abo-Bereich ohne Aufklappen. Das `KolDetails` heißt „Rechnungen". (AK1)
2. Der Dialog zeigt Paket und Laufzeit (nur lesend), Art `KolInputRadio` „Ordentlich" (Default) / „Außerordentlich", bei außerordentlich das Pflichtfeld „Grund" (`KolTextarea`), „zum Ende der Laufzeit" mit Datum aus `currentPeriodEnd`, E-Mail-Feld (`KolInputEmail`, vorbelegt mit der Konto-Adresse). Buttons „Abbrechen" und „Jetzt kündigen". (AK2/AK3)
3. „Jetzt kündigen" sendet `POST /billing/subscriptions/cancel` mit `{ kind: 'ordinary' | 'extraordinary', reason?, email }`; `reason` fehlt bei ordentlich. Danach der Gekündigt-Zustand aus #2048. (AK4)
4. Route: 400 bei außerordentlich ohne (leeren) Grund, ungültiger/fehlender E-Mail oder unbekannter Art — vor dem PayPal-Aufruf. Der `approval_pending`-Pfad und die 404/409-Zweige aus #2048 bleiben. Bei Erfolg Speicherung am Abo: `cancellationKind`, `cancellationReason`, `cancellationEmail`, `cancellationRequestedAt` (nullable Spalten). (AK4)
5. Außerordentlich: zusätzlich genau eine Mail mit Grund und Nutzer an jede Adresse aus `ADMIN_EMAILS` (Versand über `AppDeps.mailSender`); ordentlich: keine Betreiber-Mail. (AK5)
6. Webhook `BILLING.SUBSCRIPTION.CANCELLED` auf laufendes Abo: `applyPlanChange(subscription, event, now, send?)` verschickt genau eine Mail an `cancellationEmail` (sonst Konto-Adresse) mit Kündigungsdatum (`cancellationRequestedAt`, sonst `now`), Vertragsende (`currentPeriodEnd`), Art (ohne gespeicherte Art: ordentlich) und bei außerordentlich dem Grund. Kein Kundenversand in der Route. (AK6)
7. Keine Mail bei erneutem CANCELLED auf ein gekündigtes Abo, beim abgelösten Abo (#1912) und bei `EXPIRED`. (AK7)
8. Bei 375 px sind Button, Felder und Dialog-Buttons vollständig sichtbar (Bounding-Box). (AK8)

## Tests

| AK  | Test                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------- |
| 1–4 | `frontend/src/components/SubscriptionSection.test.tsx`, `frontend/e2e/issue-2308-kuendigungsbutton.spec.ts` |
| 4/5 | `server/src/express/billing-subscriptions-cancel.test.ts`, `openapi-billing-subscriptions-cancel.test.ts`   |
| 6/7 | `server/src/logics/cancellationMail.test.ts`                                                                |
| 8   | `frontend/e2e/issue-2308-kuendigungsbutton.spec.ts`                                                         |
