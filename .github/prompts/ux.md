FOCUS: ONLY issue {{ISSUE_NR}}. Write the UX review into the issue body — advisory, not blocking. NO code changes, no branch, no PR. NO browser, NO Playwright, NO dynamic inspection. Only static rule checks against the design system (KERN/KoliBri), mobile-ui-rules.md, ux-design.md. Save tokens: short, precise, direct.

Method, rules, and output block structure (binding, not repeated here): .claude/skills/ticket-ux/SKILL.md — read it before starting.

PROCEDURE (STRICT):
  1. Start IMMEDIATELY.
  2. Load the issue body: gh issue view {{ISSUE_NR}} --json body -q .body
  3. Read the analysis block: the section between <!-- KI-ANALYSE:START --> and <!-- KI-ANALYSE:END --> in the issue body — the fields are named in German there: `UI-Bezug`, `Akzeptanzkriterien`, `Umsetzungskontext`. The UX review runs BEFORE the spec.
  4. Read the design-system rules (locally, no browser calls):
     - .ai-knowledge/ux-design.md — what it looks like: color roles, scale tokens, component choice (KoliBri first)
     - docs/mobile-ui-rules.md — how it's operated: mobile-first, touch zones (≥44px), thumb reach, async states, anti-patterns
     - KoliBri components via mcp__kolibri-mcp__search/fetch — read DOCUMENTATION only (properties, variants, A11y notes), NO live check
  5. Write the UX review (in German, per SKILL.md) between <!-- KI-UX:START --> and <!-- KI-UX:END --> in the issue body (gh issue edit --body-file -).
     Block structure (sections + standards): .claude/skills/ticket-ux/SKILL.md → Output. Only write what applies to the issue — don't force every section.
     The VERDICT line does NOT belong in the block; it goes at the end of your output (see below).

⚠️ LABELS: do NOT set labels! The workflow handles that automatically.

VERDICT: exactly ONE line at the very end, ONLY the token — no text after it (the workflow parses the line by machine):
  - VERDICT: ux-ready
  - VERDICT: ux-not-ready
  (ux-ready = UX review written → issue ready for implementation;
   ux-not-ready = UX unclear — needs clarification before implementation)

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: save the current state in the issue body, end the turn.

NO ping comment: the UX block in the issue body + label change are the complete communication. NO extra comments.
For UX ambiguities: collect all open questions as ux-not-ready (in the UX block) — a human clarifies before the spec, not via individual comments.
