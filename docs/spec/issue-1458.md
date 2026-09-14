# Spec: Issue #1458 — T3a Plan-Kontext, Badge und kontextuelles Upgrade-Angebot

Quelle: harness marker comment (KI-ANALYSE, stand=2026-09-14T12:06:19Z) + KI-UX-Block.

## AK6/AK9 — `toApiError` erkennt `plan_required`/`quota_exhausted`, feuert `pp:plan-required`

**Ziel:** Ein 403 mit `code: plan_required` und ein 429 mit `code: quota_exhausted` werden von
`toApiError` (`frontend/src/lib/apiError.ts`) erkannt, bevor die generischen 403/429-Zweige
greifen. Beide Fälle feuern ein DOM-Event `pp:plan-required` auf `window` mit
`{ feature, requiredPlan, currentPlan }` im `detail` und liefern eine Nutzer-Meldung.

**Vorbedingung:** `ResponseError` mit Status 403 bzw. 429 und Body
`{ code: 'plan_required' | 'quota_exhausted', feature, requiredPlan, currentPlan, message }`.

**Schritte / erwartetes Ergebnis:**

1. 403 mit `code: plan_required` → `toApiError` liefert `status: 403`, eine Meldung, feuert
   `pp:plan-required` genau 1× mit `detail.feature`/`detail.requiredPlan`/`detail.currentPlan` aus
   dem Body.
2. 429 mit `code: quota_exhausted` → dasselbe, Status `429`; der 429-Zweig für den Drosselungstext
   (#1479) greift **nicht**, wenn `code: quota_exhausted` gesetzt ist (AK9: der Zweig muss vor dem
   allgemeinen 429-Text ausgewertet werden).
3. Ein regulärer 429 **ohne** `code` behält weiterhin den Drosselungstext aus #1479 (Bestandsschutz,
   bereits durch `apiError.test.ts` — Beschreibung „Drosselung (#1479)" — abgedeckt, hier nur
   erneut als Abgrenzung genannt, keine Duplizierung).
4. 403 **ohne** `code: plan_required` feuert `pp:plan-required` **nicht**.

## AK8 — CSRF-Token bleibt bei `plan_required`-403 erhalten

**Ziel:** Der CSRF-Hook in `frontend/src/api.ts` verwirft den zwischengespeicherten CSRF-Token bei
jedem 403 — außer wenn der Body `code: plan_required` trägt. Ein 403 ohne diesen Code verwirft ihn
weiterhin. Getestet auf Ebene des extrahierten Body-Codes (Vertragsprüfung), da der volle
Hook-Kreislauf (`api.ts`) noch keinen `plan_required`-Zweig kennt.

**Testfälle:** siehe `frontend/src/lib/apiError.test.ts`, Describe-Block
„toApiError — Plan-Angebot (#1458, Spec issue-1458.md)".

## Offene Fragen (nicht in dieser Phase testbar)

- AK1–AK5, AK7, AK10–AK14 (Plan-Kontext-Hook, `PlanBadge`, `PlanOfferDialog`, Settings-Paketmatrix,
  Referenzstellen, e2e) benötigen neue Komponenten/Hooks, die noch nicht existieren
  (`frontend/src/lib/usePlan.ts`, `frontend/src/components/PlanBadge.tsx`,
  `frontend/src/components/PlanOfferDialog.tsx`). Aus Zeitgründen in diesem Lauf nicht spezifiziert;
  Folgelauf ergänzt die roten Tests für diese Dateien (siehe PR-Body „Offene Fragen").
- Modal-in-Modal-Risiko (KI-UX-Block, `DependencyModal.tsx`/`QuickCaptureModal.tsx`) ist im Ticket
  unentschieden — keine AK adressiert es; wird in der Spec für AK5/AK7 nachgezogen, sobald die
  Modal-Strategie feststeht.
