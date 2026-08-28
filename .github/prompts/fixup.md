Fixup for PR {{PR_NR}}. Only fix reported findings. Fixup and implementation are ONE phase (ADR 0005) — method: .claude/skills/ticket-implementation/SKILL.md (step 5, cross-examination loop).

PROCEDURE:
1. **Conflicts** (if needed): `git status`, `git diff --name-only --diff-filter=U`, resolve, commit
2. Read findings: PR diff, review threads, CI
3. Fix:
   - Unambiguous findings → change the code, run the GATE (`pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip && pnpm test` — everything green before the push, otherwise the fixup loop keeps spinning), commit+push (include your phase note .ai-memory/issue-{{ISSUE_NR}}-fixup.md in the commit — tracked, NOT gitignored, ADR 0007), resolve the thread
   - Ambiguous/decision findings → don't fix
4. **Decision findings** (already chosen): follow the comment with the option ID, implement EXACTLY that option
5. **CI red**:
   - FLAKY (timeout/timing, thematically unrelated): `gh run rerun <run-id> --failed`, wait 60s
   - Real failure: read the log, fix it, commit+push
   - Unrelated: document in your own ai-fixup-decisions collected comment (no new comment, do NOT touch the review's ai-review comment)
6. **UI findings**: check with the cheap+deterministic tools first (`node .claude/skills/impeccable/scripts/detect.mjs <files…>`, docs/mobile-ui-rules.md); Playwright MCP only for the short 375/1280 layout-break check, not for design analysis. Fix layout breaks, KoliBri-first

WRAP-UP:
- `VERDICT: needs-human` for decision findings (TERMINAL)
- `VERDICT: already-done` for "everything done, no commit needed" (justification per finding: `Finding #<N> — fixed in <SHA>`)
- Otherwise NO verdict (commits determine progress)

For needs-human/already-done, deliver it TWICE:
1. File: `printf 'needs-human' > /tmp/claude-verdict` (VERY LAST action)
2. Output: `VERDICT: needs-human` | `VERDICT: already-done`

ai-fixup-decisions comment structure (for needs-human), written in German:
```markdown
<!-- ai-fixup-decisions -->
🎯 Fixup-Status: needs-human
PR #{{PR_NR}} implementiert Issue #<N>. <Kontext>

## ✅ Behobene Anmerkungen
| # | Finding | Behoben via | Datum |
|---|---------|-------------|-------|

## ⏸️ Entscheidungs-Findings
### <F>. <Titel>
**Was:** <Beschreibung>
**Wo:** <Datei:Zeile>
**Optionen:**
- `<F>.1` <Option> — <Begründung>
- `<F>.2` <Option> — <Begründung>
- `<F>.3` Akzeptieren (Tech Debt) — <Risiko>
**Empfehlung:** `<F>.1` — <Begründung>

**Auswahl:** Kommentar mit Options-ID antworten
Review-Typ: Fixup-Nachweis
Updated: JJJJ-MM-TT
```

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: commit+push the current state, end the turn.
