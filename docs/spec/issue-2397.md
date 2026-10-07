# Spec #2397 — Synchronisation in der Paketübersicht

**Ziel:** Die Paketübersicht weist „Synchronisation über alle Geräte“ als eigene Feature-Zeile aus, mit Häkchen bei Free, Plus und Pro (PO-Entscheidung F4 in #1957). Reine Ausweisung, kein Gate.

**Vorbedingung:** Feature-Katalog in `server/src/logics/plans.ts` (Muster `voice_input`).

**Schritte / erwartetes Ergebnis:**

1. AK1: Feature-Id `sync` im Katalog mit `allowedPlans: ['free','plus','pro']`; Enum `FeatureCatalogEntry.feature` in `openapi.yml` und `FEATURE_OFFERS` (`planOffers.ts`, Titel „Synchronisation über alle Geräte“) tragen sie.
2. AK2: Website-Preiskarte Free nennt das Label (`pricing.features.sync`), in allen zehn Sprachdateien vorhanden; Plus/Pro erben es.
3. AK3: App-`PlansSection` zeigt dieselbe Zeile.
4. AK4: 375 px ohne Überlauf (bestehender Overflow-Test in `issue-1484-plan-badges.spec.ts`, jetzt 10 Feature-Zeilen).
