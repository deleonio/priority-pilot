# MCP-Werkzeug `balance_status` — Lebensbalance-Stand abfragen

**Stand:** 2026-09-13

## Ziel

Ein MCP-Client mit Nur-lese-Token ruft `balance_status` ohne Argumente auf und erhält den
Gesamt-Füllstand des Dashboard-Herzens in Prozent, je Säule ihren Punktestand samt Gewichtung sowie
Streak (aktuell + Bestmarke) und die erreichten Meilensteine. Fremde Daten sind darin nie enthalten.

## Randbedingung: Punktequelle

Das Dashboard-Herz (`frontend/src/lib/heartBalance.ts`) rechnet **nicht** mit `/scores/by-pillar`
(das aggregiert `ScoreEntry.punkte` nach `share` — andere Zahlen), sondern mit dem anteiligen
erledigten Aufwand (`estimatedEffort`) je Säule aus `Task`/`TaskPillar`/`Pillar`
(`frontend/src/components/Dashboard.tsx:131-147`, `frontend/src/lib/pillar.ts:161-190`): erledigte
Tasks tragen ihren `estimatedEffort` anteilig (`share/100`) je zugewiesener Säule bei; erledigte
Tasks **ohne** Säulenzuweisung werden gewichtsproportional auf alle Säulen verteilt. Die neue
Server-Logik muss exakt dieselbe Formel abbilden, damit der MCP-Wert mit dem Dashboard übereinstimmt.

## Logik: `berechneLebensbalance(saeulen, tasks)`

- Reine Funktion (kein DB-Zugriff), Portierung von `buildPillarBalances`/`buildHeartBalance` auf den
  Server. Eingabe: Säulen mit `{ id, name, weight }`, Tasks mit `{ status, estimatedEffort, pillars: [{ pillarId, share }] }`.
- Punkte je Säule: anteiliger `estimatedEffort` der **Done**-Tasks über `share`, plus
  gewichtsproportionale Verteilung der Done-Tasks ohne Säulenzuweisung (Formel wie
  `Dashboard.tsx:131-147`).
- Füllstand: `fill = Σ min(sollAnteil, istAnteil)`, `sollAnteil` = Gewichtsanteil der Säule (bei allen
  Gewichten 0: Gleichverteilung), `istAnteil` = Punkteanteil der Säule an der Gesamtpunktzahl (bei 0
  Gesamtpunkten: 0). Ohne jede erledigte Aufgabe ist `fill = 0` und `hasPoints = false`.
- Ergebnis: `{ fill: number (0–1, ungerundet), hasPoints: boolean, saeulen: { id, name, punkte, gewichtung }[] }`
  — `punkte` ist der rohe (ungerundete) anteilige erledigte Aufwand, `gewichtung` das `Pillar.weight`.
  Säulen ohne Punkte erscheinen mit `punkte: 0`, nicht fehlend.

## Endpunkt: `GET /scores/balance?tz=`

- Hinter dem bestehenden Auth-Gate (Muster `/scores/streak`, `/scores/milestones`): lädt Säulen und
  Tasks strikt mit `ownerScope(getUserId(req))` (nicht die weitere Task-Leseliste aus #1213 —
  gruppengeteilte fremde Aufgaben zählen hier bewusst nicht ein).
- Ruft `berechneLebensbalance` auf und rundet den Füllstand auf eine Prozent-Dezimalstelle
  (`fuellstandProzent`); ergänzt `streak` (`berechneStreak`) und `meilensteine`
  (`berechneMeilensteine`, nur Stufen mit `erreicht: true`) in derselben Antwort (Muster
  `/scores/milestones`).
- `tz`-Query wie bei `/scores/streak`: fehlt der Wert oder ist er ungültig, fällt der Server auf seine
  eigene Zeitzone zurück — kein Fehler.

## MCP-Werkzeug `balance_status`

- Ein Loopback auf `GET /scores/balance` (Muster `tools.ts:73` `callApi`), optionale Eingabe
  `timezone` (String) → `?tz=`. **Kein** `write`-Flag (Nur-lese-Token muss aufrufen können).
- Erweitert den eingefrorenen v1-Werkzeugvertrag (`tools.test.ts`) von dreizehn auf vierzehn Namen
  (alphabetisch vor `category_list` einsortiert).

## Erwartetes Ergebnis

- `fuellstandProzent` ∈ `[0, 100]`, `hatPunkte` unterscheidet „noch nichts erledigt" von
  „unausgewogen".
- Säulen-Liste, Streak und erreichte Meilensteine stammen ausschließlich aus Daten des
  Token-Besitzers; gruppengeteilte fremde Aufgaben zählen nicht ein.
- Eine ungültige `timezone` führt zu keinem Fehler (Fallback Serverzeit); unterschiedliche gültige
  Zeitzonen können den Streak-Stand verändern (Tagesgrenze).
- Dieselben Eingabedaten liefern über die HTTP-Route und über das Werkzeug identische Werte.
