# Tag geschafft: Abschluss-Moment bei leerer Tagesliste

**Stand:** 2026-09-11

## Ziel

Sind alle offenen Aufgaben abgehakt und wurde heute mindestens eine Aufgabe erledigt, zeigt Priority
Pilot auf Dashboard und Aufgaben-Tab einen sichtbaren Abschluss-Hinweis („Tag geschafft"). Sobald
wieder eine offene Aufgabe existiert, verschwindet der Hinweis ohne Reload.

## Datengrundlage

Kein neuer Server-Endpunkt, keine zweite Erledigungsauswertung: die Tages-Erkennung nutzt
ausschließlich `letzterTag` aus dem bestehenden `GET /scores/streak?tz=<Client-Zeitzone>`
(`server/src/express/routes/scores.ts`, siehe `docs/spec/issue-1360.md`). `letzterTag` ist der
jüngste Kalendertag (`YYYY-MM-DD`, Client-Zeitzone) mit mindestens einer Erledigung, oder `null` ohne
Erledigungen.

## Logik: `istTagGeschafft(tasks, letzterTag, heuteTag)`

Reine Ableitung, keine Netzwerk-/Zeit-Zugriffe (`heuteTag` und `letzterTag` werden übergeben):

- `true` genau dann, wenn **beide** Bedingungen gelten:
  - keine Aufgabe in `tasks` hat den Status `Open` oder `InProcess`,
  - `letzterTag === heuteTag` (heutige Erledigung — ohne diese Zusatzbedingung würde ein leeres,
    frisch angelegtes Konto ohne jede Erledigung ebenfalls den Hinweis zeigen).
- Sonst `false`, insbesondere wenn `letzterTag === null` oder `letzterTag` ein anderer Tag ist als
  `heuteTag`, auch wenn keine offenen Aufgaben existieren.

## Frontend: `DayDoneHint`

- Eigenständige Komponente (Muster `StreakCard`: lädt `api.getStreak({ tz })` selbst, keine
  Prop-Kette), erhält die aktuelle Aufgabenliste als Prop und rendert bei `istTagGeschafft(...) ===
  true` einen Knoten `data-testid="day-done"`, sonst keinen Knoten (nicht nur versteckt — nicht im
  DOM).
- Zwei Einbauorte mit identischer Bedingung:
  - Dashboard (`Dashboard.tsx`, neben `<StreakCard />`), Bedingung wertet die volle `tasks`-Liste aus.
  - Aufgaben-Tab, Offen-Ansicht (`App.tsx`, Zeile ~899): Bedingung hängt an der **ungefilterten**
    `tasks`-Liste, nicht an `filteredForest` — ein aktiver Titel- oder Kategoriefilter darf die
    Sichtbarkeit nicht verändern.
- Kommt eine offene Aufgabe hinzu (z. B. materialisierte Serie) und wird `tasks` neu geladen,
  verschwindet der Hinweis ohne Reload (reine Ableitung aus Props/State, kein gecachter Zustand).
- `server/src/**` bleibt unverändert.
- Mobile-first: bei 375px und 320px Viewportbreite bleibt der Hinweis vollständig innerhalb der
  Viewportbreite (Bounding-Box, kein horizontales Scrollen — Muster `issue-1360-streak.spec.ts`).

## Erwartetes Ergebnis

- Alle Aufgaben erledigt, letzte Erledigung heute: Hinweis sichtbar auf Dashboard und Aufgaben-Tab.
- Eine offene Aufgabe vorhanden: kein Hinweis, unabhängig von aktiven Filtern.
- Keine offenen Aufgaben, aber letzte Erledigung nicht heute (oder nie erledigt): kein Hinweis.
