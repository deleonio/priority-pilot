# Aufgaben mit Datum erst melden, wenn das Datum naht (Vorlauf 3 Tage) – Issue 1641

**Stand:** 2026-09-23
**Ziel:** Eine Aufgabe mit `deadline` mehr als 3 Kalendertage in der Zukunft wird im Top-3-Push (06:00 Uhr), bei „Nächste Aufgabe" (`GET /next`, MCP `next_task`) und bei „Was ist jetzt dran?" (`GET /suggestions`) zurückgehalten. Aufgaben ohne `deadline`, mit `deadline` innerhalb der 3 Tage und überfällige Aufgaben verhalten sich unverändert. Ersetzt #1478, #1596, #1597, #1598.

Ausgangslage: `collectDailyTopTasks` (`server/src/logics/dailyTopTasks.ts`) und `ladeFreieTasks` (`server/src/logics/find.ts`, gemeinsame Vorstufe von `findNextImportantTask` und `findSuggestedTasks`) sortieren bzw. filtern bislang nur nach Priorität/Abhängigkeit — ein Datum in der fernen Zukunft verdrängt undatierte oder näher fällige Aufgaben nicht.

---

## Vorlauf-Regel (gilt an allen drei Lesestellen gleich)

- Eine benannte Konstante `VORLAUF_TAGE = 3` (Kalendertage).
- `deadline` mehr als `VORLAUF_TAGE` Kalendertage in der Zukunft (bezogen auf den UTC-Kalendertag von `now`, analog `selectSeriesRepresentatives`) ⇒ die Aufgabe wird **zurückgehalten** (erscheint nicht).
- `deadline` genau `VORLAUF_TAGE` Tage in der Zukunft ⇒ Grenze **inklusiv**, die Aufgabe erscheint.
- Keine `deadline`, `deadline` innerhalb der `VORLAUF_TAGE` oder überfällige `deadline` ⇒ unverändert wie bisher.
- Bei Serien entscheidet das Datum der von `selectSeriesRepresentatives` gewählten aktuellen Instanz; liegt dieses mehr als `VORLAUF_TAGE` Tage in der Zukunft, erscheint die ganze Serie nicht.
- Der Filter setzt **nach** `selectSeriesRepresentatives` und **vor** der Top-N-/Sortier-Auswahl an, sodass zurückgehaltene Aufgaben durch die nächstberechtigte ersetzt werden (Nachrücken).

Unverändert: Erinnerung 24 h vorher (`dueTaskReminders`), automatisches Löschen nach verpasster Deadline, Wochenansicht, Aufgabenliste, Dashboard-Karte „Anstehende Deadlines", Erledigen-Pfad inkl. Pünktlichkeitspunkte. Kein neues Datenfeld, keine Migration.

---

## Journey 1: Top-3-Push um 6 Uhr

### Ziel

Der tägliche Push nennt nur Aufgaben, deren Datum (falls vorhanden) höchstens 3 Tage entfernt ist oder bereits überschritten wurde.

### Vorbedingung

Ein Nutzer hat mehrere offene Aufgaben mit unterschiedlichen Prioritäten und Daten, teils mehr als 3 Tage in der Zukunft.

### Schritte

1. `collectDailyTopTasks(now)` wird mit den offenen Aufgaben des Nutzers aufgerufen.
2. Aufgaben mit `deadline` > `now` + 3 Kalendertage werden vor der Top-3-Auswahl entfernt.
3. Aus den verbleibenden Aufgaben werden wie bisher die 3 nach Priorität höchsten gewählt.

### Erwartetes Ergebnis

- Eine P1-Aufgabe mit Datum in 5 Tagen fehlt in der Gruppe.
- Dieselbe Aufgabe mit Datum in 3 Tagen ist enthalten (Grenze inklusiv).
- Aufgaben ohne Datum und überfällige Aufgaben sind enthalten wie bisher.
- Wird eine Aufgabe zurückgehalten, füllt die nächstberechtigte Aufgabe den freien Platz (weiterhin bis zu 3 je Nutzer).
- Eine Serie mit aktueller Instanz in 5 Tagen erscheint gar nicht.

---

## Journey 2: „Nächste Aufgabe" und „Was ist jetzt dran?"

### Ziel

`findNextImportantTask` und `findSuggestedTasks` (und damit `GET /next`, `GET /suggestions`, MCP `next_task`) schlagen keine Aufgabe vor, deren Datum mehr als 3 Tage entfernt ist.

### Vorbedingung

Offene, nicht blockierte Aufgaben mit unterschiedlichen Daten liegen vor; darunter eine mit höherer Priorität, aber Datum in 5 Tagen.

### Schritte

1. `ladeFreieTasks` filtert wie bisher nach Status und Abhängigkeiten (unverändert, AC3 aus #122).
2. Danach entfernt derselbe Vorlauf-Filter Aufgaben mit `deadline` > 3 Kalendertage in der Zukunft.
3. `findNextImportantTask` wählt aus dem Rest wie bisher die höchste Priorität; `findSuggestedTasks` scort und filtert wie bisher.

### Erwartetes Ergebnis

- Eine Aufgabe mit Datum in 5 Tagen erscheint in keinem der beiden Ergebnisse, auch wenn sie die höchste Priorität hätte.
- Dieselbe Aufgabe mit Datum in 3 Tagen erscheint in beiden (Grenze inklusiv).
- Aufgaben ohne Datum und überfällige Aufgaben erscheinen wie bisher.
- Eine Serie, deren aktuelle Instanz ein Datum in 5 Tagen hat, erscheint in keinem der beiden Ergebnisse.

---

## Journey 3: Erledigen einer zurückgehaltenen Aufgabe

### Ziel

Eine zurückgehaltene Aufgabe lässt sich jederzeit erledigen und bekommt die Punkte für pünktliches Erledigen — der Vorlauf-Filter wirkt nur auf die drei Lesestellen, nicht auf den Erledigen-/Score-Pfad.

### Erwartetes Ergebnis

Bereits durch die bestehende Scoring-Suite abgedeckt (`server/src/express/score.test.ts` AK1: Deadline weit in der Zukunft, Statuswechsel auf Done ⇒ `pünktlich = true`, volle Punktzahl) — der Erledigen-Pfad prüft `deadline` gegen `erledigtAm`, nicht gegen den Vorlauf-Filter. Kein neuer Test nötig (Dedup).

---

## Nicht Teil dieser Spezifikation

- Erinnerung 24 h vorher (`dueTaskReminders`), automatisches Löschen nach verpasster Deadline: bestehende Tests bleiben grün.
- Wochenansicht, Aufgabenliste, Dashboard-Karte „Anstehende Deadlines": zeigen weiterhin alle Aufgaben unabhängig vom Vorlauf.
- Der Scoring-Bucket „> 7 Tage ⇒ 0,2" in `normDeadline` (`server/src/logics/find.ts`) wird durch den Filter für die verbleibenden Kandidaten unerreichbar; das Ranking der übrigen ändert sich dadurch nicht.
