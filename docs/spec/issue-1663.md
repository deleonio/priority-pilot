# Spec: Lebensbalance — Säulen-Gewichte wirken wieder im Kadenz-Füllstand (#1663)

Fortsetzung von #1638 (Spec: `docs/spec/issue-1638.md`) und der PO-Entscheidung aus #1601: Die
Gewichte der Säulen bestimmen weiterhin, wie stark eine Säule in den Gesamtfüllstand eingeht. Das
Kadenz-Modell (#1638) hatte die Gewichtung still abgeschaltet — `berechneKadenzFuellstand` rechnet
nur `fill = 1 − √(Σ defizitᵢ² / n)` über alle Säulen, und `berechneLebensbalanceNachKadenz` reicht
`Pillar.weight` gar nicht in die Rechnung.

## Ziel

Ist eine hoch gewichtete Säule nicht in ihrem Rhythmus bedient, sinkt der Füllstand stärker als bei
einer niedrig gewichteten. Eine Säule mit Gewicht 0 hat kein Ziel und senkt den Füllstand nicht. Bei
gleichen Gewichten bleibt der heutige Wert unverändert (Prod-Stand 66,0 %).

## Vertrag — Formel wie #1474, Defizit aus der Kadenz-Erfüllung

Kombination gewichtete + ungewichtete Komponente mit Strengste-Prinzip `min(...)`, exakt wie in
`berechneLebensbalance` (`heartBalance.ts:111-160`), nur mit `defizitᵢ = 1 − erfuellungᵢ` aus dem
Kadenz-Modell statt `1 − min(1, ist/soll)`:

- `server/src/logics/heartBalance.ts`: `KadenzSaeule` bekommt `weight: number` (Soll-Gewicht der
  Säule); `berechneLebensbalanceNachKadenz` reicht `saeule.weight` aus `BalanceSaeule` durch
  (Name→Rhythmus weiter aus `PILLAR_RHYTHMS`).
- `sollᵢ = weightᵢ / Σweight`; sind alle Gewichte 0, gilt `sollᵢ = 1/n` (Gleichverteilung, wie
  `berechneLebensbalance`).
- `defizitᵢ = 1 − erfuellungᵢ` (unverändert aus #1638).
- `fillGewichtet = 1 − √(Σ sollᵢ · defizitᵢ²)` — Normierung 1, weil im Kadenz-Modell jede Säule
  unabhängig ein volles Defizit haben kann (Σ sollᵢ = 1).
- `fillUngewichtet = 1 − √(Σ_{sollᵢ > 0} defizitᵢ² / |{sollᵢ > 0}|)` — Säulen ohne Ziel fallen aus
  beiden Komponenten heraus.
- `fill = !hasPoints ∨ keine Säule ? 0 : min(fillGewichtet, fillUngewichtet)`.
- JSDoc an `berechneKadenzFuellstand` („Die Säulen tragen kein Gewicht mehr …") entsprechend
  korrigieren.
- DTO-Form von GET /scores/balance und MCP `balance_status` bleibt unverändert (`erfuellung` bleibt
  intern); `gewichtung` im DTO bleibt `Pillar.weight`.
- Frontend: kein Eingriff — das Dashboard-Herz zeigt seit #1638 den Server-Füllstand
  (`frontend/src/components/Dashboard.tsx:154,217`).

## Randbedingungen

- Bei gleichen Gewichten ist `fillGewichtet == fillUngewichtet ==` heutiger Wert
  (`1 − √(Σ defizitᵢ² / n)`): die bestehenden #1638-Tests (4-Wochen-Szenario, Randfälle) dürfen
  nicht rot werden; die #1638-Fixtures werden dafür um `weight` ergänzt (gleiche Werte).
- Folge des Strengste-Prinzips (wie #1474 gewollt): Liegt das Gewicht einer unbedienten Säule unter
  dem Gleichanteil `1/n`, bestimmt die ungewichtete Komponente den Wert — eine noch niedrigere
  Gewichtung senkt den Füllstand nicht weiter ab.
- Rhythmen (`PILLAR_RHYTHMS`) und `punkte` (kumulativ, ganze Historie) bleiben unverändert.

## Akzeptanzkriterien → Tests

| AK  | Erwartung                                                                                                                                                   | Test                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| AK1 | Bei gleichen Gewichten (auch alle > 0 gleich, z. B. 25/25/25/25) derselbe Füllstand wie vor der Änderung (`1 − √(Σ defizitᵢ² / n)`)                         | TF1                                     |
| AK2 | 4 Säulen, A unbedient (Erfüllung 0), B–D voll erfüllt: Gewichte A=40/B=C=D=20 → fill ≈ 1 − √0,4 ≈ 0,368; A=10/B=C=D=30 → fill ≈ 0,5; ersterer kleiner       | TF2                                     |
| AK3 | Säule mit Gewicht 0 senkt den Füllstand nicht: unbedient mit Gewicht 0, übrige voll erfüllt → fill = 1                                                      | TF3                                     |
| AK4 | Alle Gewichte 0 → identischer Füllstand wie bei gleichen Gewichten (gleiche Tasks, gleicher Zeitpunkt)                                                      | TF4                                     |
| AK5 | `berechneLebensbalanceNachKadenz` reicht `Pillar.weight` durch: GET /scores/balance liefert bei ungleichen Gewichten einen anderen, gewichtsabhängigen fill | TF5                                     |
| AK6 | 4-Wochen-Szenario aus #1638 (Sinn ≥ 0,8 × Soll, fill ≥ 0,8 % bei gleichen Gewichten) bleibt grün                                                            | bestehender Test (TF6, kein neuer Test) |

## Testfälle

- **TF1** (`server/src/logics/heartBalance.test.ts`, neuer describe): 4 Säulen, A unbedient, B–D
  voll erfüllt, Gewichte 25/25/25/25 → fill entspricht `1 − √(Σ defizitᵢ² / n)` (Regressionwächter
  für den Prod-Stand; bewusst auch vor der Impl grün).
- **TF2** (ebenda): gleiche Tasks/`jetzt`, Gewichtsverteilung 40/20/20/20 vs. 10/30/30/30 → fill
  ≈ 0,368 bzw. 0,5 (Toleranz 1e-3) und `fillHoch < fillNiedrig`.
- **TF3** (ebenda): Gewicht 0 für die unbediente Säule → fill = 1.
- **TF4** (ebenda): alle Gewichte 0 vs. alle 25 → identischer fill.
- **TF5** (`server/src/express/scores-balance.test.ts`, neuer Test): fünf Standard-Säulen, Körper
  ohne Erledigung im Fenster, übrige vier im Soll-Rhythmus bedient; `PUT /pillars/weights` mit
  20/20/20/20/20 → fill ≈ 55,3 %, mit 60/10/10/10/10 (Körper hoch) → fill ≈ 22,5 %, mit
  0/25/25/25/25 (Körper 0) → fill = 100 %.
- **TF6**: kein neuer Test — der bestehende 4-Wochen-Szenario-Test in
  `server/src/logics/heartBalance.test.ts` (describe `#1638`, erster Fall) bleibt unverändert grün.

MCP `balance_status`: die 1:1-Spiegelung zur HTTP-Route deckt der bestehende AK9-Paritätstest
(`scores-balance.test.ts`, deepEqual der gesamten Nutzlast) bereits ab; beide Wege laufen durch
denselben `berechneLebensbalanceNachKadenz`-Aufruf — kein eigener Test (Dedup).
