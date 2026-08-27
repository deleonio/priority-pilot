<!-- ai-review -->
🎯 Review-Status: **reviewed** — Fixup-Nachweis Runde 2 zu PR #1068 (ohne Issue, Direktauftrag: „Review ohne Issue - PR-Beschreibung ist massgebend", keine AK-Verifikation möglich). Finding 1 ist sauber behoben: die ±10-%-Schwelle entscheidet jetzt am Rohwert, und die drei neuen Tests (ISO-Jahresgrenze, Schwellen-Pin, Fenster-Ausschluss) laufen im CI-Verify-Job grün (ci.yml:89, Run auf `54f5e60e` success). Keine neuen Findings im Fixup-Diff.

## ✅ Behobene Anmerkungen

| # | Finding | Behoben via | Datum |
| --- | --- | --- | --- |
| 1 | 🟡 Neue Berechnungen (`isoWeek`, `richtung`, `bar`/`share`, Pareto) ohne committete Tests; Schwellen-Rundung zeigte rohe +9,95 % als „↑ 10 %" statt „→" | Commit `54f5e60e`: `richtung` entscheidet an `Math.abs(raw) < 0.1`, Runden nur noch in der Anzeige (`costs-report.ts:375-383`, Grenzfall exakt 10 % bleibt korrekt „↑ 10 %") + 3 neue Tests in `costs-report.test.ts` (2027-01-01 → `2026-W53` + Balken + Pareto-Fußnote; Schwellen-Pin Ø 1,00 → 1,0995 = „→" mit Gegenprobe „↑ 25 %"; Fenster-Ausschluss 20 Tage / 1 Run → „—") — Fixtures deterministisch (Anker = jüngster Datensatz, keine Wanduhr) | 2026-08-27 |

---
Review-Typ: Fixup-Nachweis
Updated: 2026-08-27
