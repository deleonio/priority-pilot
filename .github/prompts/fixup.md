Fixup for PR {{PR_NR}}. Only fix reported findings. Fixup and implementation are ONE phase (ADR 0005) — method: .claude/skills/ticket-implementation/SKILL.md (step 5, cross-examination loop; incl. its Delegation section: gate runs and search questions go to haiku subagent roles).

PROCEDURE:
1. **Conflicts** (if needed): `git status`, `git diff --name-only --diff-filter=U`, resolve, commit
2. Read findings SCOPED (mirrors the review's own diff scoping, SKILL.md step 5): open findings from the collected ai-review comment (file/line anchors) + review threads + CI — NOT a full-diff walk. Read only the diff hunks around the anchors (git diff on the affected files); the review already judged the rest.
   - ai-review comment: `gh api repos/{owner}/{repo}/issues/{{PR_NR}}/comments --jq '.[] | select(.body | startswith("<!-- ai-review -->"))'`
   - threads: `gh api repos/{owner}/{repo}/pulls/{{PR_NR}}/comments`
3. Fix:
   - Unambiguous findings → change the code, run the GATE per SKILL.md step 3c (everything green before the push, otherwise the fixup loop keeps spinning), commit+push (include your phase note .ai-memory/issue-{{ISSUE_NR}}-fixup.md in the commit — tracked, NOT gitignored, ADR 0007), resolve the thread:
     `gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved comments(first:1){nodes{path line}}}}}}}' -f o=<owner> -f r=<repo> -F n={{PR_NR}} --jq '.data.repository.pullRequest.reviewThreads.nodes[] | [.id, .isResolved, .comments.nodes[0].path, .comments.nodes[0].line] | @tsv'` (pick the thread ID by path/line, skip `isResolved=true`; threads are GraphQL-only — REST `pulls/{pr}/threads` does NOT exist, and gh has NO native resolve command) → `gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{id}}}' -f t=<thread-id>`
   - **Nachweis-Tabelle MITFUEHREN (every round, not only terminal):** after EVERY fix commit, add a row
     `| <N> | <finding short title> | <SHA> | <date> |` to "## ✅ Behobene Anmerkungen" of the
     ai-fixup-decisions collected comment (find the existing one via its marker and PATCH it — never
     a new comment). The follow-up review verifies THIS table as its claim checklist instead of
     re-walking the delta — a missing row keeps the finding open and costs a round.
   - Ambiguous findings → ONE clarification reply in its review thread (do NOT resolve; end the round with NO commit and NO verdict — the next run reads the answer); if not resolvable in thread → treat as decision finding (options + recommendation in ai-fixup-decisions, VERDICT: needs-human)
4. **Decision findings** → the review's option ID is only a PROPOSAL; wait for the human's choice (their reply comment carries the option ID), then implement EXACTLY that option
5. **CI red**:
   - FLAKY (timeout/timing, thematically unrelated): `gh run rerun <run-id> --failed`, wait 60s
   - Real failure: read the log, fix it, commit+push
   - Unrelated: document in your own ai-fixup-decisions collected comment (no new comment, do NOT touch the review's ai-review comment)
6. **UI findings**: SKILL.md step 3c (deterministic tools first; Playwright MCP only for the short 375/1280 layout-break check). Fix layout breaks, KoliBri-first

⚠️ LABELS: do NOT set labels! The workflow handles that automatically.

WRAP-UP:
- `VERDICT: needs-human` for decision findings (TERMINAL)
- `VERDICT: already-done` for "everything done, no commit needed" (justification per finding `Finding #<N> — fixed in <SHA>` in the ✅ Behobene Anmerkungen table of the ai-fixup-decisions comment)
- Otherwise NO verdict (commits determine progress)

For needs-human/already-done, deliver it TWICE:
1. File: `printf 'needs-human' > /tmp/claude-verdict` (VERY LAST action)
2. Output: `VERDICT: needs-human` | `VERDICT: already-done`

ai-fixup-decisions comment structure (created with the first fix round, ✅-Tabelle kept current
per fix — status line 🎯 Fixup-Status only for terminal verdicts needs-human/already-done), written in German:
```markdown
<!-- ai-fixup-decisions -->
🎯 Fixup-Status: needs-human
PR #{{PR_NR}} implementiert Issue #<N>. <Kontext>

## ✅ Behobene Anmerkungen
| # | Finding | Behoben via | Datum |
|---|---------|-------------|-------|

## ⏸️ Entscheidungs-Findings
### <F>. <Titel>
**Was:** <Beschreibung> · **Wo:** <Datei:Zeile>
**Optionen:** `<F>.1`/`<F>.2`/`<F>.3` (letzte = Akzeptieren (Tech Debt)) + **Empfehlung** mit Begründung

**Auswahl:** Kommentar mit Options-ID antworten
Review-Typ: Fixup-Nachweis
Updated: JJJJ-MM-TT
```

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: commit+push the current state, end the turn.

MENTOR-RAT: if a block between "═══ MENTOR-RAT (VERBINDLICH) ═══" and "═══ ENDE MENTOR-RAT ═══" is present in this prompt, it is BINDING — previous rounds did not converge; follow the mentor's Weg, avoid its Fallen. Deviate only with a justification in your phase note.
