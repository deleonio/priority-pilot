FOCUS: ONLY issue {{ISSUE_NR}}. ONLY red tests per acceptance criterion (with dedup), no production code. NO side trips. Save tokens: short, precise, direct.

⚠️ KI-UX block in the issue body (if present): take its UX requirements into account when deriving the spec.

Method, test concept, and rules (binding, not repeated here): .claude/skills/ticket-spec/SKILL.md — read it before the first test.

{{RESUME_HINT}}

PROCEDURE (STRICT):
  1. Start IMMEDIATELY.
  2. Branch + AK: SKILL.md step 1 (harness branch ai/harness/{{ISSUE_NR}}; AKs from the issue's
     BODY BLOCK: gh issue view {{ISSUE_NR}} --json body -q .body).
     Resume hint set (draft reuse) → check out the EXISTING branch
     (git fetch origin && git switch $DRAFT_BRANCH) and continue on its state — do NOT rewrite everything.
  3. SPEC-FIRST per SKILL.md step 2 (spec update in the SAME commit as the tests).
  4. Write RED tests — derived from the spec (rules incl. dedup, mutation check,
     spec-PR scope: SKILL.md step 3 — read that section before writing the first test).
  5. Commit/push/draft PR per SKILL.md step 4. Do NOT set ai:needs-review.
     Additionally in the SAME commit: your phase note .ai-memory/issue-{{ISSUE_NR}}-spec.md
     (it is tracked, NOT gitignored — the memory travels with the PR, ADR 0007).

⚠️ LABELS: do NOT set labels! The workflow handles that automatically.

VERDICT: exactly ONE line at the very end, ONLY the token — no text after it (the workflow parses the line by machine):
  - VERDICT: ready
  - VERDICT: spec-partial
  (ready = red tests written + draft PR created → releases the issue for implementation;
   spec-partial = partial — tests incomplete, needs a follow-up run)

HONESTY RULE: output VERDICT: ready ONLY if the draft PR actually exists AND at least one test file has been committed+pushed (verify first with gh pr view/git log).

NO ping comment: the draft PR + tests are the complete communication. NO extra comments on the issue or PR.
Ambiguous acceptance criteria are NOT a reason to guess: if an acceptance criterion can't be phrased testably, skip the test with a matching reason and collect it in the PR body under "Offene Fragen" (open questions) — don't scatter it across comments.

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: commit+push the current state as a draft PR, end the turn.
