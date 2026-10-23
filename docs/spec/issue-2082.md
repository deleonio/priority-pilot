# Spec #2082 — Füllstand-Verlauf der letzten 28 Tage

Reine Frontend-Arbeit; Daten liefert `GET /scores/balance/history` (#1424), Client `api.getBalanceHistory`.
Die Card lädt selbst (Muster `StreakCard`/`WeeklyBalanceCard`) und steht im Dashboard nach der Streak-Card.

## Vertrag

- `frontend/src/lib/balanceTrend.ts` exportiert `balanceTrend(eintraege): 'aufwaerts' | 'abwaerts' | 'stabil'`.
  Differenz = `fuellstandProzent` des letzten minus des ersten Eintrags; > +5 → `aufwaerts`, < -5 → `abwaerts`,
  sonst (inkl. genau ±5 und leere Liste) `stabil`.
- `frontend/src/components/BalanceHistoryCard.tsx` exportiert `BalanceHistoryCard`.
  Test-IDs: `balance-history-card` (Hülle), `balance-history-chart` (SVG, `role="img"`),
  `balance-history-point` (je Tag genau eines), `balance-history-trend` (Trend-Text),
  `balance-history-start` / `balance-history-end` (Start-/Endwert in %), `balance-history-error`,
  `balance-history-empty`.

## Ablauf

1. Beim Mount: `getBalanceHistory({ von: heute - 27 Tage, bis: heute, tz })` (Nutzerzeitzone, 28 Tage).
2. Laden: `KolSpin`. Fehler: dezenter Text `balance-history-error`, kein Wurf. Leer (keine Einträge oder alle
   `hatPunkte=false`): `balance-history-empty`, kein Trend.
3. Erfolg: je Tag ein Punkt; Trend als Text ("Aufwärts" / "Abwärts" / "Stabil", nicht nur Farbe) sowie
   Start- und Endwert (erster/letzter `fuellstandProzent`, gerundet, mit %) als Text im DOM.
4. Mobile: bei 375 px liegt die Card vollständig innerhalb des Viewports.
