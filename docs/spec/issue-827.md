# Issue 827: ai:needs-human Entscheidungs-Findings

## Ziel

Strukturierte Entscheidungs-Sektion in `ai:needs-human` Kommentaren um manuelle Entscheidungen zu erleichtern.

## Vorbedingung

- PR-Review oder Fixup Workflow läuft
- Claude setzt `VERDICT: needs-human`

## Schritte

1. **Review-Workflow** (.github/workflows/05-claude-pr-review.yml): Bei `needs-human` im `<!-- ai-review -->` Sammelkommentar Sektion `## ⏸️ Entscheidungs-Findings` einfügen mit:
   - Nummeriertes Listing jedes Findings
   - **Was**: Beschreibung des Problems
   - **Wo**: Datei:Zeile
   - **Optionen**: 2-3 konkrete Handlungsoptionen mit Kurzbegründung
   - **Empfehlung**: Was Claude empfehlen würde

2. **Fixup-Workflow** (.github/workflows/06-claude-pr-fixup.yml): Bei `needs-human` Kommentar mit Marker `<!-- ai-fixup-decisions -->` im selben strukturierten Format posten.

3. **Workflow-Kommentare** → Action-Cards ( beide workflows, 4 Templates): Strukturierte Action-Cards mit:
   - Klares **Warum** (welcher Fall: Review-Entscheidung / Fixup-Entscheidung / kein Fortschritt / Crash)
   - Verweis auf Claude's strukturierte Sektion
   - **Checkliste** mit konkreten Schritten:
     1. Entscheidungs-Findings durchgehen
     2. Entscheidung treffen
     3. Label `ai:needs-human` entfernen
     4. Label `ai:needs-review` setzen

4. **Race-Condition-Konsistenz**: 3 Race-Condition-Kommentare minimales Format-Upgrade für Konsistenz.

## Erwartetes Ergebnis

- Review-Sammelkommentar enthält bei `needs-human` strukturierte Entscheidungs-Sektion
- Fixup postet bei `needs-human` strukturierten Entscheidungs-Kommentar
- Alle 4 `ai:needs-human` Templates haben Action-Card-Format mit Checkliste
- Race-Condition-Kommentare folgen konsistentem Format

## Testfälle

1. Review workflow → needs-human: Prüfe ob `<!-- ai-review -->` neue Sektion enthält.
2. Fixup workflow → needs-human: Prüfe ob Marker `<!-- ai-fixup-decisions -->` vorhanden.
3. Workflow-Kommentare: Prüfe Action-Card-Struktur (4 Templates).
4. Race-Condition: Prüfe konsistentes Format.

## Implementierungshinweise

- Prompts in 05-claude-pr-review.yml (Zeile 178-181) erweitern
- Prompts in 06-claude-pr-fixup.yml (Zeile 221-238) erweitern
- 4 `ai:needs-human` Kommentar-Templates (05 Zeile 370, 06 Zeilen 328/343/357) umbauen
- Race-Condition-Kommentare format-upgrade für Konsistenz
