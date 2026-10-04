# Spec #1785 — Altpakete `max`/`ultimate` zurückbauen

**Stand:** 2026-10-04

Die App kennt nur die Pakete `free`/`plus`/`pro`; es gibt keine Übergangslogik für Bestandskunden.

## Migration `migrateLegacyPlans(db)`

Beim Serverstart setzt `migrateLegacyPlans` (`server/src/logics/migrate.ts`) alte Paketwerte auf
das Free/Plus/Pro-Schema: `max` wird `plus`, `ultimate` wird `pro` — in `users.plan`,
`subscriptions.plan` und `subscriptions.pendingPlan`. Andere Werte (auch `NULL`) bleiben
unverändert; ein zweiter Lauf ändert nichts und wirft keinen Fehler. Fehlt eine der beiden
Tabellen, ist die Migration für sie ein No-op.

## `effectivePlan`

`effectivePlan('max')` und `effectivePlan('ultimate')` liefern `free` (unbekannter Wert);
`free`/`plus`/`pro` bleiben unverändert.
