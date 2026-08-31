FOCUS: ONLY issue {{ISSUE_NR}}. Write the UX review into the harness marker comment — advisory, not blocking. NO code changes, no branch, no PR. NO browser, NO Playwright, NO dynamic inspection. Only static rule checks against the design system (KERN/KoliBri), mobile-ui-rules.md, ux-design.md. Save tokens: short, precise, direct.

Method, rules, and output block structure (binding, not repeated here): .claude/skills/ticket-ux/SKILL.md — read it before starting.

PROCEDURE (STRICT):
  1. Start IMMEDIATELY.
  2. Load the issue body (gh issue view {{ISSUE_NR}} --json body -q .body) — context only.
     The validated description stays UNTOUCHED (ADR 0009): never `gh issue edit --body`.
  3. Read the analysis from the harness marker comment — the comment whose body starts with
     `<!-- ai-harness -->`; the KI-ANALYSE section between <!-- KI-ANALYSE:START --> and
     <!-- KI-ANALYSE:END --> (fields per SKILL.md → Output; UI relevance: ai-phase-routing
     line `ux`). The UX review runs BEFORE the spec.
     Legacy fallback: no marker comment yet → the analysis block may still live in the
     issue body (tickets before ADR 0009) — read it there.
  4. Rules & sources per SKILL.md (.ai-knowledge/ux-design.md, docs/mobile-ui-rules.md, KoliBri docs via MCP) — purely static.
  5. Write the UX review (in German, per SKILL.md) between <!-- KI-UX:START --> and
     <!-- KI-UX:END --> INSIDE the harness marker comment (mechanics per SKILL.md → Output).
     CI delta: heredoc lines start at column 0, the EOF terminator must too.
     Only write what applies to the issue — don't force every section.

⚠️ LABELS: do NOT set labels! The workflow handles that automatically.

VERDICT (one line):
  - VERDICT: ux-ready
  - VERDICT: ux-not-ready
  (ux-ready = UX review written → issue ready for implementation;
   ux-not-ready = UX unclear — needs clarification before implementation)

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: save the current state in the harness marker comment, end the turn.

NO ping comment: the KI-UX block in the harness marker comment is the complete communication. NO extra comments.
UX ambiguities per SKILL.md → Characteristics (fail-safe): collect them in the KI-UX block, report ux-not-ready.
