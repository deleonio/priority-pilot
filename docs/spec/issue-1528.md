# Spec #1528 — Paket-Badge statt Angebots-Dialog

## Ziel

Der globale Angebots-Dialog (`PlanOfferDialog`, `pp:plan-required`-Event) entfällt. Das Paket-Badge
beschriftet Funktion und Paket direkt an der Bedienstelle; außerhalb von Modalen führt es als
Navigationsziel auf den Pakete-Reiter. Server-Ablehnungen erscheinen inline (Autoren-Entscheidung
„Vorschlag B", 2026-09-17).

## Annahmen

- Grünes „enthalten"-Badge hat nirgends ein Klickziel (Analyse-Annahme, UX bestätigt).
- Badge-in-Modal wird über die Prop `inModal` an `PlanBadge` signalisiert (QuickCaptureModal,
  DependencyModal, GroupFormDialog).
- `planRequiredDetail` in `apiError.ts` bleibt erhalten (unterscheidet Paket-403/429 von CSRF-403
  und echtem Rate-Limit); nur der Event-Dispatch fällt weg.

## AK1 — Kein Angebots-Dialog

`PlanOfferDialog.tsx` und `useClosingOnPlanRequired.ts` sind gelöscht, `pp:plan-required` wird
nirgends dispatched, kein `PlanOfferDialog` im DOM. Prüfung: Löschung + TF1-Spy + e2e (TF5);
Code-Löschung selbst ist kein eigener Test (String-Match ohne Zähne).

## AK2 — Beschriftung (TF2, `PlanBadge.test.tsx`)

Jedes Badge nennt Funktion (`featureOffer(feature).title`) und Paketname (`planLabel`); bei
`allowed: true` zusätzlich grünes Häkchen mit Text („enthalten", WCAG 1.4.1). Der (i)-Schalter
(`plan-badge-info-{feature}`) ist entfallen.

## AK3 — Klick-Verhalten (TF3, `PlanBadge.test.tsx`)

Außerhalb von Modalen: Klick navigiert auf `/settings/pakete` (Tab 6). Innerhalb von Modalen
(`inModal: true`): kein Klickziel, kein Fokus-Stopp (UX: KolBadge pur). Eingetippter Text bleibt.

## AK4 — Inline-Meldung statt Dialog (TF1, `apiError.test.ts`)

`toApiError` bei 403 `plan_required` / 429 `quota_exhausted`: kein `pp:plan-required`-Dispatch;
Message nennt nötiges Paket und den Weg zum Pakete-Reiter („Einstellungen → Pakete"). Anzeige
erfolgt als `KolAlert _type="error"` in der Fehlerzeile der jeweiligen Ansicht (Bestandsmuster).

## AK5 — Knip

Gate-Prüfung (`pnpm knip`), kein eigener Test (ADR 0001): keine toten Exporte
(`PLAN_REQUIRED_EVENT`, ggf. `featureOffer().benefit`) nach dem Löschen.

## Test-Pflege (aus #1458)

Die bisherigen PlanOfferDialog-Tests (Unit `PlanBadge.test.tsx` AK5/AK7-Block, apiError-
„feuert pp:plan-required"-Erwartungen, e2e `issue-1484-plan-badges.spec.ts` Dialog-Anteile)
widersprechen AK1/AK4 und werden mit der Umsetzung entfernt/umgebaut.
