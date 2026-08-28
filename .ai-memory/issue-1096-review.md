# Issue/PR 1096 — Review (Kreuzverhör, Erstrunde), Stand 2026-08-28

**ERGEBNIS: VERDICT needs-fixup (🟡, 1 fixabler Fund F1).**

## Erledigt
- MODE bestimmt: kein vorhandener `<!-- ai-review -->`-Kommentar auf PR 1096 → Kreuzverhör/Erstrunde; `closingIssuesReferences` = [] → „Review ohne Issue — PR-Beschreibung massgebend“ (Zeile 2 im Sammelkommentar vermerkt).
- Volle Diff gelesen: nur `.github/prompts/prompt-audit.md` (+7/−6) und `.github/workflows/claude-prompt-audit.yml` (+6/−1, ausschließlich Kommentarblock Zeilen 4–11).
- PR-Body-Behauptungen verifiziert: VERDICT-Grep (`findings|clean`, Workflow Zeile 164), EMPFOHLEN-Grep (Zeile 196), Issue-Handling (Zeilen 201–218), `{{AUDIT_DATE}}`/`{{SOFT_DEADLINE}}`-sed + assert-prompt-complete.sh — alles unberührt; `.costs/` existiert (FRAME-Referenz gültig); Kategorie-Enum (Redundanz|Kürzung|Konkretisierung|Widerspruch|Unklarheit|Fehler) deckt A–F konsistent ab.
- Review als COMMENT mit Inline-Kommentar gepostet (Review-ID 5052931186): **F1** = `.github/prompts/prompt-audit.md:1` „initial token cost“ widerspricht neuer NET-Metrik aus FRAME (Zeile 3).
- Sammelkommentar einmalig erstellt (issuecomment-5454934979) mit Marker, Review-Status needs-fixup, Offene Findings #1, Footer „Review-Typ: Kreuzverhör / Updated: 2026-08-28“.
- Titel-Gate: Titel konform (ci(prompts): …, deutsch = Repo-Konvention, s. Git-Log) → NICHT umbenannt.

## Relevante Stellen
- `.github/prompts/prompt-audit.md:1` — offener Fund F1 (FOCUS-Zeile, einzeiliger Fix).
- `.github/prompts/prompt-audit.md:3,15,26-28` — die neuen NET/Konkretisierungs-Teile (inhaltlich korrekt und vollständig).
- `.github/workflows/claude-prompt-audit.yml:146-225` — maschinen gelesener Post-Assertion-Step (bei Fixup nicht berühren).

## Annahmen
- „~50 Turns pro Fixup-Schleife“ aus `.costs/` wurde nicht selbst nachgerechnet — Zitat-Charakter, für den Fund nicht entscheidend.
- Server-Test-Rot in `session.test.ts` ist pre-existing (MEMORY 2026-08-27, Redis nur als CI-Service) — PR ändert nur Markdown + YAML-Kommentar.

## Verworfen
- „erwartete Ersparnis“ in der Options-Vorlage (prompt-audit.md:34) statt „NETTO“ als zweiten Fund — Zeile 32 deckt es („each package states its net effect“); Rauschen.
- Titel-Rename auf Englisch — Repo-Konvention sind deutsche Subjekte; Struktur konform, kein false-Flag im Prompt.

## Offen
- Wegwerf-Artefakte untracked in `.ai-memory/`, gehören NICHT in einen Commit: `issue-1096-review-payload.json`, `issue-1096-review-comment.md` (`rm` braucht Freigabe, wie in 1083/1090).

## Nächster Schritt
- Fixup-Runde: F1 beheben (Zeile 1 „initial token cost“ → z. B. „token efficiency (net effect over the phase chain)“), dann Fixup-Nachweis-Review (MODE anhand Markers, nur Delta + F1).

## Fallstricke
- Review-Post mit `--arg "…(…)"` crasht am Bash-Parser (Klammern) → Payload per Write als Datei + `gh api --input` (MEMORY 2026-08-24 analog).
- Beim Fixup-Nachweis: wieder nur PR 1096, Delta seit Updated 2026-08-28; Finding-Nummer #1 stabil halten.
