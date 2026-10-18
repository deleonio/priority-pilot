# Spec: Issue 2690 — Effort-Umrechnung zentralisieren (logics/effort.ts)

## Ziel

Die Umrechnung von Stundenschätzungen in das Tage-Feld `estimatedEffort` (Skala 0.1–1 Tage
zu je 14 h) wohnt heute lokal in `server/src/mcp/tools.ts:135-151` (`effortFromHours` samt
`HOURS_PER_EFFORT_DAY`/`MIN_EFFORT`/`MAX_EFFORT`), während die Route
`server/src/express/routes/tasks.ts:415-425` dieselben Grenzen als Literale 0.1/1 validiert.
Nach diesem Issue existiert genau eine Wahrheit: `server/src/logics/effort.ts` (Muster:
`logics/geo.ts`), genutzt von Route und MCP.

## Vertrag des Moduls `server/src/logics/effort.ts` (neu)

Exporte:

- `HOURS_PER_EFFORT_DAY = 14` — ein Aufwands-Tag zählt 14 h reguläre Wachzeit
  (openapi.yml, Schema `Task.estimatedEffort`).
- `MIN_EFFORT = 0.1` — unteres Ende der Tage-Skala.
- `MAX_EFFORT = 1` — oberes Ende der Tage-Skala.
- `effortFromHours(hours: unknown): number` — rechnet Stunden in Tage um:
  - ablehnend mit genau dem Fehler `estimatedEffortHours must be a finite number > 0.`
    (byte-identisch zum heutigen MCP-Vertrag), wenn `hours` keine endliche Zahl > 0 ist
    (String, `undefined`, `null`, `NaN`, `Infinity`, `0`, negative Werte);
  - sonst `Math.round((hours / 14) * 100) / 100`, geklemmt auf `[0.1, 1]`.

Externe Verträge bleiben unverändert: MCP-Schema-Beschreibungen (`mcp/tools.ts:333-344`),
die Mutually-exclusive-Meldung `estimatedEffort and estimatedEffortHours are mutually
exclusive — provide only one.` sowie die Routen-Meldung `estimatedEffort muss eine Zahl
zwischen 0.1 und 1 sein.` (auch `routes/series.ts:293` nutzt denselben Text — bleibt,
gehört aber nicht zum Pflichtumfang dieses Issues).

## Schritte und erwartete Ergebnisse

1. `effortFromHours(7)` → `0.5` (halber Tag).
2. `effortFromHours(42)` → `1` (Kappung oben — Skala endet bei einem Tag, kein Fehler).
3. `effortFromHours(0.5)` → `0.1` (Kappung unten — Skala beginnt bei 0.1).
4. `effortFromHours(3)` → `0.21` (Rundung auf zwei Nachkommastellen).
5. Ungültige Eingaben werfen die bestehende MCP-Fehlermeldung (siehe oben).
6. `mcp/tools.ts` importiert Umrechnung und Grenzen von dort; keine lokalen Konstanten
   `HOURS_PER_EFFORT_DAY`/`MIN_EFFORT`/`MAX_EFFORT` und keine Funktion `effortFromHours`
   mehr in der Datei (Verifikation per Grep — Implementierungs-PR, kein Test, da
   String-Matcher keine Zähne haben).
7. Die estimatedEffort-Validierung in `routes/tasks.ts` prüft gegen `MIN_EFFORT`/`MAX_EFFORT`
   statt der Literale 0.1/1; die Meldung bleibt byte-identisch.
8. `docs/fachlogik-inventar.md`: neue Tabellenzeile (Befund „bereits zentral", Fundort
   `logics/effort.ts`, Nutzer Route + MCP) und Korrektur des Absatzes „Übrige MCP-Werkzeuge …"
   (Zeile 22-23) — reine Doku-Änderung, kein Testfall.
9. Spiegel: die bestehenden End-to-End-Tests `server/src/mcp/tools.test.ts:321-356` (7→0.5,
   42→1, 3→0.21; Schema, Fehlermeldungen, task_create + task_update) bleiben unverändert grün.

## Testfälle

- TF1 → AK1/AK2/AK3: `server/src/logics/effort.test.ts` (node:test, neue Datei) — Umrechnung,
  Kappung, Rundung, Fehlervertrag, exportierte Grenzwerte.
- TF2 → AK3: `pnpm --filter server test` — unverändertes `tools.test.ts` bleibt grün
  (Integrationsspiegel).
- TF3 → AK4: Doku-Änderung, kein Testfall.
