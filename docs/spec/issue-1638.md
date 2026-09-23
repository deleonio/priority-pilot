# Spec: Lebensbalance — Kadenz-Modell statt Anteil am Gesamtaufwand (#1638)

Fortsetzung von #1601 (Spec: `docs/spec/issue-1601.md`). Diese Spec deckt den in #1637 zurückgestellten
Teil ab: den Füllstand `fill` je Säule und gesamt vom **relativen Ist-Anteil am Gesamtaufwand** auf die
**Erfüllung des eigenen Soll-Rhythmus im 28-Tage-Fenster** umstellen. Kumulative `punkte` (AK4) und die
Gamification-Punkte (AK7) bleiben unverändert.

## Ziel

Eine Säule, die im eigenen Rhythmus bedient wird, zeigt vollen bzw. fast vollen Füllstand — unabhängig
davon, wie viel Aufwand andere Säulen tragen. Eine Säule ohne Aktivität in den letzten 28 Tagen zeigt ein
Defizit, auch wenn sie vor langer Zeit die meisten Punkte gesammelt hat.

## Vertrag — neue Funktion, bestehende `berechneLebensbalance` bleibt unangetastet

Diese Runde führt den Kadenz-Füllstand als **neue** Funktion neben der bestehenden
`berechneLebensbalance`/`punkteProSaeule` ein (Spec-Phase ändert keinen Produktionscode — ob die alte
Funktion ersetzt oder von der neuen genutzt wird, entscheidet die Impl-Phase):

- `server/src/logics/heartBalance.ts`, neuer Typ `KadenzSaeule { id: number; name: string; rhythmusProWoche: number }`
  (Soll-Erledigungen pro Woche, aus `pillarData.ts`: Körper 5, Beziehungen 3, Mentale Gesundheit 3,
  Wirksamkeit 5, Sinn 1 — AK8, nicht über API/UI änderbar).
- Neuer Typ `KadenzTask { status: string; estimatedEffort: number; erledigtAm: Date | null; pillars: { pillarId: number; share: number }[] }`
  (`erledigtAm`-Quelle: `ScoreEntry.zeitpunkt`, Fallback `Task.updatedAt` — Entscheidung der Impl-Phase).
- Neue Exportfunktion `berechneKadenzFuellstand(saeulen: KadenzSaeule[], tasks: KadenzTask[], jetzt: Date): Lebensbalance`
  (injizierbare Zeit `jetzt`, keine echte Uhr in der Berechnung selbst).
- `Lebensbalance.saeulen[]` bekommt ein Feld `erfuellung: number` (0–1): Erfüllungsgrad des
  Soll-Rhythmus im 28-Tage-Fenster, `min(1, erledigteAufgaben_28d / (rhythmusProWoche × 4))`. Mehrfach
  zugewiesene Aufgaben zählen anteilig (`share / 100`).
- `punkte` je Säule bleibt die kumulative, zeitfensterunabhängige Summe (AK4) — dieselbe Rechnung wie
  in `punkteProSaeule` (ganze Historie, kein Zeitfenster).
- `fill` aggregiert `defizit_i = 1 − erfuellung_i` je Säule; volle Erfüllung aller Säulen ⇒ `fill = 1`,
  keine erledigten Aufgaben ⇒ `fill = 0`, `hasPoints = false`.
- Neuer Export in `server/src/models/pillarData.ts`: `PILLAR_RHYTHMS` (Array in Seed-Reihenfolge) mit
  den fünf AK8-Rhythmen: Körper 5, Mentale Gesundheit 3, Beziehungen 3, Wirksamkeit 5, Sinn 1.

## Akzeptanzkriterien → Tests

| AK | Erwartung | Test |
| --- | --- | --- |
| AK1 | 28 Tage, Sinn 1×/Woche im Soll bedient (4× in 28 Tagen), übrige Säulen ebenfalls im Soll-Rhythmus → `erfuellung` von Sinn ≥ 0,8 | TF1 |
| AK2 | Gleiches Szenario → `fill` ≥ 0,8 | TF1 |
| AK3 | Eine Säule ohne erledigte Aufgabe in den letzten 28 Tagen → ihre `erfuellung` = 0, `fill` < 1, auch wenn sie vor > 28 Tagen die meisten `punkte` hält | TF1 |
| AK4 | `punkte` bleibt die zeitfensterunabhängige Summe über die ganze Historie (alte Erledigung außerhalb des Fensters zählt weiter in `punkte`) | TF1 (AK3-Fall) |
| AK6 | Keine erledigten Aufgaben → `fill = 0`, `hasPoints = false` | TF1 |
| AK8 | Rhythmen kommen aus `pillarData.ts`, nicht editierbar | TF2 |

AK5 (Server/MCP/Dashboard-Parität) und AK7 (Gamification-Punkte unverändert) sind aus Zeitbudget-Gründen
in dieser Runde **nicht** spezifiziert — siehe PR „Offene Fragen".

## Testfälle

- **TF1** (`server/src/logics/heartBalance.test.ts`, neuer `describe`-Block): Szenario mit fixem
  `jetzt`, fünf Säulen mit den AK8-Rhythmen, Sinn 4× in 28 Tagen erledigt (Soll erfüllt), übrige Säulen
  jeweils im Soll-Rhythmus erledigt, eine Säule (Körper) zusätzlich mit alten (> 28 Tage
  zurückliegenden) Erledigungen aber ohne Aktivität im 28-Tage-Fenster; plus Leerfall (keine erledigten
  Aufgaben).
- **TF2** (`server/src/models/pillarData.test.ts`, neu): `PILLAR_RHYTHMS` liefert die fünf AK8-Rhythmen
  in der Seed-Reihenfolge.
