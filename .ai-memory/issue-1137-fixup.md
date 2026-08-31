# Issue 1137 — Fixup (PR #1138), Stand 2026-08-31 — Runde 2

## Erledigt (Runde 2, ai-review vom 2026-08-31)
- SCOPED gelesen: nur die 2 offenen Findings des ai-review-Kommentars (F1-Rest, F4) + der eine offene Thread (ux.md:23, id 3891503098). 3 alte Threads bereits resolved.
- F1-Rest/AK6: restliche 4 von 8 Dateien auf „VERDICT (one line):" konvertiert — `spec.md:25`, `implement.md:34`, `prompt-audit.md:45` (Langform-Zeile ersetzt) und `review.md:41` (Headerzeile in Kurzform + ORDER-Absatz als eigene Zeile, Token-Liste unverändert). Verifikation: grep zählt 1 Treffer je Datei in allen 8, Langform 0 Treffer repo-weit.
- F4: PR-Body neu geschrieben (`.ai-memory/issue-1137-pr-body.md` → `gh pr edit 1138 --body-file`): Optionen 1–3 statt nur Option 1, Runde-1-Tabelle je AK, AK3-Abgleich (SKILL Step 4 Klassen = fixup.md Schritt 3 Pfade, kein Klassenneuanbau), AK8-Beleg (`.claude/agents/recherche.md`, Setup über setup-claude, Präzedenz 04/05-Workflows), Runde-0-Zitat korrigiert.
- Gate (gate-runner-Subagent): pnpm format / prettier --check . / pnpm lint / pnpm knip — ALLE exit 0; pnpm test übersprungen (nur .github/prompts/*.md geändert, kein Code; session.test.ts lokal redis-rot, prä-existing).

## Erledigt (Runde 1)
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

## Offen
- `.ai-memory/issue-1137-pr-body.md` = Wegwerf-Artefakt (PR-Body-Quelle), NICHT committen. Untracked bleiben außerdem `issue-1137-review.md`, `issue-1137-triage.md`, `.costs/1137.json` (fremde Phasen) — nicht mitcommitten.

## Nächster Schritt
- Re-Review (Phase 7) läuft workflow-seitig; alle 3 Threads beantwortet + resolved (PRRT_kwDONloM186dmW6T/-W6Z/-W6d), Gate grün (Verify-Run 33353336438 auf 38560fe6 ✓, inkl. 4 E2E-Shards). Kein Verdict (Fixup-Runde mit Commits).
