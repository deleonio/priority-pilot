# Balance-Formel: Strengste-Prinzip gegen die Doppel-Dämpfung (#1474)

## Ziel

Eine Schieflage mit einer leeren Säule darf nicht mehr als „Gut in Balance“ bewertet werden.
Die Ursache ist eine Doppel-Dämpfung der leeren Säule in der bestehenden Formel
(`frontend/src/lib/heartBalance.ts:115-120`, zahlengleich `server/src/logics/heartBalance.ts:115-130`):

1. der Level-Cap bei 1 lässt Übererfüllung der dominierenden Säule mit 0 in die Streuung eingehen,
2. die Soll-Gewichtung quadriert das Defizit der leeren Säule mit ihrem (kleinen) Soll,
3. die Normierung auf `1 − min(soll)` schränkt den Bruch erneut ein.

Beispiel 60/0/10/10/10 bei Gewichten 60/10/10/10/10: alter Füllstand 0,6667 → „Gut in Balance“,
obwohl eine Säule komplett leer ist.

## Neue Rechnung (Strengste-Prinzip)

Neben den bestehenden soll-gewichteten Füllstand tritt eine **ungewichtete** Komponente; der
Füllstand ist das **Minimum** aus beiden:

```
füllstandGewichtet = 1 − √( Σ sollᵢ · defizitᵢ² / (1 − min{sollᵢ | sollᵢ > 0}) )   (wie bisher)
füllstandUngewichtet = 1 − √( Σ_{sollᵢ > 0} defizitᵢ² / n_ziel )   mit n_ziel = Anzahl Säulen mit Soll
füllstand = min(füllstandGewichtet, füllstandUngewichtet)
```

mit `defizitᵢ = 1 − levelᵢ` und `levelᵢ = min(1, istᵢ/sollᵢ)` wie bisher.

Randbedingungen (unverändert):

- Level-Cap bei 1 bleibt (docs/zifferblatt-konzept.md §2).
- Säulen ohne Soll (`sollᵢ = 0`) bleiben aus **beiden** Komponenten heraus — eine frisch
  angelegte, ungewichtete Säule darf den Füllstand nicht verschieben (bestehender Test
  `heartBalance.test.ts` „lässt eine Säule ohne Soll den Füllstand unberührt“).
- Ohne Punkte bleibt `fill = 0` (`hasPoints: false`); ohne jede Ziel-Säule bleibt der Füllstand 1.
- Schwellen (0,85/0,65/0,4) und Labels bleiben unverändert.
- Frontend (`buildHeartBalance`) und Server (`berechneLebensbalance`) bleiben zahlengleich;
  die Formel gilt für beide Eingangsarten (Gamification-Punkte wie erledigten Aufwand aus Tasks).

## Gepinnte Werte

| Verteilung (Gewichte → Ist)     | gewichtet | ungewichtet | fill (min) | Stufe    |
| ------------------------------- | --------- | ----------- | ---------- | -------- |
| 60/10/10/10/10 → 60/0/10/10/10  | 0,6667    | 0,5528      | **0,5528** | wackelig |
| 60/10/10/10/10 → 60/10/10/10/10 | 1,0       | 1,0         | **1,0**    | stark    |
| 20/20/20/20/20 → 16/20/5/12/47  | 0,5634    | 0,6095      | **0,5634** | wackelig |

Der Ausgangsfall 16/20/5/12/47 ändert seinen Wert **nicht** (die gewichtete Komponente bleibt die
strengere) — der bestehende Pin `0,5634` (`heartBalance.test.ts` „bewertet den Ausgangsfall … mit
56 Prozent“) bleibt unverändert gültig.

## Abnahme (AKs → Tests)

- **AK1/TF1** (`frontend/src/lib/heartBalance.test.ts`): 60/0/10/10/10 → fill < 0,65, gepinnt
  0,5528; Label ≠ „Gut in Balance“, Zustand nicht `gut`/`stark`.
- **AK2/TF2** (dort): Paar 60/0/… vs. 60/10/… → Differenz exakt gepinnt (0,4472 ≥ 0,10).
- **AK3/TF3** (dort): alle am Soll → fill = 1, Label „In Balance“; Ausgangsfall-Wert bleibt
  0,5634 (bestehender Pin, keine Neu-Verdüblung).
- **AK4/TF4** (`server/src/logics/heartBalance.test.ts`): dieselben drei Eingänge als Tasks →
  Server-fill identisch mit den gepinnten Frontend-Werten (≥ 4 Dezimalen).
- **AK5** (kein automatischer Test): `docs/zifferblatt-konzept.md` §2 muss nach der
  Formel-Änderung die ungewichtete Komponente und das Strengste-Prinzip beschreiben —
  Docs-Review in der Impl-/Review-Phase (Doku, daher kein Testfall).

## Nicht-Gegenstände

- Schwellen und Labels bleiben; Anzeige (`HeartBalance.tsx`) und Hinweistexte bleiben unangetastet.
- Formel-Kombination `min` (statt gewichtetem Mix) ist die Entscheidung dieser Spec — die AKs
  binden nur die Szenarien.
