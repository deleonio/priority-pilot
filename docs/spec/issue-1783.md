# Spec #1783 — KI-Hilfe: Fair-Use-Drossel statt hartem Kontingent

PO-Entscheidung 2026-09-29: Anfragen werden weiter gezählt (unsichtbar), Richtwert Plus 150 / Pro 400. Über dem Budget keine Sperre, sondern Ratenlimit je Nutzer.

## Server (`server/src/express/ai-fair-use.test.ts`)

- **Unter dem Budget:** Anfrage wird beantwortet, `AiUsage.count` +1, Antwort ohne `quotaRemaining`.
- **Über dem Budget** (Zähler >= Budget, Rollout an, kein eigener Provider): erste Anfrage 200 mit `fairUse: 'throttled'`; zweite Anfrage im Intervall 429 `code: 'ai_throttled'` mit `Retry-After` > 0. Abgewiesene Anfragen zählen nicht. Keine Obergrenze (3x Budget wird weiter beantwortet).
- **Budgets:** Plus 150, Pro 400.
- **Rollout aus:** nie gedrosselt.
- **`/auth/me`:** Entitlement `ai_assist` ohne `quotaRemaining`.

## Admin (`server/src/express/admin.api.test.ts` bleibt, neue Tests in `ai-fair-use.test.ts`)

- `GET /admin/users` liefert je Nutzer `aiRequestsThisMonth` (0 ohne `AiUsage`-Eintrag).

## Website (`website/src/i18n-ai-quota.test.ts`)

- `pricing.aiQuota` enthaelt in keiner der 10 Sprachen `{count}`.

## Nicht in Rot-Tests (Impl-Phase)

- AK5 (Hinweis in Schnellerfassung, 375 px) und AK7-UI: Verhalten haengt am Impl-Design des `KolAlert`/der Admin-Spalte; Vitest/E2E kommen mit der Umsetzung.
