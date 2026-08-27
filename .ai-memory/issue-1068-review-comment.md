🟡 **Kreuzverhör Runde 1** — die vier Darstellungsformen sind vollständig und sauber umgesetzt (KPI-Kopf, kumulierte Linie + Wochenraster, Anteils-Balken + Pareto-Fußnote, 7-Tage-Richtungstabelle mit Datensatz-Anker). Die drei im PR-Body selbst beanspruchten Kreuzverhör-Fixes sind im Diff nachvollziehbar. Ein fixables Finding (Tests) → needs-fixup.

**Kurzübersicht:**
- 🟡 **F1 — neue Berechnungen ohne committete Tests** (Inline-Kommentar unten): `isoWeek`, `richtung`, `bar`/`share` und die Pareto-Fußnote sind von keinem der 3 existierenden Tests abgedeckt.
- Nebenbemerkung (nicht blockierend): der Guard `if (kpiRows.length > 0)` ist faktisch immer true, da die Review-Runden-Zeile unbedingt gepusht wird — darf bleiben, ist aber kein echter Leer-Fall.

Review ohne Issue — PR-Beschreibung ist massgebend.
