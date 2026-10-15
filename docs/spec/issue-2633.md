# Balance-Antwort: Erledigungen im Fenster + Mindestmenge (#2633)

**Stand:** 2026-10-15

## Ziel

`GET /scores/balance` (Handler `server/src/express/routes/scores.ts:211`) liefert zusätzlich zwei
**additive** Felder, damit Frontend und MCP-Clients ableiten können, ob genug Erledigungen für ein
Balance-Urteil vorliegen:

- `erledigungenImFenster` — Anzahl der Erledigungen im jüngeren `CARE_FENSTER_TAGE`-Fenster
  (7 Tage, kontoweit/task-level), berechnet mit der bestehenden Funktion `zaehleErledigungen`
  (`server/src/logics/careDeficit.ts:45`) über die im Handler bereits vorliegende `kadenzTasks`-Liste.
  Exakt die Zählstelle der Überlast-Regel — **nicht** der 28-Tage-Kadenz-Füllstand.
- `mindestErledigungen` — die Mindestmenge, ab der ein Überlast-Urteil überhaupt gilt; Wert stammt
  aus dem importierten `UEBERLAST_MINDEST_ERLEDIGUNGEN` (`careDeficit.ts:25`), **kein zweites
  Literal** in der Route.

## Voraussetzung

- Eingeloggte Session (bestehendes Muster der Route, unverändert).
- Streng additive Erweiterung: alle Bestandsfelder (`fuellstandProzent`, `hatPunkte`, `saeulen`,
  `streak`, `meilensteine`) bleiben unverändert; die laufenden Tests in
  `server/src/express/scores-balance.test.ts` müssen grün bleiben.
- `openapi.yml`-Schema `BalanceStatus` (Z. 8423) um beide Properties erweitern (nicht-required,
  abwärtskompatibel) plus Typregenerierung (`pnpm --filter server build:api`,
  `pnpm --filter client generate`) — Umsetzungsphase.
- Keine UI-Änderung („Vertrag vor Verbraucher", Teil-Epic #2629); das MCP-Werkzeug `balance_status`
  spiegelt die Route 1:1 per `callApi`, neue Felder fließen automatisch mit.

## Schritte und erwartetes Ergebnis

1. **Drei Erledigungen im Fenster (AK1/AK2/AK3):** Nutzer mit 3 frisch erledigten Aufgaben →
   `erledigungenImFenster` exakt `3`; `mindestErledigungen` exakt der Wert der importierten
   Konstante `UEBERLAST_MINDEST_ERLEDIGUNGEN`.
2. **Eine Erledigung im Fenster (AK3):** genau 1 erledigte Aufgabe → Zähler exakt `1`.
3. **Keine Erledigung (AK3):** frischer Nutzer ohne Tasks → Zähler exakt `0`, Mindestmenge
   unverändert.
4. **Fenstergrenze (AK1):** eine vor 14 Tagen erledigte Aufgabe (innerhalb des 28-Tage-Kadenz-
   Fensters, außerhalb des 7-Tage-Care-Fensters) zählt **nicht** — der Zähler bleibt `0` (deckt ab,
   dass die Route das Care-Fenster nutzt, nicht das Kadenz-Fenster).
5. **MCP-Parität (AK4):** der bestehende Paritätstest (#1423 AK9, deepEqual HTTP-Antwort vs.
   `balance_status` über `tools/call`) läuft ohne Werkzeug-Anpassung weiter grün.

## Testabdeckung

- API-Tests (node:test) in `server/src/express/scores-balance.test.ts`, neuer describe-Block
  „Erledigungen im Fenster (#2633)": Schritte 1–4.
- AK4 durch den bestehenden AK9-Paritätstest derselben Datei abgedeckt (kein Duplikat).
