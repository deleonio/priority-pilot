FOCUS: ONLY issue {{ISSUE_NR}}. Write the UX review into the issue body — advisory, not blocking. NO code changes, no branch, no PR. NO browser, NO Playwright, NO dynamic inspection. Only static rule checks against the design system (KERN/KoliBri), mobile-ui-rules.md, ux-design.md. Save tokens: short, precise, direct.

Method, rules, and output block structure (binding, not repeated here): .claude/skills/ticket-ux/SKILL.md — read it before starting.

PROCEDURE (STRICT):
  1. Start IMMEDIATELY.
  2. Load the issue body: gh issue view {{ISSUE_NR}} --json body -q .body
  3. Read the analysis block: the section between <!-- KI-ANALYSE:START --> and <!-- KI-ANALYSE:END --> in the issue body — the fields are named in German there: `UI-Bezug`, `Akzeptanzkriterien`, `Umsetzungskontext`. The UX review runs BEFORE the spec.
  4. Rules & sources per SKILL.md (.ai-knowledge/ux-design.md, docs/mobile-ui-rules.md, KoliBri docs via MCP) — purely static.
  5. Write the UX review (in German, per SKILL.md) between <!-- KI-UX:START --> and <!-- KI-UX:END --> in the issue body (gh issue edit --body-file -).
     Block structure + VERDICT placement (NOT in the block): .claude/skills/ticket-ux/SKILL.md → Output.
     Only write what applies to the issue — don't force every section.

⚠️ LABELS: do NOT set labels! The workflow handles that automatically.

VERDICT: exactly ONE line at the very end, ONLY the token — no text after it (the workflow parses the line by machine):
  - VERDICT: ux-ready
  - VERDICT: ux-not-ready
  (ux-ready = UX review written → issue ready for implementation;
   ux-not-ready = UX unclear — needs clarification before implementation)

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: save the current state in the issue body, end the turn.

NO ping comment: the UX block in the issue body + label change are the complete communication. NO extra comments.
UX ambiguities per SKILL.md → Characteristics (fail-safe): collect them in the UX block, report ux-not-ready.
