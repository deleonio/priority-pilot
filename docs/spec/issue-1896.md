# Spec #1896 — Kündigung wirkt bei PayPal erst zum Laufzeitende

Ziel: Kündigung und Downgrade lassen das bezahlte Paket bis `currentPeriodEnd` laufen, danach gilt das niedrigere Paket. Keine Erstattung.

## PayPal-Kündigung (`BILLING.SUBSCRIPTION.CANCELLED`)

- Vorbedingung: aktives Abo `pro`/`plus`, `currentPeriodEnd` in der Zukunft.
- Schritte: verifizierter Webhook `CANCELLED`.
- Erwartung: `plan` und `User.plan` bleiben unverändert, `status = cancelled`, `pendingPlan = free`, `pendingPlanEffectiveAt = currentPeriodEnd`; `currentPeriodEnd` bleibt (AK3, AK7).
- Nach `currentPeriodEnd`: `applyDuePendingPlan` (aufgerufen von `/auth/me`) setzt `plan` und `User.plan` auf `free`; planpflichtige Schreibrouten antworten 403 `plan_required` (AK3).
- Ist `currentPeriodEnd <= now`, ist die Vormerkung sofort fällig und `free` gilt beim nächsten Lesen (AK4).

## `BILLING.SUBSCRIPTION.EXPIRED`

Setzt weiterhin sofort `free` (AK4).

## Bereits abgedeckt (keine neuen Tests)

AK1 (`billing.test.ts` Downgrade/AK4), AK2/AK5 (`googlePlayProvider.test.ts`, `billing-google.test.ts`), AK6 (`frontend/e2e/billing.spec.ts`).
