# Issue 1197 — Documenter (Phase 6), Stand 2026-09-03

## Erledigt
- PR #1200 (merged, Author deleonio) gelesen: `gh pr view 1200` + `gh pr diff 1200`. 6 Dateien: `.github/scripts/turns-report.ts` (neu, 285 Z.), `.github/scripts/turns-report.test.ts` (neu, 8 Tests), `.github/workflows/report-turns.yml` (neu, workflow_dispatch), `.github/scripts/costs-report.ts` (Refactor: `readTickets`/`berlinDay`/`isoWeek`/`bar`/`pct` exportiert, Ausgabe byte-identisch), `.costs/SCHEMA.md` (Verweis auf Turn-Bericht).
- `/tmp/doc.json` geschrieben und mit `jq -e .` verifiziert (OK, 3428 B). Struktur exakt nach SKILL.md.
- Classification `new` (neues Report-Script + neuer Workflow; bei Zweifel nicht `internal` laut Skill). Kein Breaking → `migration_en` leer.
- `title` leer: Titel `feat(ci): add turn-primary measurement report "Turn-Übersicht" (#1197)` ist compliant (Input: title compliant = true) und Typ passt — despite Prompt-Hinweis „type/scope = chore/k.A.", der Titel selbst ist `feat(ci)` und korrekt.
- Keine gh pr edit/comment/label-Aufrufe (Review-Tier-Ban eingehalten). Keine Code-Änderungen.

## Relevante Stellen
- `.github/scripts/turns-report.ts` — Kern-Neulieferung; rendert Ø Turns je Lauf/Ticket, Schleifen-Raten (Fixup÷Implement 0,94 Turns/1,25 Läufe; Review÷Implement 1,27/3,12 lt. PR-Body), Phasen-Anteile, Wochen-Trend (Tabelle + Mermaid, Berliner Zeit), Turn-Fresser je Ticket.
- `.github/scripts/costs-report.ts:31-130` — gemeinsame Datenquelle `readTickets` (roh) + `ticketTotal` (Summe); `pct`/`bar` exportiert für turns-report.
- `.github/workflows/report-turns.yml` — nur `workflow_dispatch`, `contents: read`, schreibt in Job-Summary; kein Schedule (Momentaufnahme wie Kosten-Übersicht).
- `.costs/SCHEMA.md:122-134` — dokumentiert `turns` = API-Calls und den Bericht-Aufruf `node .github/scripts/turns-report.ts --dir .costs`.

## Annahmen
- Altdaten-Regel: Läufe vor #984 ohne `turns`-Feld erscheinen als „—" und zählen in keinem Durchschnitt (steht so im PR-Body als AK; nicht selbst am Code nachvollzogen, aber durch Tests in turns-report.test.ts gedeckt).
- Closes #1197 aus dem PR-Body übernommen — keine weiteren verknüpften Issues.

## Verworfen
- Classification `internal` — Bericht hat klaren Nutzwert für Maintainer und ist mehr als reine CI-Hausarbeit; Skill sagt bei Zweifel NOT internal.
- Titel-Rename — existierender Titel bereits Conventional-Compliant und typrichtig.
- Datei-Liste kürzen auf „3-8 relevanteste" — alle 5 Quell-/Doku-Dateien sind relevant und bleiben unter dem Limit; vollständige Abdeckung der Diff-Dateien.

## Offen
- -

## Nächster Schritt
- Keiner — Phase abgeschlossen; `/tmp/doc.json` liegt für den aufrufenden Lauf bereit.

## Fallstricke
- Der Prompt-Hinweis „type/scope = chore/k.A." widerspricht dem tatsächlichen Titel `feat(ci)` — Titel-Compliance-Flag (true) war maßgeblich, nicht die vorgeschlagene Scope-Zeile.
- issues-Referenz nur aus dem Body („Closes #1197") ableitbar; issue-1197 hat keine eigenen „Fixes"-Zeilen ergänzt.
