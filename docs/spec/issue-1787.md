# Spec #1787 — Inline-Paket-Hinweis an Grenzstellen

Bezug: ADR 0018 Entscheidung 6, ADR 0014.

## Ziel

Ein Free-Konto sieht an den Grenzstellen `graph_weight`, `groups`, `location_reminders` einen dezenten Inline-Hinweis auf das benötigte Paket.

## Regeln

- `PlanHint` (`frontend/src/components/PlanHint.tsx`, Prop `feature`) rendert nur bei `allowed === false`; Paket aus `requiredPlan` (AK1).
- KoliBri-`KolAlert` `_type="info"`, `_hasCloser`, zugängliches Label; natives `<a>` auf `/settings/pakete` statt `KolLink` (Muster `PlanBadgeLink`; im Modal mit `BASE_URL`-Präfix in neuem Tab) (AK1, AK5). Kein Dialog (AK2).
- Schließen sperrt den Hinweis je Gerät+Feature 7 Tage per localStorage (Schlüssel `pp-plan-hint-<feature>` ohne User-Id — bewusste Abweichung, siehe PR-Beschreibung); andere Features bleiben sichtbar (AK3).

## Testabdeckung

- AK1, AK3, AK5: `PlanHint.test.tsx`.
- AK1 (alle drei Grenzstellen), AK2, AK4, AK6: E2E (`issue-1787-plan-hint.spec.ts`).
