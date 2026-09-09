# Spec: Issue 1302 — Segmentbreiten im Glasherz sollen dem Flächenanteil der Lebenssäulen entsprechen

## Ziel

Die Bandkanten im Herz (`HeartBalance.tsx` `bands`-useMemo) werden aus der **kumulierten
Wasserfläche** bestimmt statt aus der Breite. Bisher gilt `x = x + share * (VESSEL_RIGHT -
VESSEL_LEFT)` (`HeartBalance.tsx:218`) — bei gleicher Breite ist die Wasserfläche pro Segment
unterschiedlich groß, weil die Herzkontur oben breit ist und unten spitz zuläuft. Ziel: gleicher
Ist-Anteil ⇒ gleiche Wasserfläche, unabhängig von der Position des Segments.

## Vertrag

### Neues Modul `frontend/src/lib/heartGeometry.ts`

- Exportiert `bandEdges(shares: number[], fill: number): number[]` — reine Funktion ohne DOM.
  - Rückgabe: Array der Länge `shares.length + 1` (kumulierte Kanten), `edges[0] === 4`
    (`VESSEL_LEFT`), `edges[shares.length] === 96` (`VESSEL_RIGHT`), monoton steigend, keine `NaN`.
  - Die gefüllte Fläche ist der Schnitt der Herzkontur (Bezier-Pfad wie `HEART_PATH` in
    `HeartBalance.tsx:53-62`) mit der Halbebene `y ≥ y_w`, wobei
    `y_w = HEART_BOTTOM - fill * (HEART_BOTTOM - HEART_TOP)` (`HEART_TOP = 6`, `HEART_BOTTOM =
88`). Kante `i` wird so gewählt, dass die Fläche zwischen `edges[i]` und `edges[i+1]` in
    dieser gefüllten Region exakt `shares[i]` der gefüllten Gesamtfläche ausmacht.
  - **Randfall `fill` nahe 0** (keine oder verschwindende Wasserfläche): Division durch eine
    Gesamtfläche von 0 ist verboten. Die Funktion fällt dann auf die Kanten der **vollen**
    Herzfläche zurück (rechnerisch identisch zu `bandEdges(shares, 1)`), damit auch das leere Herz
    (`hasPoints === false`) eine sinnvolle, endliche Aufteilung erhält (AK5).
  - Ein `shares[i] === 0` erzeugt `edges[i] === edges[i+1]` (Bandbreite 0).

### Aufrufer (`HeartBalance.tsx`, Implementierungsphase)

- `bands`-useMemo ruft `bandEdges(shares, balance.fill)` mit `shares = hasPoints ? actualShare[] :
targetShare[]` und verteilt die zurückgegebenen Kanten auf die `HeartBand`-Liste.
- `HeartGlass`/`toSlotBands` und die SVG-Zeichnung bleiben bei einer gemeinsamen Kantenquelle
  (`bands`) — keine zweite Berechnung.

## Akzeptanzkriterien → Tests

| AK             | Test                                                                                                                                                                                                                                           | Erwartung                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| AK1            | NEU `heartGeometry.test.ts`: Flächenanteil je Segment ≈ Ist-Anteil (±0,01) bei Füllständen 0,25 / 0,5 / 1,0, ungleich verteilte Anteile; Messung unabhängig via Punkt-in-Polygon-Rasterung                                                     | rot heute (Modul fehlt)                                                        |
| AK2            | NEU `heartGeometry.test.ts`: 5 × 20 % — Flächenanteile paarweise ≤ 0,01 verschieden; Randband breiter als Mittelband (`x1-x0`)                                                                                                                 | rot heute (Modul fehlt)                                                        |
| AK3            | Bereits abgedeckt durch bestehenden Test `HeartGlass.test.tsx:81-99` („legt die Glas-Fugen exakt an die Kanten der SVG-Band-Rects") — liest die Kanten aus dem tatsächlichen DOM, unabhängig vom Kantenalgorithmus. Kein Duplikat.             | —                                                                              |
| AK1, AK4       | ERSETZT `HeartBalance.test.tsx:79-99` (alte Breiten-Regel): zwei Szenarien mit identischen Ist-Anteilen [0.3, 0.7] aber unterschiedlichem Füllstand (0.8 vs. 1.0, über die Soll-Gewichte erzwungen) müssen unterschiedliche Bandkanten ergeben | rot heute (aktuelle Rechnung ignoriert `balance.fill`, beide Kanten identisch) |
| AK5 (Fallback) | NEU `heartGeometry.test.ts`: `bandEdges(shares, 0)` ist rechnerisch identisch zu `bandEdges(shares, 1)` (volle Fläche, keine Division durch 0)                                                                                                 | rot heute (Modul fehlt)                                                        |
| AK5 (Anteil 0) | NEU `heartGeometry.test.ts`: `shares[i] === 0` ⇒ `edges[i] === edges[i+1]`                                                                                                                                                                     | rot heute (Modul fehlt)                                                        |
| AK6            | Kein neuer roter Test (Begründung unten); bestehender Overflow-Test (`heart-balance.spec.ts`) deckt „Bild sichtbar, kein Überlauf" bereits ab.                                                                                                 | —                                                                              |

## Offene Fragen

- AK6 („Fugenzahl passt zur Zahl der Säulen mit Anteil > 0") lässt sich nicht als _rot heute_
  formulieren: Die Fugen-Sichtbarkeitsregel (`bands.slice(1).map(band => band.x1 > band.x0 &&
<line …>)`, `HeartBalance.tsx:348-362`) ist unabhängig davon, ob die Kanten breiten- oder
  flächenproportional berechnet werden — das Invariant gilt schon heute. Ein Test, der aktuell grün
  ist, wäre kein Kontrakt für diesen Fix. Die Flächenkorrektheit selbst prüfen AK1/AK2
  (`heartGeometry.test.ts`); der bestehende e2e-Overflow-Test deckt „Bild sichtbar, kein Überlauf"
  weiterhin ab. Sollte die Implementierungsphase die Fugenlogik ändern, gehört ein entsprechender
  Test dorthin.

## Test-Pflege-Bedarf

- `HeartBalance.test.tsx:79-99` („spannt die Band-Rects … proportional (AK2)") prüft `width / 92 ≈
share` — das ist exakt die alte, jetzt falsche Breitenregel. Sie wird durch den neuen
  Füllstand-Abhängigkeits-Test (AK1/AK4) ersetzt (nicht grün gehalten), weil sie der neuen
  Flächenregel widerspricht.

## Struktur (Implementierungsphase, nicht Teil dieses PRs)

- Neues Modul `frontend/src/lib/heartGeometry.ts` mit `bandEdges`.
- `HeartBalance.tsx` `bands`-useMemo auf `bandEdges` umstellen, `balance.fill` als Abhängigkeit
  aufnehmen.
- Keine Änderung an `HeartGlass.tsx`/`toSlotBands` oder `heart-glass.frag` (Kantenquelle bleibt
  `bands`, nur deren Berechnung ändert sich).
