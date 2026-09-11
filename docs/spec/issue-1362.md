# Meilenstein-Badges auf dem Dashboard

**Stand:** 2026-09-11

## Ziel

Das Dashboard zeigt eine Card „Meilensteine" mit fest definierten Streak- und Punkte-Stufen. Erreichte Stufen sind ausgeprägt dargestellt, nicht erreichte bleiben sichtbar, aber unausgeprägt. Die Auswertung ist rückwirkend: Bestandsdaten oberhalb einer Schwelle zählen schon beim ersten Aufruf, ohne gespeicherten Zustand.

## Stufen

- Streak (gegen `best` aus `berechneStreak`, #1360): 3, 7, 14, 30, 100 Tage.
- Punkte (Summe aus `ScoreEntry.punkte`, Quelle B — Gamification-Punkte, nicht das Dashboard-Gesamtguthaben): 50, 250, 1000, 5000 Punkte.
- Beide Stufenlisten sind Konstanten in `server/src/logics/milestones.ts` und im Gamification-Abschnitt von `docs/user-guide.md` dokumentiert, samt Hinweis, dass ein Punkte-Badge nach dem Wiedereröffnen einer erledigten Aufgabe wieder erlöschen kann (Persistenzvariante „nur ableiten", kein gespeicherter Erreicht-Zustand).

## Logik: `berechneMeilensteine({ bestStreak, punkteSumme })`

- Liefert genau eine Stufe je Definition (Streak zuerst, dann Punkte), jeweils in der oben genannten aufsteigenden Reihenfolge.
- Jede Stufe: `{ schluessel: string, typ: 'streak' | 'punkte', schwelle: number, erreicht: boolean }`.
- Eine Stufe gilt genau ab Erreichen der Schwelle als erreicht: Wert gleich Schwelle ⇒ `erreicht: true`; Wert gleich Schwelle minus 1 ⇒ `erreicht: false`.
- Streak-Stufen werden gegen `bestStreak` geprüft, nicht gegen den aktuellen (laufenden) Streak — ein gerissener Streak lässt einmal erreichte Streak-Badges nicht wieder verschwinden.
- Reine Funktion ohne DB-Zugriff; Aufrufer reicht `bestStreak` (aus `berechneStreak(...).best`) und `punkteSumme` (Summe der `ScoreEntry.punkte` des Nutzers) herein.

## Endpunkt: `GET /scores/milestones`

- Hinter dem bestehenden Auth-Gate (Muster `/scores/by-pillar`, `/scores/streak`): wertet ausschließlich `ScoreEntry`- und Erledigungs-Daten des eingeloggten Nutzers aus (`ownerScope`); `GET /scores` ist ungescoped und deshalb nicht die Quelle.
- Query-Parameter `tz` (IANA-Zeitzone) bestimmt wie bei `/scores/streak` die Kalendertagsgrenze für den zugrunde liegenden Streak; fehlt `tz` oder ist der Wert ungültig, fällt der Server auf seine eigene Zeitzone zurück — kein Fehler.
- Antwort `200`: Liste der Stufen wie oben beschrieben.

## Frontend: `MilestoneBadges`

- Eigenständige Dashboard-Card (Muster `StreakCard`: lädt selbst über `api.getMilestones()`), `data-testid="milestone-badges-card"`.
- Rendert alle Stufen. Erreichte und nicht erreichte Badges sind im DOM über `data-erreicht="true"`/`"false"` unterscheidbar; nicht erreichte bleiben sichtbar (kein Ausblenden).
- Mobile-first: bei 375px Viewportbreite bleibt die Card vollständig innerhalb der Viewportbreite (kein horizontales Scrollen), alle Badges bleiben sichtbar.

## Erwartetes Ergebnis

- Nutzer mit Bestandsdaten oberhalb mehrerer Schwellen: beim ersten Aufruf sind alle überschrittenen Stufen `erreicht: true`, ohne dass eine neue Erledigung nötig war.
- Ein gerissener Streak lässt zuvor erreichte Streak-Badges erreicht bleiben (Prüfung gegen `best`, nicht `aktuell`).
- Erledigungen eines anderen Nutzers verändern die eigene Auswertung nicht (Datenisolation).
