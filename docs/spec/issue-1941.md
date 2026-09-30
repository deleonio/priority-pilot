# Spec #1941 — Toter KI-Badge-/Custom-Provider-Pfad entfernt

Ziel: Das KI-Gate (`preferenceEnabled && entitlementAllowed === true`) bleibt unverändert; der seit #1903 unerreichbare Pfad fällt weg.

## Regeln

- AK1: `TaskForm` und `QuickCaptureModal` rendern bei offenem Gate kein `plan-badge-ai_assist` (Quelltext enthält kein `<PlanBadge feature="ai_assist"` mehr).
- AK2: `aiPreferences.ts` kennt kein `hasCustomProvider`, `useHasCustomLlmProvider`, `hasOwnCustomProvider` mehr; Gate-Matrix nur `preferenceEnabled` x `entitlementAllowed`.
- AK3: Keine `.skip`-Tests in `issue-1484-plan-badges.spec.ts` und `issue-1578-taskform-plan-badge.spec.ts` (leere Datei wird gelöscht).
- AK4: `useAiFeaturesGate`, `useAiFeaturesEnabled` und das Rendern von `TaskForm` rufen `api.listLlmProviders` nicht auf.
- AK5: Verhalten für Free/Plus/Pro unverändert.

## Tests

- AK1: `TaskForm.test.tsx`, `QuickCaptureModal.test.tsx`; AK4: `aiPreferences.test.tsx`, `TaskForm.test.tsx`. AK2/AK3: Nachweis per grep im Implementierungs-PR.
