# Aufgabengraph statt Aufgabenwald (Tab „Wald")

**Stand:** 2026-09-09

## Ziel

Der Tab „Wald" (`/wald`) zeigt die Aufgabenbeziehungen als gerichteten, gewichteten Graphen statt
als eingerückte Kartenliste. Zwei Probleme der Baumdarstellung fallen damit weg:

1. Eine Aufgabe, die mehreren übergeordneten Aufgaben zuarbeitet, erschien im Wald **mehrfach** —
   `buildTaskForest` materialisiert je Wurzel einen eigenen Teilbaum.
2. Das Kantengewicht (`dependencies.weight`, 0,1–1) war unsichtbar. Es ist über den
   Abhängigkeits-Dialog **schreibbar** und fließt in `calculateValueContribution` ein, wurde aber
   von keinem Read-Endpunkt ausgeliefert — die eigene Eingabe war nie wieder nachvollziehbar.

Die flache Aufgabenliste unter `/aufgaben` bleibt unverändert.

## Voraussetzungen

- Angemeldeter Nutzer; `GET /graph` liegt hinter `requireAuth`.
- Mindestens zwei Aufgaben mit einer Abhängigkeit, damit eine Kante entsteht.

## Vertrag: `GET /graph`

Liefert `{ nodes, edges }` statt eines Baumes.

- `nodes`: alle aktiven Aufgaben (`Open`/`In process`) des Nutzers, **je Aufgabe genau ein
  Eintrag**, absteigend nach `value` sortiert. Feldgleich zu `TaskTreeNode` ohne `dependents`.
- `edges`: `{ from, to, weight }`. `from` ist die Unteraufgabe (`dependencies.dependingTaskId`),
  `to` die übergeordnete Aufgabe (`dependencies.dependentTaskId`) — gelesen: „`from` ermöglicht
  `to`". Es erscheinen nur Kanten, deren **beide** Enden in `nodes` stehen.
- `value`, `totalEstimatedEffort` und `progress` sind **wertgleich** zu `GET /forest`. Ein
  Paritätstest (`server/src/logics/graph.test.ts`) hält das fest.
- Erledigte Aufgaben sind keine Knoten, zählen aber weiter in `progress` (bestehender Vertrag aus
  #392 ∩ #241).

Aufwand: vier Queries unabhängig von der Graphgröße (Tasks, Kanten, Task-Säulen, Säulen); alles
Weitere wird in-memory gerechnet. `buildTaskForest` setzt dagegen pro Knoten und Teilbaum eigene
`getDependencies()`-Queries ab. Ein Query-Count-Test sichert das ab.

## Schritte und erwartetes Ergebnis

### AK1 — Knoten und Kantengewicht sind sichtbar

Zwei verknüpfte Aufgaben mit Gewicht 0,5: Beide Knoten (`graph-node-<id>`) sind sichtbar, das
Gewicht steht als Zahl `0,5` an der Kante. Die Strichstärke (`1 + weight * 3`) verstärkt es nur —
Farbe und Stärke tragen die Information nie allein (WCAG 1.4.1).

### AK2 — Die Hierarchie ist an den Ebenen erkennbar

Die Unteraufgabe steht **über** der Aufgabe, die sie ermöglicht; der Pfeil zeigt nach unten. Ersetzt
die Einrückungs-ACs der abgelösten Spec #704.

### AK3 — Keine Duplikate

Eine Aufgabe mit zwei übergeordneten Aufgaben erscheint **genau einmal** mit zwei ausgehenden
Kanten. Im Baum stand sie zweimal.

### AK4 — Mobile-First

Bei 375 × 812 bleibt der Canvas vollständig in der Viewportbreite und erzeugt keinen horizontalen
Seiten-Scroll (er clippt selbst, geschwenkt wird im Canvas). Die Ansichts-Buttons „Ansicht
einpassen", „Vergrößern" und „Verkleinern" sind mindestens 44 × 44 px — deshalb eine `KolToolbar`
statt der xyflow-eigenen `Controls` (rund 26 px). Übernimmt AK2 der abgelösten Spec #1027.

### AK5 — Barrierefreiheit

Der Canvas ist `aria-hidden` und nicht fokussierbar: ein SVG-Viewport ist für Screenreader wertlos,
eine halbe Tastaturbedienung wäre eine Fokusfalle. Die inhaltsgleiche Fassung steht darunter als
aufklappbare Liste („Graph als Liste", `graph-list-item-<id>`), immer im DOM, mit Wert,
Gesamtaufwand, Fortschritt sowie „Hängt ab von" und „Ermöglicht" samt Gewichten. Bewusst Karten
statt Tabelle: fünf Spalten erzwängen bei 375 px horizontales Scrollen (Begründung wie #238).

### AK6 — Interaktion

Ein Klick auf einen Knoten hebt ihn und seine Kanten hervor und öffnet darunter eine Detail-Karte
mit genau einer Aktion: „Abhängigkeiten bearbeiten" (öffnet den bestehenden `DependencyModal`).
Klick auf freie Fläche und `Escape` heben die Auswahl auf. Bearbeiten, Löschen, Erledigt-Toggle und
Unteraufgabe anlegen bleiben dem Tab „Aufgaben" vorbehalten.

### AK7 — Große Graphen

Ab mehr als `MAX_GRAPH_NODES` (60) Knoten zeigt die Ansicht die wertvollsten 60 plus alle Kanten
zwischen ihnen und weist darauf hin. Die Kappung ist Sache der Ansicht; `GET /graph` bleibt
vollständig.

## Technische Entscheidungen

**`@xyflow/react` (MIT, 12.11.6) als Ausnahme von KoliBri-First.** KoliBri/KERN hat keine
Graph-Komponente; ein pan-/zoombarer DAG mit Kanten-Routing, Viewport-Transform und Touch-Gesten
wäre handgerollt mehrere hundert Zeilen Eigenbau. Die Bibliothek deckt ausschließlich die
Canvas-Ebene ab, alle Bedienelemente bleiben KoliBri. Nur `dist/base.css` wird importiert (keine
Theme-Regeln, also kein Konflikt mit den `--pp-*`-Rollen), und das Panel wird per `React.lazy`
nachgeladen, damit die Bibliothek den Dashboard-Kaltstart nicht belastet.

**Eigenes Ebenen-Layout statt dagre/elkjs** (`frontend/src/lib/graphLayout.ts`): Longest-Path über
eine Kahn-Topologie plus zwei Barycenter-Durchläufe. Deterministisch und damit unit- und
e2e-testbar; kraftbasierte Layouts wären es nicht. `layoutGraph(nodes, edges)` ist die einzige
Signatur, die ein Layout-Paket später ersetzen müsste.

## Abgelöste Specs

| Datei                                        | Verbleib der ACs                                     |
| -------------------------------------------- | ---------------------------------------------------- |
| `e2e/issue-704-tree-layout.spec.ts`          | Einrückung → AK2 (Ebenen); Überlauf-Test → AK4       |
| `e2e/issue-1027-forest-card-spacing.spec.ts` | AK1 (Card-Abstand) entfällt mit den Cards; AK2 → AK4 |

Beide messen `margin-left` bzw. Abstände von `forest-node-*`-Karten, die es nicht mehr gibt.
Ersetzt durch `e2e/task-graph.spec.ts`.
