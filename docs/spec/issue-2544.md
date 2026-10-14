# Spec #2544 — Aufwand im Aufgabenwald ohne Doppelzählung, Endlosschleife und N+1

## Ziel

`totalEstimatedEffort` zählt jede Aufgabe eines Teilbaums genau einmal, auch bei mehreren Wegen
(Diamant). Die Aufwandsberechnung endet bei Zyklen. `GET /forest` ermittelt die Säulenzahl
(`Pillar.count`) je Nutzer höchstens einmal je Anfrage.

## Voraussetzungen

- Unteraufgaben sind Vorgänger (`getDependencies()`), Wurzeln Aufgaben ohne Dependents (#336).
- Aufwände sind exakte Binärbrüche (keine Float-Rundung).

## Erwartetes Verhalten

- **AK1** Diamant A→B, A→C, B→D, C→D: `totalEstimatedEffort` von A im Wald = A+B+C+D (D einmal).
- **AK2** Zyklus A→B→A (per `addDependency`, an `cycle.ts` vorbei): `getEstimatedEffort(A)` (exportiert)
  endet und liefert A+B.
- **AK3** `buildTaskForest(userId)` mit 50 aktiven Aufgaben und Säulen-Beiträgen: `Pillar.count` wird
  höchstens einmal aufgerufen; `value` bleibt numerisch unverändert (Bestandstests).
- **AK4** Im selben Diamanten liefert `buildTaskGraph` für A dasselbe `totalEstimatedEffort` wie der Wald.
- **AK5** Bestehende Tests (`tree.test.ts` Kette, `graph.test.ts` Parität und Query-Konstanz) bleiben grün.
