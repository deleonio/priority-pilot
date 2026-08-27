<!-- ai-review -->
🎯 Review-Status: **needs-fixup** — Kreuzverhör Runde 1 zu PR #1068 (ohne Issue, Direktauftrag: „Review ohne Issue - PR-Beschreibung ist massgebend", keine AK-Verifikation möglich). Umsetzung der vier Darstellungsformen vollständig und in sich stimmig; ein fixables Finding zu fehlenden Tests.

## ✅ Behobene Anmerkungen

| # | Finding | Behoben via | Datum |
| --- | --- | --- | --- |
| — | bisher keine | — | — |

## 📋 Offene Findings

| # | Fund | Ort | Vorschlag |
| --- | --- | --- | --- |
| 1 | 🟡 Neue Berechnungen (`isoWeek`, `richtung`, `bar`/`share`, Pareto) ohne committete Tests — die Jahresgrenzen-Prüfung „2027-01-01 → 2026-W53" steht nur im PR-Body; Schwellen-Rundung in `richtung` zeigt 9,95 % als „↑ 10 %" statt „→" | `.github/scripts/costs-report.ts:105` (Details im Inline-Kommentar) | `costs-report.test.ts` erweitern: ISO-Jahresgrenze, Schwellen-Pin bei 9,95 %, Fenster-Ausschluss > 14 Tage / < 2 Runs |

---
Review-Typ: Kreuzverhör
Updated: 2026-08-27
