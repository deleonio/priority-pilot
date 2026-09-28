# Care-Defizit: Balance-Defizite und Überlast je Säule über die Zeit

**Stand:** 2026-09-28

## Ziel

Je Säule eine zeitreihen-basierte Auswertung als reine Funktion (`server/src/logics/careDeficit.ts`),
die Dashboard (#1793), Push (#1794) und MCP (#1796) gemeinsam nutzen können — eine Stelle, keine
doppelte Berechnung. Basis sind die Fenster- und Aufwandsbegriffe aus `heartBalance.ts`/`balanceHistory.ts`.

## Vertrag `bewerteCareDefizit(saeulen, tasks, jetzt)`

- **Eingabe:** Säulen (`BalanceSaeule` — `weight` bleibt hier unberücksichtigt), Tasks mit
  `status`, `estimatedEffort`, `pillars: { pillarId, share }[]` und `erledigtAm: Date | null`
  (KadenzTask-Form), Bezugszeitpunkt `jetzt`.
- **Fenster** (`CARE_FENSTER_TAGE = 7`, an `CARE_FENSTER_TAGE`-Multiplen):
  jüngeres Fenster `(jetzt − 7 d, jetzt]`, älteres `(jetzt − 14 d, jetzt − 7 d]` — links exklusiv,
  rechts inklusiv (Spiegel zu `berechneKadenzFuellstand`).
- **Aufwand je Säule und Fenster:** Σ über `Done`-Tasks im Fenster von
  `estimatedEffort × share / 100`, nur auf explizit zugewiesene Säulen. Tasks ohne Säulen-Zuweisung
  tragen nicht; `erledigtAm: null` (Done ohne ScoreEntry) zählt in keinem Fenster — der Zeitpunkt
  ist unbekannt, die Säule bleibt konservativ defizitär sichtbar.
- **Ausgabe** je Säule (`SaeulenDefizit[]`):
  - `defizitaer`: kein Aufwand im jüngeren Fenster (AK1).
  - `trend`: `'erholt'` (jünger > älter), `'verschlechtert'` (jünger < älter), sonst `'stabil'` —
    abgeleitet aus den zwei aufeinanderfolgenden Fenstern (AK2).
  - `ueberlast`: Anteil am gesamten Aufwand des jüngeren Fensters **strikt größer**
    `UEBERLAST_ANTEIL` (= 0,5); Gesamtaufwand 0 → nie Überlast (AK3).
- **Eine Stelle im Code:** `CARE_FENSTER_TAGE` und `UEBERLAST_ANTEIL` sind exportierte Konstanten
  des Moduls und steuern das Verhalten — Konsumenten (#1793/#1794/#1796) importieren sie,
  statt Werte zu kopieren (AK4).

## Erwartetes Ergebnis

- Säule ohne erledigte Aufgabe in den letzten 7 Tagen → `defizitaer: true` (offene Tasks ändern
  das nicht).
- Trend korrekt aus den zwei Fenstern: mehr Aufwand kürzlich → `erholt`, weniger →
  `verschlechtert`, gleich → `stabil`.
- Säule mit mehr als 50 % des erledigten Aufwands des jüngeren Fensters → `ueberlast: true`
  (exakt 50 % und leeres Fenster → false).
- Fenstergrenze: erledigt genau vor 7 Tagen liegt außerhalb des jüngeren Fensters, eine
  Millisekunde danach innerhalb.

## Bausteine

Neu: `server/src/logics/careDeficit.ts` (reine Funktion, kein DB-Zugriff) und seine Tests
`server/src/logics/careDeficit.test.ts`. Verdrahtung in Route/MCP/Push folgt in #1793/#1794/#1796
und gehört nicht zu diesem Vertrag.
