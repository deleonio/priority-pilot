**F1 · 🟡 — Neue Berechnungen ohne committete Tests**

**Was:** Die vier neuen Darstellungsformen bringen eigene Berechnungslogik — `isoWeek` (Zeile 105), `richtung` inkl. 7/14-Tage-Fenster (ab Zeile 363), `bar`/`share` (94–102) und die Pareto-Fußnote (412). Keiner der 3 existierenden Tests in `costs-report.test.ts` deckt davon etwas ab: sie prüfen Ticket-Sortierung, Skip-Handling kaputter Dateien und eine Alt-Regex auf die Phasenzeile (`\| review \| 1 \| — \|` — prefix-match, bleibt durch die neue Anteil-Spalte zufällig grün).

**Warum:** `isoWeek` ist eine handgewickelte ISO-8601-Kalenderlogik, deren Fehlerstelle exakt der Jahreswechsel ist — und der PR-Body dokumentiert die Prüfung „2027-01-01 → 2026-W53" manuell nach. Das ist ein Testfall, der aufgeschrieben und weggeworfen statt committet wurde. Gleiches Muster bei `richtung` (Zeile 379): `Math.round(Math.abs(raw) * 100) < 10` zeigt eine Änderung von 9,95 % als „↑ 10 %", obwohl die Fußnote „→ = unter ±10 %" verspricht. Ohne pinnden Test regressiert das beim nächsten Refactor unbemerkt — der Docstring der eigenen Testdatei sagt genau das Risiko („falsch summiert bleibt unbemerkt").

**Vorschlag:** `costs-report.test.ts` erweitern, testbar über die `renderReport`-Ausgabe (kein Export der Helfer nötig):
1. Fixture mit Eintrag am 2027-01-01 → Wochentabelle enthält `2026-W53` (Jahresgrenze).
2. Zwei-Fenster-Fixture, deren alt/neu-Ø roh 9,95 % auseinanderliegen → erwartet `→` (oder Schwellenvergleich vor dem Runden: `Math.abs(raw) >= 0.1` entscheiden, Runden nur für die Anzeige).
3. Eintrag älter als 14 Tage taucht in keinem Richtungsfenster auf; Eintrag mit < 2 Runs im Fenster → `—`.
