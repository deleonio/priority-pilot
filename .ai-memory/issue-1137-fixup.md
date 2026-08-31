# Issue 1137 — Fixup (PR #1138), Stand 2026-08-31

## Erledigt
- Findings F1–F3 aus dem ai-review-Kommentar (3:06Z) + 3 Threads gelesen, SCOPED nur an den Ankern.
- F2+F3: `.github/prompts/fixup.md` Z.10–12 — Klärungspfad mit definiertem Endzustand (ONE reply, do NOT resolve, NO commit/NO verdict, nächster Lauf liest die Antwort); Z.11 gestrichen, Schritt 4 ist einziger Umsetzungsort und sagt jetzt „Options-ID des Reviews = nur PROPOSAL, warten auf die Menschen-Wahl“.
- AK3: `.claude/skills/review-kreuzverhoer/SKILL.md` Step 4 — Finding-Klassen fixable/decision/ambiguous benannt + „justified match (Abgleich)“-Pflicht (decision nur bei Konflikt mit dokumentierter Menschen-Wahl/ADR). review.md erbt via SKILL-Referenz Z.1.
- AK4: `ux.md` Z.9–22 — Feldlisten-Duplikat auf „fields per SKILL.md → Output“ gekürzt, RMW-Satz gestrichen, CI-Delta-Zeile behalten.
- AK5: `triage.md` — Body-Verbot 3 Zeilen → 1 Zeile („NEVER `gh issue edit --body` — ADR 0009 …; details SKILL.md step 2“), Routing-Pflichtwerte → „values and format per SKILL.md step 4“.
- AK6: `ux.md`/`adr-sync.md`/`spec-sync.md`/`guide-sync.md` — VERDICT-Langform → triage-Kurzform „VERDICT (one line):“, Token-Liste unverändert.
- AK7: `guide-sync.md:27` — „(Regeln aus LOGIN-TB/claude-skills:vermenschlichen)“ gestrichen, Inline-Regeln bleiben.
- AK8: `spec-sync.md` QUELLEN — Delegationszeile `recherche`-Subagent (ADR 0008) ergänzt. guide-sync.md bewusst NICHT (Issue: „nach erstem Lauf Kosten-Messung prüfen und ggf. nachziehen“).

## Relevante Stellen
- `.github/prompts/fixup.md:10,12` — beide Review-Findings (F2/F3) verankert.
- `.claude/skills/review-kreuzverhoer/SKILL.md` Step 4 (nach der Aufzählung 1–3) — Klassifikationsblock.
- `.github/prompts/{ux,triage,adr-sync,spec-sync,guide-sync}.md` — Option-2/3-Ziele.

## Annahmen
- AK-Wortlaute aus dem Issue-Harness-Kommentar standen im Kontext-Deckel nicht wörtlich zur Verfügung; umgesetzt nach den AK-Verifizierungen des Reviews (F1-Thread listet je AK Datei:Zeile + Defizit) + den Umsetzungsschritten der Optionen 2/3 im Issue-Body — deckungsgleich.
- Gate: reine Prompt-/Docs-Änderung, testfrei laut Issue-AK-Block → Prettier-Check auf den 6 Dateien statt Testlauf.

## Verworfen
- guide-sync.md-Delegationszeile (AK8 „analog“) — Issue-Option 3 sagt explizit erst nach Kosten-Messung.
- Renumbering der fixup.md-Schritte 5/6 → 4/5 — Review schlägt „Schritt 4 als einzigen Ort behalten (oder mergen)“ vor; Mergen ohne Renumber ist der kleinere Diff.
- Threads-Resolve vor dem Push — erst Gate+Push, dann Resolve (Reihenfolge SKILL step 5).

## Offen
- -

## Nächster Schritt
- Threads F1–F3 resolven nach dem Push; Re-Review (Phase 7) läuft workflow-seitig.
