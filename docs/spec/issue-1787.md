# Spec #1787 — Inline-Paket-Hinweis an Grenzstellen

Bezug: ADR 0018 Entscheidung 6, ADR 0014.

## Ziel

Ein Free-Konto sieht an den Grenzstellen `graph_weight`, `groups`, `location_reminders` einen dezenten Inline-Hinweis auf das benötigte Paket.

## Regeln

- `PlanHint` (`frontend/src/components/PlanHint.tsx`, Prop `feature`) rendert nur bei `allowed === false`; Paket aus `requiredPlan` (AK1).
- KoliBri-`KolAlert` `_type="info"`, `_hasCloser`, zugängliches Label; `KolLink` auf `/settings/pakete` (AK1, AK5). Kein Dialog (AK2).
- Schließen sperrt den Hinweis je Nutzer+Feature 7 Tage per localStorage; andere Features bleiben sichtbar (AK3).

## Testabdeckung

- AK1, AK3, AK5: `PlanHint.test.tsx`.
- AK2, AK4, AK6: E2E (`issue-1787-plan-hint.spec.ts`) — offen, siehe PR „Offene Fragen“.
