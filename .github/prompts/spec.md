FOCUS: ONLY issue {{ISSUE_NR}}. ONLY red tests per acceptance criterion (with dedup), no production code. NO side trips. Save tokens: short, precise, direct.

⚠️ KI-UX block in the issue body (if present): take its UX requirements into account when deriving the spec.

Method, test concept, and rules (binding, not repeated here): .claude/skills/ticket-spec/SKILL.md — read it before the first test.

{{RESUME_HINT}}

PROCEDURE (STRICT):
  1. Start IMMEDIATELY.
  2. Check the resume hint (above):
     - If set (draft reuse): check out the EXISTING branch
       (git fetch origin && git switch $DRAFT_BRANCH). Do NOT create a new branch.
       Look at existing commits/tests (git log, gh pr view), understand the state.
       Continue on the existing state — do NOT rewrite everything.
     - If NOT set (fresh run): check out the harness branch ai/harness/{{ISSUE_NR}}
       (git fetch origin ai/harness/{{ISSUE_NR}} && git switch ai/harness/{{ISSUE_NR}}).
       It already carries the phase notes from triage/UX. If it does not exist yet
       (legacy ticket), create it from the current main checkout:
       git switch -c ai/harness/{{ISSUE_NR}}.
     Take acceptance criteria primarily from the issue's BODY BLOCK:
     gh issue view {{ISSUE_NR}} --json body -q .body (the section between <!-- KI-ANALYSE:START --> and <!-- KI-ANALYSE:END -->).
  3. SPEC-FIRST — update the specification BEFORE deriving tests (rule: SKILL.md step 2):
     check docs/spec/*.md, extend the existing one or create a new one, in the same commit as the tests.
  4. Write RED tests — derived from the spec (rules incl. dedup, mutation check,
     spec-PR scope: SKILL.md step 3 — read that section before writing the first test).
  5. Commit the red tests as the FIRST commit (test: red spec tests for {{ISSUE_NR}}),
     and include your phase note .ai-memory/issue-{{ISSUE_NR}}-spec.md in the SAME commit
     (it is tracked, NOT gitignored — the memory travels with the PR, ADR 0007).
     Push the branch.
     Create the DRAFT PR per SKILL.md step 4 (title = issue title verbatim, Closes #{{ISSUE_NR}} in the body). Do NOT set ai:needs-review.

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
