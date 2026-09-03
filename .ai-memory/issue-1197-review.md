# Issue 1197 / PR 1200 — Review (Kreuzverhör, Erstrunde), Stand 2026-09-03

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Sammelkommentar `<!-- ai-review -->` als
issuecomment-5519785871 neu angelegt (Marker fehlte → MODE Kreuzverhör). Keine Inline-Findings,
keine Labels. PR-Titel auf Conventional-Commits-Englisch umbenannt:
`feat(ci): add turn-primary measurement report "Turn-Übersicht" (#1197)` (vorher deutscher
Betreff — Titel-Gate false wegen Sprache; Commit 39dac23e trägt weiter den alten Titel).

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar auf PR 1200 → Erstrunde.
- AK-Quelle geklärt: Issue 1197 hat KEINEN Harness-Marker-Kommentar und KEINEN KI-ANALYSE-Block — AKs = „Woran messen wir das?" aus dem Issue-Body (3 Kriterien); im Sammelkommentar so dokumentiert.
- Gesamtdiff gelesen (569+/49−, 5 Dateien: SCHEMA.md, costs-report.ts, turns-report.ts/.test.ts, report-turns.yml).
- Empirisch verifiziert, nicht nur PR-Behauptungen: (a) `node .github/scripts/turns-report.ts --dir .costs` läuft, alle Zahlen identisch zum PR-Body (143/801/12.470, Ø 22,4/128,6, 0,94/1,25, 1,27/3,12); (b) Kosten-Report Byte-Identität: Basis `git show e578d2aa:...costs-report.ts` + Symlinks auf cost-record/cost-aggregate nach /tmp/basecheck, beide Ausgaben über echte .costs gedifft → identisch; (c) `pnpm test:scripts` (root package.json:23) globt `.github/scripts/*.test.ts` → neue Tests hängen in der Pipeline; (d) report-turns.yml = exaktes Spiegelbild von report-costs.yml (gleicher Checkout-SHA 3d3c42e5, persist-credentials: false); (e) `.ts`-Import-Spezifizierer sind der etablierte Stil der Skripte; knip deckt .github/scripts nicht (Aussage „knip ✅" prüft diese Exports nicht — kein Problem, Präzedenz costs-report-Exports).
- CI geprüft: verify + e2e pass; fixup/implement/gate-merge „skipping" ist Review-Phase-Normalzustand.
- 4 Recherche-Fragen an haiku-Subagenten delegiert (SKILL-Delegation, Nachbarschaft niemals der Diff selbst).

## Relevante Stellen
- `.github/scripts/turns-report.ts` — neues Skript; `isMeasured` (typeof+isFinite) entscheidet „gemessen"; `turnTotals`-Sortierung: measured>0 zuerst, dann Turns desc, dann Issue-Nr; PHASE_ORDER (ADR-0005-Kette) + phaseRank sortieren die Phasen-Tabelle, Unbekannte (mentor) hinten.
- `.github/scripts/costs-report.ts` — Refactoring: `readTickets` (roh, exportiert) + `ticketTotal` + `byValue`; `renderReport` liest jetzt 1× statt 2×; `pct/bar/berlinDay/isoWeek` neu exportiert. Ausgabe byte-identisch (verifiziert).
- `.github/scripts/cost-aggregate.ts:138-188` — `totalsByPhase`: runs = Entry-Zähler, turns via ZERO-Fallback; turns-report übergibt nur measured Entries, daher Semantik „Läufe mit Erfassung" korrekt.
- `.github/workflows/report-turns.yml` — nur workflow_dispatch, contents: read, tee -a $GITHUB_STEP_SUMMARY.
- `.github/scripts/turns-report.test.ts` — 8 Verhaltens-Tests (Altdaten „—", Ø-Verdünnung, Div/0, Berlin-Wochen, Phasenordnung, kaputte Dateien).

## Annahmen
- Byte-Identität nur gegen Stand e578d2aa (PR-Basis) und nur mit den aktuellen .costs-Daten geprüft — als vollständig bewertet, weil das Refactoring mechanisch und die Entry-Folge (wert-sortiertes flatMap über byIssue) zur alten identisch ist.
- AK1 (Workflow läuft grün) gilt als nachgelagert prüfbar (workflow_dispatch nach Merge) — im PR selbst so dokumentiert; lint:actions + Vorläufer-workflow decken das Strukturrisiko ab.
- Deutsche Proper Nouns („Turn-Übersicht") im englischen Titel sind zulässig (Workflow-Name ist Produktname).

## Verworfen
- Finding „`e.turns as number`-Casts verletzen Konvention": Casts narrowing nach Runtime-Check, verstecken keine Compiler-Fehler — nur als Kleinigkeit im Sammelkommentar erwähnt, kein Inline-Finding.
- Finding „Turns-je-Phase-Spalte je Ticket nicht in PHASE_ORDER": Typ-Dokument sagt ausdrücklich Erstauftreten-Reihenfolge (chronologisch je Ticket) — bewusste Entscheidung, lesbar.
- Finding „entries-Kommentar ‚Ticket-Nummer aufsteigend' ist lexicographisch (readdirSync), nicht numerisch": null Verhaltensimpakt (entries fließen nur in Sortierungen/Sets ein, die selbst sortieren) — Doc-Nickeligkeit.
- Memory-Eintrag in MEMORY.md: kein neuer Fehler/eine neue Erfahrung strengeren Kriteriums wert.

## Offen
- `/tmp/basecheck/`, `/tmp/base-out.md`, `/tmp/new-out.md`, `/tmp/pr1200.diff`, `/tmp/ai-review-1200.md` — Wegwerf-Artefakte außerhalb des Repos, kein Commit-Thema.

## Nächster Schritt
- Workflow-Phase (Label-Maschinerie): verdict `reviewed` geschrieben nach /tmp/claude-verdict; Merge-Entscheidung liegt beim Gate/Menschen.

## Fallstricke
- PR 1200 enthält Commit 39dac23e mit dem DEUTSCHEN alten Titel — bei Rebase/Squash entscheidet der PR-Titel (jetzt englisch); nicht wieder „reparieren".
- Issue 1197 hat keinen Analyse-Block: Folgephasen dürfen AK-Quelle nicht im Marker suchen (gibt's nicht) — Issue-Body ist maßgebend.
- Fixup-Nachweis-Runde (falls jemand doch pusht): Sammelkommentar 5519785871 per PATCH updaten, Diff-Scoping ab dessen updatedAt; Finding-Nummern gibt es keine (runde 1 ohne Findings).
