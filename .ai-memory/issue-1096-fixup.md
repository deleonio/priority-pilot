# Issue/PR 1096 — Fixup, Stand 2026-08-28

## Erledigt
- Finding F1 behoben: `.github/prompts/prompt-audit.md:1` FOCUS-Zeile „initial token cost“ → „net token efficiency (NET cost over the whole phase chain)“ — deckt den Widerspruch zum FRAME (Zeile 3, NET-Metrik „not the initial read alone“) und öffnet den Scope für Kriterium F (Konkretisierung darf Initial-Tokens hinzufügen). Nur diese eine Zeile geändert; maschinenlesbare Teile (Workflow-Assertion-Step) unberührt.
- Review-Thread (PRRT_kwDONloM186dOu4D, Kommentar-DB 3882174122) gelöst — Vorschlag-Text des Findings fast wörtlich umgesetzt.
- Phase-Note committed (ADR 0007, tracked). Sonstige untracked `.ai-memory/issue-1091-*.md` bewusst NICHT in den Commit.

## Relevante Stellen
- `.github/prompts/prompt-audit.md:1` — FOCUS-Zeile, der einzige Fund; Zeile 3 (FRAME/NET-Metrik) bleibt Referenz.
- `.github/workflows/claude-prompt-audit.yml:146-225` — Post-Assertion-Step, von F1 nicht berührt, nicht angefasst.

## Annahmen
- F1 ist der einzige offene Fund des Reviews (Review-ID 5052931186, Erstrunde) — keine Entscheidung-Findings vorhanden.
- Markdown-only Änderung → GATE beschränkt sich auf Prettier-Check; kein Test/Build betroffen.

## Verworfen
- Weitere Kürzungen an Zeile 3/15/26-28 — laut Review-Notiz inhaltlich korrekt, kein offener Fund („Only fix reported findings“).

## Offen
-

## Nächster Schritt
- Re-Review (Kreuzverhör, zweite Runde) gegen den neuen SHA: nur Delta prüfen, F1 als behoben verifizieren, Sammelkommentar aktualisieren.

## Fallstricke
- Commit-Nachbarn: `.ai-memory/issue-1091-fixup.md`/`-implement.md` liegen untracked im Arbeitsverzeichnis — beim `git add` nur `issue-1096-fixup.md` + die Prompt-Datei nehmen, nicht `git add -A`.
