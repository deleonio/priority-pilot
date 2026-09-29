# Plan: Prompt-Audit #1590 umsetzen

## Context

#1590 hat keine Kommentare; der Body enthält 6 Funde plus 2 Querwidersprüche. Alle Funde wurden gegen das Repo geprüft. Fünf stimmen, Rang 6 braucht einen anderen Fix als vorgeschlagen. Ziel: Option 1 des Audits (alle Funde) mit korrigiertem Rang 6 umsetzen. Das sind reine Prompt- bzw. Skill-Zeilen ohne App-Code und ohne neue Mechanik.

## Prüfergebnis je Fund

| Rang                      | Befund im Repo                                                                                                                                                   | Maßnahme                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1 review.md               | bestätigt, keine EFFICIENCY-Zeile                                                                                                                                | Zeile ergänzen                                  |
| 2 SKILL 3c                | bestätigt, Kette ohne `pnpm -r build` (AGENTS.md hat es seit #1576)                                                                                              | build einfügen                                  |
| 3 fixup.md                | bestätigt, nur die Runden-Bündelung ist geregelt, die Erstreads nicht                                                                                            | Zeile ergänzen                                  |
| 4 documenter.md           | bestätigt                                                                                                                                                        | Halbsatz ergänzen                               |
| 5 acht nächtliche Prompts | bestätigt, kein Hinweis auf „Turns bündeln“                                                                                                                      | je eine Zeile                                   |
| 6 spec.md `$DRAFT_BRANCH` | **Vorschlag des Audits falsch**: `03-define-spec.yml:232` schreibt den echten Branch in `{{RESUME_HINT}}`, und der Draft-Branch muss nicht `ai/harness/N` heißen | auf den Branch aus dem Resume-Hinweis verweisen |
| Randnotiz                 | `review-kreuzverhoer/SKILL.md:3` sagt „CI phase 5/7“                                                                                                             | auf „CI phase 5“ ändern                         |

## Änderungen

1. **`.github/prompts/review.md`**: nach der `FOCUS:`-Zeile, im Muster von triage.md/ux.md:
   `EFFICIENCY: batch the reads (AGENTS.md "Turns bündeln") — ai-review marker search + gh pr view (closingIssues) + gh pr diff + issue/harness comment in ONE tool block (both modes need them); target < 15 turns per run.`
2. **`.claude/skills/ticket-implementation/SKILL.md`**:
   - 3c: `pnpm -r build` zwischen `pnpm lint` und `pnpm knip` einfügen.
   - Z. 83 (PR-Beschreibung): Ergebnisse von build ergänzen.
   - Z. 97 (Kurz-Gate im Fixup) bleibt unverändert, denn dort geht es nur um Nit-Fixes ohne Build-Wirkung.
3. **`.github/prompts/fixup.md`**: vor `PROCEDURE:`
   `EFFICIENCY: batch the initial reads (AGENTS.md "Turns bündeln") — git status + conflict check + ai-review comment + threads in ONE tool block; target < 30 turns per run.`
   Die `keep in sync`-Blöcke bleiben unverändert.
4. **`.github/prompts/documenter.md`**: INPUTS auf „… read them yourself, BOTH in ONE tool block (AGENTS.md "Turns bündeln").“ ändern.
5. **Nächtliche Prompts** (adr-sync, arc42-sync, guide-sync, spec-sync, code-review-team, ux-team, prompt-audit, design-optimize): je eine Zeile, direkt am jeweiligen Leseschritt („SOFORT starten …“ bzw. „read ALL …“). Die Zeile folgt der Sprache der Datei:
   - deutsch: `EFFIZIENZ: Quellen in EINEM Tool-Block lesen (AGENTS.md "Turns bündeln").`
   - englisch: `EFFICIENCY: read all sources in ONE tool block (AGENTS.md "Turns bündeln").`
   - design-optimize.md hat keinen expliziten Leseschritt, deshalb kommt die Zeile dort an den Prozedur-Anfang.
6. **`.github/prompts/spec.md:19`**: `(git fetch origin && git switch <branch from the resume hint>)`.
7. **`.claude/skills/review-kreuzverhoer/SKILL.md:3`**: „CI phase 5/7“ → „CI phase 5“. Das ist ASCII-Frontmatter, also nur diese Zeichen ändern.

Nicht übernommen: keine Kanonisierung der Gate-Kette über SKILL 3c hinaus. AGENTS.md stimmt bereits, und `knip` bleibt die bewusste Zusatzschärfe.
