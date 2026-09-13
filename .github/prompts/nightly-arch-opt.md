FOCUS: Find exactly ONE architecture optimization in this repository that measurably improves stability or maintainability. Read-only analysis. NO repo changes, NO issue creation — the workflow turns your output into the ticket. Save tokens: short, precise, direct.

Method + details: .claude/skills/nightly-arch-opt/SKILL.md

PROCEDURE:
1. Scan for the skill's search areas using the Grep/Glob/Read tools — broad reads delegated to the `recherche` subagent role (SKILL.md step 1, ADR 0008), findings only in your context. Bash `find`/`grep` are NOT permitted in this tier — use the tools, not shell commands.
2. Weigh candidates against stability AND maintainability; pick the single most valuable one. Prefer pattern breaks spanning multiple files.
3. Do NOT propose anything already listed under "Bekannte offene Optimierungs-Issues" below.
4. Output the result block in EXACTLY the skill's format: ASCII field names, one marker per line, German content in the ticket fields. Concrete and observable wording — vague tickets get rejected by the pipeline's quality gate.
5. `FOUND: false` is a valid, honest result if nothing valuable turns up. Don't force a finding.

RESULT (the very LAST line of your reply):
- FOUND: true
- FOUND: false

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: output the best candidate found so far as the result block, end the turn.
