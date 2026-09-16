# `GET /scores/balance/history` + MCP-Werkzeug `balance_history` — Verlauf der Lebensbalance

**Stand:** 2026-09-16

## Ziel

Ein MCP-Client fragt für einen Zeitraum (`von`/`bis`, `YYYY-MM-DD`) den Verlauf der Lebensbalance des
Token-Besitzers ab und erhält je Kalendertag des Zeitraums genau einen Eintrag mit Füllstand und
Säulen-Punktestand — lücken- und rücksprungfrei, so dass sich daraus eine Kurve zeichnen lässt.

## Datengrundlage: Rekonstruktion aus `ScoreEntry`

`ScoreEntry` trägt `zeitpunkt` (Erledigungszeitpunkt) und ist unique je `taskId`
(`server/src/models/scoreEntry.ts:31-34`). Für jeden Tag des Zeitraums wird `berechneLebensbalance`
(`server/src/logics/heartBalance.ts`) über die **kumulierte** Teilmenge der bis zu diesem Tag (Ende,
23:59:59.999 in der angefragten Zeitzone) erledigten Tasks gerechnet:

- Ein Task mit `ScoreEntry` zählt ab dem Kalendertag seines `zeitpunkt` (Zeitzonen-Umbruch wie
  `streak.ts` `tagIn`).
- Ein `Done`-Task **ohne** `ScoreEntry` (z. B. vor Einführung des Scorings erledigt) zählt bereits ab
  Beginn des Zeitraums.
- Der letzte Tag des Zeitraums, wenn er der heutige Kalendertag ist, ist damit mengengleich mit
  `GET /scores/balance` (AK4).

Säulen-Gewichte (`Pillar.weight`) und `TaskPillar.share` werden **nicht** historisiert — der Verlauf
rechnet durchgängig mit den heutigen Werten (Annahme, siehe Analyse-Block #1424).

## Logik: `berechneBalanceVerlauf(saeulen, tasks, von, bis, zeitZone)`

Reine Funktion (kein DB-Zugriff), `server/src/logics/balanceHistory.ts`.

- Eingabe: Säulen `{ id, name, weight }[]` (wie `BalanceSaeule`); Tasks
  `{ status, estimatedEffort, pillars: [{ pillarId, share }], zeitpunkt: Date | null }[]` — `zeitpunkt`
  ist `null` für einen Done-Task ohne `ScoreEntry` (zählt ab Zeitraumbeginn); `von`/`bis` als
  `YYYY-MM-DD`; `zeitZone` als IANA-String.
- Für jeden Kalendertag `t` von `von` bis `bis` (inklusive, aufsteigend): baue die Teilmenge der Tasks,
  deren Erledigung bis Ende `t` liegt (`zeitpunkt === null` oder Kalendertag von `zeitpunkt` in
  `zeitZone` `<= t`), rufe `berechneLebensbalance(saeulen, teilmenge)` auf, runde `fill` wie
  `/scores/balance` auf eine Prozent-Dezimalstelle.
- Ergebnis: `{ tag: string, fuellstandProzent: number, hatPunkte: boolean, saeulen: { id, name, punkte, gewichtung }[] }[]`,
  ein Eintrag je Tag, aufsteigend sortiert. `von === bis` ergibt genau ein Element.

## Endpunkt: `GET /scores/balance/history?von=&bis=&tz=`

- Hinter dem bestehenden Auth-Gate, strikt `ownerScope(getUserId(req))` auf Säulen **und** Tasks
  (Muster `/scores/balance`) — die group-geteilte Task-Leseliste (#1213) zählt nicht ein.
- `tz` wie `/scores/streak`: fehlt der Wert oder ist er ungültig, fällt der Server auf seine eigene
  Zeitzone zurück (kein Fehler).
- Validierung vor der Berechnung, sonst `400` mit `message`:
  - `von` oder `bis` fehlt.
  - `von` oder `bis` ist kein `YYYY-MM-DD` oder kein existierendes Kalenderdatum.
  - `bis < von`.
  - Zeitraum (`bis − von`) größer als 366 Tage.
- Für die Teilmengen-Bildung: Tasks mit `status === 'Done'` **und** eine ScoreEntry-Zeitpunkt-Map
  (`taskId → zeitpunkt`) aus einer einzigen, eigentümerscoped `ScoreEntry`-Abfrage; ein Done-Task ohne
  Treffer in der Map bekommt `zeitpunkt: null`.

## MCP-Werkzeug `balance_history`

- Ein Loopback auf `GET /scores/balance/history` (Muster `tools.ts` `callApi`, wie `balance_status`).
- Eingabeschema: Pflichtfelder `from`, `to` (String, `YYYY-MM-DD`), optional `timezone` → `?von=&bis=&tz=`.
- **Kein** `write`-Flag (Nur-lese-Werkzeug).
- Reicht Fehler der Route unverändert als JSON-RPC-Fehler mit deren Text durch — **keine** zweite
  Validierung im Werkzeug (Muster `balance_status`, `callApi` wirft bei `!res.ok` mit dem Routentext).
- Erweitert den eingefrorenen v1-Werkzeugvertrag (`tools.test.ts`) um einen weiteren Namen.

## Erwartetes Ergebnis

- Genau ein Eintrag je Kalendertag des geschlossenen Intervalls `[von, bis]`, aufsteigend sortiert.
- Ein Tag ohne Erledigung trägt Füllstand und Säulen-Punkte des Vortags (identische Werte bei
  kumulierter Rechnung).
- Ist `bis` der heutige Tag, stimmt der letzte Eintrag exakt mit `GET /scores/balance` überein.
- Ausschließlich Daten des Token-Besitzers; ungültige Datumsangaben liefern `400` statt Daten.
