# Issue #1449 — `extractLeaves` dedupliziert geteilte Knoten

## Ziel

Eine Unteraufgabe, die Vorgänger mehrerer Oberaufgaben ist, entsteht im Wald
(`buildTaskForest`, `server/src/logics/tree.ts:119-150`) als mehrere frische Knoten mit
derselben `id` (einmal pro Pfad). `extractLeaves()` (`frontend/src/lib/extractLeaves.ts:17-36`)
sammelt bisher ohne Dedup und liefert denselben Task mehrfach in die flache Liste — sichtbar
als doppelte Zeilen in der Aufgabenliste (`TaskTree.tsx:318,342`) und doppelte React-Keys.

## Vorbedingung

Wald mit einem Blatt-Knoten (gleiche `id`, aber unterschiedliche Objekt-Referenzen je Pfad),
der unter zwei (oder mehr) Oberaufgaben hängt.

## Verhalten (Vertrag)

- `extractLeaves(forest)` liefert je Task-`id` höchstens einen Knoten (AK1).
- `extractLeaves(forest, { includeParents: true })` ist ebenfalls pro `id` eindeutig — auch für
  mehrfach materialisierte Oberaufgaben-Knoten (AK2).
- Dedup läuft über `node.id`, nicht über Objekt-Identität (die Knoten sind pro Pfad frisch
  erzeugt).
- Reihenfolge-Vertrag unverändert: Sortierung nach `value` absteigend, stabil bei
  Wertgleichheit; von mehreren Vorkommen derselben `id` bleibt das **erste** Antreffen der
  Tiefen-Traversierung erhalten (AK3). Bestehende Tests in `extractLeaves.test.ts` (#537, #1345)
  bleiben grün.
- In der Aufgaben-Liste (`data-testid="task-list"`) erscheint eine Unteraufgabe mit zwei
  Oberaufgaben genau einmal — auch bei Viewport 375×812 (AK4, AK5).

## Nicht Scope

`server/src/logics/tree.ts` wird nicht geändert — die Mehrfach-Materialisierung ist für den
Baum-/Graph-Weg gewollt.
