# Spec #1927 — Feedback für alle Pakete

**Ziel:** Feedback/Support ist ein Feature des Katalogs (`feedback`), in Free, Plus und Pro enthalten.

**Vorbedingung:** Muster `voice_input` (paketungebundenes Feature ohne Guard).

**Schritte / erwartetes Ergebnis**

1. `FEATURE_CATALOG` enthält `{ feature: 'feedback', allowedPlans: ['free','plus','pro'] }`; `FEATURE_IDS` und OpenAPI-Enum führen `feedback` (AK1).
2. `getEntitlements(plan).feedback` = `{ allowed: true, requiredPlan: 'free' }` für jedes Paket (AK2).
3. Website: `addedFeatures(catalog, PLAN_VALUES, 'free')` enthält `feedback`; Free-Karte trägt `pricing.features.feedback` in allen 10 Sprachen, Plus/Pro erben über „Alles aus Free“ (AK3).
4. `POST /feedback` als Free-Nutzer mit `MONETIZATION_ENFORCED=true` → 201, kein 403 `plan_required` (AK4).
5. `feedback_send` mit Nur-Lese-Token bleibt aufrufbar (AK5, Bestand `server/src/mcp/feedback-send.test.ts`, unverändert).

**Test-Pflege:** `plans.test.ts` Zähltest (acht → neun Identifier) und `render.test.ts` `addedFeatures(free)` (+ `feedback`) angepasst.
