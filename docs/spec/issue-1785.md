# Spec #1785 — Altpakete `max`/`ultimate` zurückbauen

Quelle: KI-ANALYSE-Block von #1785, ADR 0018. Die App ist nicht live, es gibt keine Bestandskunden: keine Übergangslogik, keine Abwärtskompatibilität.

## Migration `migrateLegacyPlans(db)`

Ziel: Nach dem Serverstart kennt die DB nur noch `free`/`plus`/`pro`.

- Voraussetzung: Tabellen `users` (Spalte `plan`) und `subscriptions` (Spalten `plan`, `pendingPlan`) können bestehen; fehlt eine Tabelle, ist die Migration für sie ein No-op.
- Schritte: `max` wird `plus`, `ultimate` wird `pro` in `users.plan`, `subscriptions.plan` und `subscriptions.pendingPlan`.
- Erwartung: Andere Werte (auch `NULL`) bleiben unverändert. Ein zweiter Lauf ändert nichts und wirft keinen Fehler.

## `effectivePlan`

`effectivePlan('max')` und `effectivePlan('ultimate')` liefern `free` (unbekannter Wert), `LEGACY_PLANS` entfällt. `free`/`plus`/`pro` bleiben unverändert.

## Aufräumen

Im Server-Quelltext (ohne Tests) wird `max`/`ultimate` nicht mehr als Paketwert ausgewertet (AK4, Review per grep, kein Test).
