{{RESUME_HINT}}
FOCUS: ONLY issue {{ISSUE_NR}}. Only change the files/lines needed for the acceptance criteria, no incidental refactoring. NO side trips. Save tokens: short, precise, direct.

⚠️ KI-UX block: if the issue has UX aspects (a KI-UX:END block present in the issue body), take the UX requirements from that block into account.

Method, modes (spec/direct mode), and rules (binding, not repeated here): .claude/skills/ticket-implementation/SKILL.md — read it before starting.

PROCEDURE (STRICT):
  1. Start IMMEDIATELY.
  2. Read the analysis & quickly verify it (NO full re-triage!):
     take the acceptance criteria from the BODY BLOCK (gh issue view {{ISSUE_NR}} --json body -q .body).
     Check ONLY whether the named files still exist. Traffic light 🔴 → do NOT implement, comment with a justification and stop (VERDICT not-ready).
  3. Spec mode (the normal case): check out the existing DRAFT PR — including the closing-keyword trap and
     the idempotency rule (SKILL.md step 1). Turn its RED tests GREEN — do NOT change the tests
     (separation of duties). If a test contradicts the expected behavior → do NOT silently
     change/delete it; instead add a "Test-Pflege-Bedarf" (test maintenance needed) section in the
     PR body with file:line + justification.
  3b. DIRECT MODE (no draft PR exists — the analysis deliberately skipped the spec):
     create the branch yourself, implement, commit, push, and create the PR YOURSELF
     (gh pr create … Closes #{{ISSUE_NR}} …, NOT --draft). Test obligation for application code:
     SKILL.md step 3a.
  3.5. UI WORK on frontend changes: SKILL.md step 3b/3c (KoliBri-first incl.
     the mandatory justification in the PR body, deterministic tools first — Impeccable detector
     + mobile-ui-rules.md —, Playwright MCP only for the short 375/1280 layout-break check).
  4. GATE — run it in full, every command green, BEFORE the push:
     pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip && pnpm test
     The tests SHOULD pass here (they are the contract from the spec phase and the primary
     success indicator) — red means fix it, not pass it on.
     Put the commands' results in the PR body (AGENTS.md requirement: document format/lint/test results).
     e2e (pnpm --filter frontend test:e2e) ONLY if the change affects UI behavior and an
     e2e spec exists for it — otherwise skip and note it in the PR body.
  5. Commit, push the branch. In spec mode, make the existing draft PR review-ready
     (gh pr ready <nr>), extend the description. In direct mode, create the PR from step 3b
     (not as a draft). In BOTH cases, an open, non-draft PR with commits must exist at the
     end — the workflow checks exactly that before setting ai:needs-review.

⚠️ LABELS: do NOT set labels! The workflow handles that automatically.

VERDICT: exactly ONE line at the very end, ONLY the token — no text after it (the workflow parses the line by machine):
  - VERDICT: needs-review
  - VERDICT: not-ready
  (needs-review = implementation done + PR review-ready;
   not-ready = partial — leave the PR as a draft, needs a follow-up run)

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: commit+push the current state, end the turn.

Idempotency: a draft PR with Closes #{{ISSUE_NR}} is the normal spec handoff — pick it up. A non-draft PR = implementation already ran → end the run.

NO ping comment: the PR + commits are the complete communication. For progress/problems: document in the PR body (draft + justification), not via comments. The traffic-light-🔴 rule from step 2 remains unaffected.
