# PR 1068 — Review (Kreuzverhör Runde 1 + Fixup-Nachweis Runde 2)

## Erledigt
- Runde 1 (Kreuzverhör): siehe Git-Historik dieser Datei; Kernpunkte: MODE Kreuzverhör, kein Closing-Issue („Review ohne Issue"), F1 (Inline-Kommentar 3875041148, costs-report.ts:105) + Sammelkommentar (ID 5444022861) + Verdict needs-fixup; Titel umbenannt in `ci(costs): add KPI header, weekly trend, share bars, direction table` (nicht nochmal umbenennen).
- Runde 2 (Fixup-Nachweis, 2026-08-27): MODE Fixup VERIFICATION — Marker-Kommentar 5444022861 vorhanden (updatedAt 2026-08-27T19:11:26Z), Delta = genau 1 Commit danach: `54f5e60e` (19:38:02Z), Diff nur `costs-report.ts` (+8/−4) + `costs-report.test.ts` (+65/−1).
- Fixup-Diff verifiziert: `richtung` entscheidet an `Math.abs(raw) < 0.1` (costs-report.ts:375-383), Runden nur Anzeige; Grenzfall raw = exakt 0,1 → „↑ 10 %" korrekt zur Fußnote „unter ±10 %". 3 neue Tests: ISO-Grenze (2027-01-01 → `2026-W53`, 2027-01-01 = Freitag), Schwellen-Pin (Ø 1,00 vs 1,0995 → „→", Gegenprobe ↑ 25 %), Fenster-Ausschluss (20-Tage-Eintrag raus, 1 Run → „—").
- Determinismus verifiziert: `anchorDay` aus `Math.max(Date.parse(...))` der Daten (costs-report.ts:354), keine Wanduhr → Tests zeitunabhängig; Fenster-Ausschluss `age > 13` (367-368).
- Testnachweis: CI-Workflow ci.yml:89 führt `pnpm test:scripts` im verify-Job aus; CI-Run 33109414134 auf Head `54f5e60e` = success (verify + 4 e2e-Shards grün) → autoritativ grün. Lokal NICHT reproduzierbar: Runner hat kein node_modules/tsx (node --import tsx → ERR_MODULE_NOT_FOUND); pnpm fehlt im PATH. Fixup-Phase hatte zusätzlich Red-Check per git stash gemacht (alt: 5 pass/1 fail).
- Sammelkommentar 5444022861 per PATCH aktualisiert (F1 → Behoben-Tabelle, Status reviewed, Review-Typ: Fixup-Nachweis); Verdict `reviewed` nach /tmp/claude-verdict + Output.

## Relevante Stellen
- `.github/scripts/costs-report.ts:375-383` — `richtung`: Schwelle am Rohwert (Bugfix aus F1).
- `.github/scripts/costs-report.ts:352-373` — Richtungsfenster: Anker aus Daten, age ≤ 6 neu / 8-13 alt, > 13 ausgeschlossen.
- `.github/scripts/costs-report.test.ts:84-141` — die 3 neuen Tests, alle über `renderReport`-Ausgabe (keine Helfer-Exporte, knip-sicher).
- `.github/workflows/ci.yml:89` — `pnpm test:scripts` im verify-Job (Nachweiskanal für Script-Tests).

## Annahmen
- Lokales HEAD (Merge cd621baa aus 54f5e60e) entspricht PR-Head — Commit-Daten via API gegengeprüft (a99e67ea + 54f5e60e).
- „Review pending" in gh pr checks ist der eigene Review-Workflow-Run — kein rotes Gate.

## Verworfen
- Lokaler Testlauf — kein pnpm/tsx/node_modules im Runner; CI-Verify auf dem Head ist der stärkere Nachweis. Monorepo-Install (>Minuten) lohnt nicht.
- Erneutes Abwägen der Runde-1-Nebenbemerkungen (KPI-Guard immer true etc.) — Fixup-Verifikation prüft nur Delta + offene Findings.

## Offen
- -

## Nächster Schritt
- Keine — PR ist aus Review-Sicht fertig (reviewed); Gate/Merge übernimmt pr-gate-merge.yml (CI grün auf 54f5e60e).

## Fallstricke
- Frischer Review-Runner: pnpm NICHT im PATH, node_modules fehlt → Script-Tests nie lokal laufen lassen, stattdessen ci.yml-Verify-Job als Nachweis nehmen.
- Sammelkommentar-ID 5444022861 bleibt stabil über alle Runden (PATCH, nie neu anlegen).
- Finding-Nummer F1 ist verbraucht/behoben — neue Findings in einer allfälligen Runde 3 ab F2 nummerieren.
