{{RESUME_HINT}}
FOCUS: ONLY issue {{ISSUE_NR}}. Only change the files/lines needed for the acceptance criteria, no incidental refactoring. NO side trips. Save tokens: short, precise, direct.

⚠️ KI-UX block in the issue body (if present): take its UX requirements into account.

Method, modes (spec/direct mode), and rules (binding, not repeated here): .claude/skills/ticket-implementation/SKILL.md — read it before starting.

PROCEDURE (STRICT):
  1. Start IMMEDIATELY.
  2. Read the analysis & quick-check it per SKILL.md step 2 (NO full re-triage;
     AKs from the BODY BLOCK) — traffic light 🔴 → do NOT implement, stop (VERDICT not-ready).
  3. Spec mode (the normal case): check out the existing DRAFT PR — including the closing-keyword trap and
     the idempotency rule (SKILL.md step 1). Turn its RED tests GREEN — do NOT change the tests
     (separation of duties). If a test contradicts the expected behavior → do NOT silently
     change/delete it; instead add a "Test-Pflege-Bedarf" (test maintenance needed) section in the
     PR body with file:line + justification.
  3b. DIRECT MODE (no draft PR exists — the analysis deliberately skipped the spec):
     create the harness branch ai/harness/{{ISSUE_NR}} yourself if it does not exist (git fetch origin ai/harness/{{ISSUE_NR}} && git switch ai/harness/{{ISSUE_NR}} || git switch -c ai/harness/{{ISSUE_NR}}), implement, commit, push, and create the PR YOURSELF
     (gh pr create … Closes #{{ISSUE_NR}} …, NOT --draft). Test obligation for application code:
     SKILL.md step 3a.
  3.5. UI WORK on frontend changes: SKILL.md step 3b/3c.
  4. GATE per SKILL.md step 3c (full local CI gate, every command green BEFORE the push;
     test results in the PR body per AGENTS.md).
  5. Commit + push the branch (phase note .ai-memory/issue-{{ISSUE_NR}}-implement.md in the SAME
     commit — it is tracked, NOT gitignored, the memory travels with the PR, ADR 0007),
     then make the PR review-ready per SKILL.md step 4: spec mode → the existing draft PR
     (gh pr ready <nr>) + extend the description; direct mode → the PR from step 3b (not as a draft).
     In BOTH cases, an open, non-draft PR with commits must exist at the end — the workflow checks
     exactly that before setting ai:needs-review.

⚠️ LABELS: do NOT set labels! The workflow handles that automatically.

VERDICT: exactly ONE line at the very end, ONLY the token — no text after it (the workflow parses the line by machine):
  - VERDICT: needs-review
  - VERDICT: not-ready
  (needs-review = implementation done + PR review-ready;
   not-ready = partial — leave the PR as a draft, needs a follow-up run)

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: commit+push the current state, end the turn.

Idempotency: per SKILL.md step 1.

NO ping comment: the PR + commits are the complete communication. For progress/problems: document in the PR body (draft + justification), not via comments. The traffic-light-🔴 rule from step 2 remains unaffected.
