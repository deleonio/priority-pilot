# Nur vollständige Säulenverteilungen speichern (Issue 2077)

**Stand:** 2026-10-02

## Ziel

Das Backend speichert Säulenbeiträge von Aufgaben und Serienvorlagen nur noch in einer einheitlichen
Form: entweder leer (`pillars: []`) oder als Vollverteilung über ALLE Säulen des Eigentümers mit
jedem Anteil zwischen 5 und 80 % und Summe exakt 100. Alles andere wird mit HTTP 400 und einer
Fehlermeldung abgelehnt, die die Regel nennt. Übergaben füllen die Verteilung beim Empfänger wieder
zu einer gültigen Vollverteilung auf; Bestand bleibt lesbar und wird nicht migriert; der Demo-Seed
sät nur gültige Verteilungen.

## Voraussetzungen

- Konto mit den fünf Standard-Säulen (Registrierung säht sie, `models/pillarData.ts`); im
  Dev-Pass-Through ohne Session (API-Tests) gelten die vorhandenen Säulen als Konto-Säulen.
- Gültige Verteilung: deckt alle Säulen des Eigentümers ab, jeder Anteil 5–80, Summe 100.

## Schritte und erwartetes Ergebnis

### AK1 — Unvollständige oder verletzte Verteilungen → 400 mit Regeltext

POST/PATCH auf `/tasks` und `/series` mit …

- einer Teilmenge der Säulen (z. B. 2 von 3, gültige Anteile, Summe 100),
- einem Anteil unter 5 (z. B. 4/96),
- einem Anteil über 80 (z. B. 81/19),
- einer Summe ≠ 100 (bestehende Tests, bleibt gültig)

… antworten mit HTTP 400. Die Fehlermeldung nennt die Regel: alle Säulen oder leer, jeder Anteil
5–80, Summe 100 (geprüft wird, dass „alle", 5, 80 und 100 im Text vorkommen — exakter Wortlaut frei).

### AK2 — Gültige Vollverteilungen und die leere Liste werden gespeichert

- POST `/tasks` bzw. `/series` mit Verteilung über alle Säulen (je 5–80, Summe 100) → 201; die
  Beiträge sind gespeichert (Response nach pillarId sortiert, confidence defaultet auf 100).
- PATCH ersetzt die Beiträge vollständig durch eine neue gültige Vollverteilung → 200.
- `pillars: []` bleibt erlaubt und entfernt alle Beiträge (durch bestehende Tests gedeckt).
- MCP: task_create nimmt eine Vollverteilung über die fünf Standard-Säulen an.

### AK3 — MCP-Werkzeuge nennen die Regel und lehnen dieselben Nutzlasten ab

- tools/list: die pillars-Beschreibung von task_create und task_update nennt die Regel
  („alle Säulen" sowie die Grenzen 5/80/100).
- task_create mit Teilmenge → Fehler mit „(HTTP 400)" und Regeltext; task_update mit Anteil 81 →
  Fehler mit „(HTTP 400)". Die Validierung läuft über die gespiegelte Route.

### AK4 — Übergabe füllt zu einer gültigen Vollverteilung auf

Nach PATCH `{ userId }` (Aufgabe bzw. Serienvorlage) an ein Gruppenmitglied trägt der Empfänger eine
gültige Verteilung über ALLE seine Säulen: der Name-Remap behält die Anteile gleichnamiger Säulen,
Säulen ohne Gegenstück werden aufgefüllt (jeder Anteil 5–80, Summe 100). Weiterhin zeigt kein
Beitrag auf eine Säule der bisherigen Eigentümerin (bestehende Invarianten-Tests bleiben grün).

### AK5 — Bestand bleibt lesbar und unverfälscht

Eine Alt-Verteilung (einzelne Säule, share 100 — direkt in der DB, außerhalb der neuen Validierung)
bleibt über GET abrufbar und geht unverfälscht in die Balance-Rechnung ein; beim Lesen findet keine
Migration statt (Beitragszeilen unverändert).

### AK6 — Demo-Seed säht nur gültige Verteilungen

`seedDemoData` (Seam: `server/src/logics/demoSeed.ts`, Export `seedDemoData`; die Demo-Säulen werden
wie in `index.ts` über `SEED_PILLARS` gesät) legt nur Task-Verteilungen an, die je alle Säulen
abdecken, je Anteil 5–80 und Summe 100 einhalten.

## Testpflege

Gegen die neue Regel widersprechende Alt-Tests (sie versiegeln den alten Vertrag „Teilmenge oder
Einzel-Säule ist gültig" als Erfolgsfall) werden im Spec-Commit entfernt und im PR-Body unter
„Test-Pflege-Bedarf" benannt. Alt-Fixtures in Semantik-Tests (Replace/Clear/Summe/Duplikat) stellt
die Umsetzung mit dem gemeinschaftlichen Vollverteilungs-Helfer um (~55 Fixtures,Issue-Analyse).
