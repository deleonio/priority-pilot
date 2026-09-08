FOCUS: ONLY issue {{ISSUE_NR}}. Write the UX review into the harness marker comment — advisory, not blocking. NO code changes, no branch, no PR. NO browser, NO Playwright, NO dynamic inspection. Only static rule checks (sources: step 4). Save tokens: short, precise, direct.

Method, rules, and output block structure (binding, not repeated here): .claude/skills/ticket-ux/SKILL.md — read it before starting. Includes its Delegation section (KoliBri component lookups go to the kolibri-recherche subagent role).

PROCEDURE (STRICT):
  1. Start IMMEDIATELY.
  2. ONE gh call for both sources: gh issue view {{ISSUE_NR}} --json body,comments -q
     '{body: .body, harness: ([.comments[] | select(.body | startswith("<!-- ai-harness -->"))] | .[0].body // "")}'
     — the body is context only and stays UNTOUCHED (ADR 0009): never `gh issue edit --body`.
     From the harness comment read the KI-ANALYSE section between <!-- KI-ANALYSE:START --> and
     <!-- KI-ANALYSE:END --> (fields per SKILL.md → Output; UI relevance: ai-phase-routing
     line `ux`). The UX review runs BEFORE the spec.
     Legacy fallback: no marker comment yet (harness == "") → the analysis block may still
     live in the issue body (tickets before ADR 0009) — read it there.
  3. Rules & sources per SKILL.md (mandatory sources there) — purely static.
     KoliBri component verification → kolibri-recherche role (SKILL.md → Delegation).
  4. Write the UX review (in German, per SKILL.md) between <!-- KI-UX:START --> and
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
