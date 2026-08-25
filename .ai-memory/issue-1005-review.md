# Review PR #1005 (Memory-Transport + Prompt-Platzhalter) — Phase 5

## Erledigt
- Modus: KREUZVERHÖR (Erst-Review, kein Marker vorhanden). Diff 100% gelesen, PR-Head (7fda07bc) ausgecheckt.
- Verifiziert 🟢: Guard in allen 9 Prompt-Bau-Blöcken; assert-prompt-complete.sh in 3 Fällen live getestet (Token→1, sauber→0, fehlend→1); jedes {{TOKEN}} in .github/prompts/ hat seinen sed im nutzenden Workflow (Abgleich komplett); keine funktionalen .claude/memory-Reste (nur 2 bewusst erklärende Verweise setup-claude:87, adr0006:50); .gitattributes/.gitignore/.prettierignore/AGENTS.md/docs konsistent; git ls-files .ai-memory → nur MEMORY.md (eingecheckt ✓); notes-vs-staged-Zählung korrekt (state.json matcht nicht issue-*); Alt-State-Branch fail-open dokumentiert; Titel konform; KoliBri N/A; PR-Checks grün (verify/e2e/precheck).
- EIN Finding #1 🟡: .claude/commands/spec-ticket.md:32 sagt noch „Ersetze `#ISSUE_NR` / `ISSUE_NR` gedanklich durch $ARGUMENTS" — Token-Name existiert nach dem PR nicht mehr (spec.md nennt {{ISSUE_NR}}). Konsument derselben Quelle laut 03-claude-spec.yml-Kommentar. Fix = Einzeiler.

## Offen
- (keine)

## Nächster Schritt
- FERTIG: Review-Kommentar (Finding #1) + ai-review-Sammelkommentar (needs-fixup) gepostet (issuecomment-5404318556). Verdict needs-fixup gesetzt. Folgereview (FIXUP-NACHWEIS) prüft nur Finding #1 (.claude/commands/spec-ticket.md:32) + Fixup-Diff.

## Fallstricke
- PR #1005, head fix/memory-transport-und-platzhalter, base main, 4 Commits, kein Ticket-AK-Block (Infra-Fix).
- Mischzustand während PR offen ist laut Body bewusst (Phase 1–4 alt aus main, 5–6 neu aus PR-Head).
- Finding-Nummern über Runden stabil: #1 = spec-ticket.md Token-Drift.
- Dauergedächtnis-Kandidat (Review committet nicht, hier geparkt): PR-Inline-Review-Kommentare gehen NUR auf Diff-Zeilen; Findings in unveränderten Dateien als COMMENT-Review + Verweis Datei:Zeile im Sammelkommentar posten.
