# Spec: Import aus Todoist und CSV (#1969)

## Ziel

Ein eingeloggter Nutzer kann eine Todoist-Export-CSV oder eine Allgemein-CSV hochladen, in einer
Vorschau Zeilen, Fehler und Spaltenzuordnung prüfen und die Aufgaben dann übernehmen. Unlesbare
Zeilen werden einzeln gemeldet (Zeilennummer + Grund), ohne den Import abzubrechen. Der Import ist
additiv — er legt Aufgaben an und ändert/löscht keine bestehenden.

## Voraussetzungen

- Eingeloggte Session; alle Daten gehören dem eingeloggten Nutzer (`ownerScope`-Muster).
- Task-Validierung wie `POST /tasks` (`server/src/express/routes/tasks.ts`): Titel max. 65 Zeichen,
  Priorität Ganzzahl 1–5, Frist parsebares Datum.
- Kategorien/Säulen existieren je Nutzer; Zuordnung nur gegen Bestand (keine Neuanlage).

## Datenvertrag

- `parseCsv(text: string): string[][]` (`server/src/logics/csv.ts`, RFC-4180 ohne Fremd-Dependency):
  BOM wird entfernt; CRLF und LF trennen Zeilen; Anführungszeichen um Felder (Komma im Feld,
  `""`-Escape); Leerzeilen entfallen.
- `POST /tasks/import/preview` und `POST /tasks/import`, JSON-Body `{ csv: string, mapping?: Mapping }`
  (die Datei wird clientseitig gelesen und als String gesendet; kein multipart).
- `Mapping` benennt je Zielfeld die CSV-Spalte: `{ title?, deadline?, priority?, category?, pillar? }`.
  Ohne `mapping` gilt Todoist-Auto-Erkennung (Spalten `TYPE`/`CONTENT`/`PRIORITY`/`DATE`).
- Preview-Antwort: `{ total, valid, skippedNonTask, samples, errors, unmapped }` mit
  `total` = Anzahl Datenzeilen, `valid` = übernehmbare Aufgabenzeilen, `skippedNonTask` = Zeilen mit
  `TYPE != task`, `samples` = max. 5 Einträge `{ row, title, deadline, priority }`,
  `errors` = je unlesbarer Zeile `{ row, reason }`, `unmapped` = je nicht zuordenbarem
  Kategorie-/Säulenwert `{ row, field, value }`, `columns` = Spaltennamen der Header-Zeile
  (Angebot für das Spalten-Mapping der UI; in der Impl ergänzt, #1969).
- Import-Antwort: `{ created, skippedNonTask, errors }`; `errors` wie Preview.
- `row` ist die 1-basierte Datenzeilennummer (erste Zeile nach dem Header = 1).
- Grenzen (vor jeder Verarbeitung geprüft): `csv` länger als 10 MB oder mehr als 5000 Datenzeilen →
  HTTP 400 mit `{ message }` (bewusst 400, nicht 413 — der Import-Router mountet mit eigenem
  Body-Limit 10 MB).

## Ablauf / Verhalten

### CSV-Parsing (AK2)

- Der Parser liefert die Rohzeilen; darauf arbeiten Vorschau und Import. Er ist deterministisch und
  ohne Netz — kein Injektionspunkt nötig.

### Todoist-Mapping (AK1)

- Je Zeile mit `TYPE=task` entsteht eine Aufgabe: Titel = `CONTENT`, Frist = `DATE` (ISO-Datum,
  als UTC-Mitternacht geparst), Priorität gemappt: Todoist 4→5, 3→4, 2→3, 1→2.
- Zeilen mit `TYPE != task` (z. B. `note`) werden übersprungen und in der Vorschau gezählt
  (`skippedNonTask`), erscheinen weder in `samples` noch in `errors`.

### Fehlertoleranz (AK3)

- Eine unlesbare Zeile (leerer/zu langer Titel, ungültiges Datum, ungültige Priorität) wird nicht
  importiert; alle übrigen Zeilen werden regulär angelegt. `errors` meldet je betroffener Zeile
  Nummer + verständlichen Grund.
- Enthält die Datei 0 übernehmbare Zeilen, wird nichts angelegt und HTTP 400 mit `{ message }`
  zurückgegeben.

### Spalten-Mapping (AK4)

- `mapping` legt je Zielfeld (Titel, Frist, Priorität, Kategorie, Säule) die zu nutzende CSV-Spalte fest.
- Kategorie-/Säulenwerte werden per Name case-insensitive gegen die bestehenden Kategorien/Säulen
  des Nutzers gematcht. Treffer: Aufgabe erhält `categoryId` bzw. eine Säulen-Zuordnung mit
  `share` 100 (genau eine Säule). Kein Treffer: keine Zuordnung; der Wert erscheint in der Vorschau
  unter `unmapped`.

### Limits und Isolation (AK5)

- Grenzprüfung vor jedem Schreibzugriff (s. Datenvertrag), Antwort 400 + `{ message }`.
- Alle erzeugten Aufgaben tragen die `userId` des eingeloggten Nutzers; ein zweiter Nutzer sieht
  keine davon.

### UI: Einstellungen-Import (AK6)

- Neue Einstellungs-Registerkarte „Import“ (Route `/app/settings/import`) mit `TaskImportCard`
  (Wurzelelement `task-import-card`): Datei auswählen → Vorschau (Gesamtzahl, valide Anzahl,
  Beispiele, Fehlerliste mit Zeilennummer + Grund, `unmapped`-Hinweise, Spalten-Mapping je Zielfeld
  als Select) → Übernehmen. Bestätigungs-Button mit Kontext-Label „N Aufgaben übernehmen“; nach der
  Übernahme erscheint die Anzahl erzeugter Aufgaben (Erfolgs-Meldung).
- Fokus nach dem Rendern der Vorschau bzw. der Erfolgs-Meldung auf die jeweilige Meldung (KI-UX);
  Zustände Leer/Laden/Fehler/Erfolg als Einladung/KolSpin/KolAlert danger/KolAlert success.
- Bei 375px Breite bleibt die Import-Karte im Viewport (Bounding-Box-Prüfung, kein
  Horizontal-Overflow).

### Onboarding-Einstieg (AK7)

- Schritt 1 des Onboardings bietet einen optionalen Verweis auf den Import an (Button-Label
  enthält „importieren“) — kein Pflichtschritt, kein eigener Screen.

## Annahmen

- Todoist-Export nutzt Spalten `TYPE,CONTENT,PRIORITY,DATE` (gequoted, CRLF/BOM möglich); Priorität
  4 ist die höchste Todoist-Priorität und wird auf intern 5 gemappt.
- `DATE` ist ein ISO-Datum (YYYY-MM-DD); andere Formate gelten als ungültiges Datum.
- Der Import läuft synchron in einem Request (5000-Zeilen-Grenze macht Chunking unnötig).
