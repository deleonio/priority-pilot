# USP-Kommunikation schärfen: objektive, aufwandsgewichtete, graph-basierte Balance

**Stand:** 2026-09-24

## Ziel

Der Haupt-Tab „Wald" heißt überall in der App „Graph" (Navigation, Route, ARIA-Labels, Nutzer-Doku).
Die Landing Page (de+en) stellt den geschärften USP heraus: eine objektive, aufwandsgewichtete,
graph-basierte Balance mit Gewichten an jeder einzelnen Aufgabe — ohne Konkurrenten zu nennen und
ohne noch nicht ausgelieferte Komponenten (Strengste-Prinzip #1474, Kadenz-Komponente #1601) zu
bewerben. Ein Store-Text liegt als Datei vor.

## Voraussetzungen

- Angemeldeter Nutzer (App-Teil) bzw. keine Anmeldung nötig (Landing Page ist öffentlich).

## Schritte und erwartetes Ergebnis

### AK1/AK2 — Tab-Label „Graph" in allen zehn Sprachen

`navigation.json` (Key `tabs.forest`, Bezeichner bleibt) trägt je Sprache das „Graph"-Äquivalent:

| Sprache | Wert    |
| ------- | ------- |
| de      | Graph   |
| en      | Graph   |
| es      | Grafo   |
| fr      | Graphe  |
| it      | Grafo   |
| nl      | Grafiek |
| pl      | Graf    |
| pt      | Grafo   |
| ru      | Граф    |
| sv      | Graf    |

Kein sichtbarer UI-Text (Tab, ARIA-Label, Tooltip) enthält mehr „Wald" oder ein
Sprach-Äquivalent davon.

### AK3/AK4 — Route `/graph` ersetzt `/wald`

`ROUTE_PATHS` in `App.tsx` führt den Graph-Tab unter `/graph`. Direkter Aufruf von `/graph` öffnet
den Graph-Tab; ein Tab-Wechsel auf „Graph" setzt die URL auf `/graph`. `/wald` ist **keine**
bekannte Route mehr — kein Redirect, Verhalten wie jede unbekannte Route (Fallback auf den ersten
Tab, Dashboard).

### AK5/AK6/AK7 — Landing Page (de+en)

`hero` oder `features` enthält für de die Begriffe „objektiv", „aufwandsgewichtet",
„graph-basiert" und für en die Entsprechungen „objective", „effort-weighted", „graph-based".
Kein Konkurrent wird genannt; weder Kadenz-/Befüllbarkeits-Komponente noch Strengste-Prinzip werden
erwähnt (beide sind noch nicht ausgeliefert).

### AK8 — Store-Text

`docs/marketing/store-listing.md` existiert mit de- und en-Abschnitt und hebt mindestens 2 der
ausgelieferten Kernmerkmale hervor (Doku, kein Anwendungscode — kein Test, Sichtprüfung im Review).

### AK9 — Nutzerseitige Doku

`docs/user-guide.md`, `frontend/PRODUCT.md`, `frontend/DESIGN.md` nennen den Tab „Graph"; Historie
und Code-Kommentare bleiben unverändert (Doku, kein Anwendungscode — kein Test, Sichtprüfung im
Review).

### AK10 — Mobile (375px/768px)

Die Haupt-Tab-Leiste mit „Graph" bricht bei 375px und 768px nicht um und läuft nicht über
(bestehende Umbruch-Wächter mit neuem Label).

## Offene Fragen (Test-Scope)

AK6 („Gewichte an jeder einzelnen Aufgabe, Balance aus tatsächlich erledigtem Aufwand erkennbar")
ist qualitativ und copy-abhängig — ein Wort-Match wäre entweder zu generisch (bereits mit dem
heutigen Text erfüllt, kein rotes Kriterium) oder müsste die noch nicht verfasste finale Copy
vorwegnehmen. Kein automatisierter Test; Sichtprüfung im Review gegen den Vertrag oben.
