# PR 1068 — Review (Kreuzverhör Runde 1)

## Erledigt
- MODE bestimmt: Kreuzverhör (kein `<!-- ai-review -->`-Kommentar vorhanden, geprüft via issues/1068/comments).
- Kein Closing-Issue (`closingIssuesReferences` = []) → „Review ohne Issue - PR-Beschreibung ist massgebend".
- Vollständigen Diff gelesen (1 Commit a99e67ea, nur `.github/scripts/costs-report.ts`, +187/−34).
- `docs/kosten-optimierungsplan.md` verifiziert: existiert, Ziele (< $3.00 / ≤ 1,2 / > 95 %) stehen dort (Zeilen 283–296) — Fußnoten-Referenz valide.
- Testdatei `.github/scripts/costs-report.test.ts` geprüft: 3 Tests decken KEINEN der neuen Code-Teile ab (nur Sortierung, Skip-Handling, Alt-Regex `\| review \| 1 \| — \|` — prefix-match bleibt durch neue Anteil-Spalte grün).
- Finding 1 als Inline-Kommentar (costs-report.ts:105) + Sammelkommentar + Verdict `needs-fixup` gepostet; Titel-Gate: Titel war deutsch + >72 Zeichen → umbenannt in `ci(costs): add KPI header, weekly trend, share bars, direction table`.

## Relevante Stellen
- `.github/scripts/costs-report.ts:105` — `isoWeek`: handgewickelte ISO-8601-Woche (Donnerstags-Anker), Jahreswechsel = Fehlerstelle; Prüfung „2027-01-01 → 2026-W53" steht nur im PR-Body, nicht als Test.
- `.github/scripts/costs-report.ts:375` — `richtung`: Schwelle `Math.round(Math.abs(raw)*100) < 10` — 9,95 % Änderung rundet auf 10 → zeigt „↑ 10 %" obwohl Fußnote „→ = unter ±10 %" verspricht.
- `.github/scripts/costs-report.ts:98/94` — `bar`/`share`: clamping sauber, aber ungetestet.
- `.github/scripts/costs-report.ts:412` — Pareto-Fußnote Top-5-Anteil, ungetestet.

## Annahmen
- Lokales HEAD (4532d338, Merge von a99e67ea) entspricht PR-Head → Zeilennummern aus lokalem grep gelten fürs PR-Diff.
- Review-Runden-KPI (alle Tickets als Nenner, nicht nur messende) ist eine tragbare Definition — kein Finding.
- Division-durch-0 in `richtung` unmöglich, weil `messende` nur valueCost > 0 enthält und alt.runs ≥ 2 gefordert ist.

## Verworfen
- „KPI-Zeilen-Guard `if (kpiRows.length > 0)` ist immer true" — harmlose Robustheit, kein Finding (nur Nebenbemerkung in der Review-Summary).
- NaN bei leeren tickets (`tickets[0].first`) — pre-existing, außerhalb des Diffs.
- KoliBri-first / Impeccable / Mobile-first — N/A (Markdown-Report, kein `frontend/`-Code).
- Math.max-Spread über große Arrays — pre-existing Idiom, aktuelles Datenvolumen (88 Datensätze) unkritisch.

## Offen
- -

## Nächster Schritt
- Fixup-Runde: prüfen, ob costs-report.test.ts um (a) ISO-Jahresgrenzen-Fixture (2027-01-01 → „2026-W53"), (b) Schwellen-Pin bei 9,95 % roher Änderung (→ vs ↑), (c) Fenster-Ausschluss (> 14 Tage) erweitert wurde → dann Fixup-Nachweis.

## Fallstricke
- PR-Titel wurde vom Reviewer umbenannt — in Runde 2 nicht nochmal umbenennen.
- Finding-Nummerierung: Finding 1 = „keine Tests für neue Berechnungen" — stabil halten, in Runde 2 bei Behoben-Tabelle als #1 führen.
- Kein Issue hinter PR 1068 (Direktauftrag) — AK-Verifikation ist nie möglich, nur PR-Beschreibung.
