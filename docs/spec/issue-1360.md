# Streak-Anzeige auf dem Dashboard

**Stand:** 2026-09-11

## Ziel

Das Dashboard zeigt eine Card „Streak" mit der Anzahl der Kalendertage in Folge, an denen der Nutzer mindestens eine Aufgabe erledigt hat, sowie der persönlichen Bestmarke.

## Datengrundlage

Erledigungszeitpunkte kommen aus `ScoreEntry.zeitpunkt` (eine Zeile je erledigtem Task, `taskId` unique). Mehrere Erledigungen am selben Kalendertag zählen als ein aktiver Tag.

## Logik: `berechneStreak(erledigungsZeitpunkte, heute, zeitZone)`

- Bildet aus den Zeitpunkten die aufsteigend sortierte, duplikatfreie Liste `aktiveTage` (`YYYY-MM-DD`, Kalendertag in `zeitZone`).
- `aktuell`: Länge der ununterbrochenen Tagesfolge, die auf `heute` oder `heute - 1 Tag` endet. Endet die letzte Folge früher, ist `aktuell = 0`.
- `best`: Länge der längsten ununterbrochenen Tagesfolge über alle `aktiveTage`.
- Ohne Erledigungen: `aktuell = 0`, `best = 0`, `aktiveTage = []`.

## Endpunkt: `GET /scores/streak`

- Hinter dem bestehenden Auth-Gate (Muster `/scores/by-pillar`): wertet ausschließlich `ScoreEntry`-Zeilen zu Tasks des eingeloggten Nutzers aus (`ownerScope`).
- Query-Parameter `tz` (IANA-Zeitzone, z. B. `Europe/Berlin`): bestimmt die Kalendertagsgrenze. Fehlt `tz` oder ist der Wert keine gültige IANA-Zeitzone, fällt der Server auf seine eigene Zeitzone zurück — kein Fehler.
- Antwort `200`: `{ aktuell: number, best: number, letzterTag: string | null }` (`letzterTag` = jüngster Eintrag aus `aktiveTage`, oder `null` ohne Erledigungen).

## Frontend: `StreakCard`

- Eigenständige Dashboard-Card (Muster `NearbyCard`: lädt selbst über `api`), `data-testid="streak-card"`, zeigt `aktuell` und `best`.
- Bei `aktuell = 0` erscheint ein gestalteter Zustandstext (`data-testid="streak-zero"`) statt einer kontextlosen Zahl; die Bestmarke bleibt sichtbar (`data-testid="streak-best"`, immer im DOM sobald geladen).
- Mobile-first: bei 375px Viewportbreite bleibt die Card vollständig innerhalb der Viewportbreite (kein horizontales Scrollen), Muster `ai-disable.spec.ts` AK6.

## Erwartetes Ergebnis

- Nutzer mit drei zusammenhängenden Erledigungstagen bis heute: Card zeigt Streak 3.
- Streak gerissen (letzte Erledigung vor mehr als einem Tag): Card zeigt den Zustandstext, Bestmarke bleibt sichtbar.
- Erledigungen eines anderen Nutzers verändern die eigene Anzeige nicht (Datenisolation).
