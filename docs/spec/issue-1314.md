# Issue #1314 — Wald-Tab: nur zusammenhängende Aufgabenbäume, einzeln durchblätterbar

## Ziel

Der Tab „Wald" zeigt genau einen zusammenhängenden Abhängigkeitsbaum statt des gesamten
Graphen. Aufgaben ohne Abhängigkeitskante erscheinen nicht mehr. Mehrere Bäume sind über
„Vor"/„Zurück" einzeln durchblätterbar. `MAX_GRAPH_NODES`/`selectTopNodes` entfallen
ersatzlos — ein Baum pro Seite begrenzt die Anzeige bereits, eine Kappung innerhalb eines
Baums würde Vollständigkeit (AK6) verletzen.

## Vertrag: `splitIntoTrees` (`frontend/src/lib/graphLayout.ts`)

`splitIntoTrees(graph: TaskGraph): TaskGraph[]`

- Zerlegt den Graphen in Zusammenhangskomponenten über die **ungerichteten** Kanten
  (Union-Find/BFS über `from`/`to`).
- Knoten ohne jede Kante (isolierte Knoten) gehören zu **keinem** Baum (AK1).
- Jeder Baum enthält alle Knoten und Kanten seiner Komponente, keine Kappung (AK6).
- Reihenfolge der Bäume: absteigend nach dem höchsten `value` ihrer Knoten, Tie-Break
  kleinste Knoten-`id` (AK5, damit der wertvollste Knoten im ersten Baum liegt).

## Vertrag: `TaskGraphPanel` (`frontend/src/components/TaskGraphPanel.tsx`)

- Neuer Zustand `treeIndex` (0-basiert), abgeleitet über `splitIntoTrees(graph)`.
- Zeigt Canvas und `TaskGraphList` nur für Knoten/Kanten des Baums an `treeIndex` (AK2).
- Blätter-Leiste „Zurück" · „Baum X von Y" · „Vor" oberhalb des Canvas:
  - „Zurück" deaktiviert bei `treeIndex === 0`, „Vor" deaktiviert bei letztem Baum,
    bei genau einem Baum sind beide deaktiviert (AK3).
  - Positionsangabe „Baum X von Y" (1-basiert) aktualisiert sich beim Blättern (AK4).
  - Beide Buttons sind `KolButton`, per Tastatur erreichbar (Tab-Fokus, Enter/Space),
    tragen ein sprechendes Label; deaktiviert lösen sie keinen Wechsel aus (AK7).
- Baumwechsel setzt `selectedId` zurück (Detailkarte nur für Knoten des sichtbaren Baums).
- Kein Baum vorhanden (keine offene Aufgabe mit Abhängigkeit) ⇒ bestehender Leerzustand
  statt Blätter-Leiste/leerer Fläche (AK8).
- Bei 375 px Breite passt die Blätter-Leiste ohne horizontalen Überlauf (AK9).

## Entfällt

- `MAX_GRAPH_NODES`, `selectTopNodes` (`graphLayout.ts`) — Export und Nutzung entfernt.
- Die „Ausschnitt"-Info-Alert in `TaskGraphPanel.tsx`.

## Test-Pflege-Bedarf

- `frontend/src/lib/graphLayout.test.ts` — `describe('selectTopNodes', …)` entfernt
  (Funktion entfällt).
- `frontend/src/components/TaskGraphPanel.test.tsx` — Tests „Kappt große Graphen" und der
  Listen-Button-Test mit `edges: []` sind mit der neuen Baum-Filterung fachlich falsch
  (kantenlose Knoten erscheinen nicht mehr) und werden angepasst.
