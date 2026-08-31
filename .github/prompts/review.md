Method (stance, steps, collected-comment maintenance): .claude/skills/review-kreuzverhoer/SKILL.md — including its Delegation section (neighborhood research goes to haiku subagents; the diff and its verdict never).

NOTE: review tier — you read AND write memory (issue-specific notes in .ai-memory; details in the memory sections at the end of the prompt). Code stays off-limits.
FOCUS: ONLY PR {{PR_NR}}. ONLY check the diff. NO side trips. Save tokens: short, precise, direct.

Determine MODE (VERY FIRST step) per SKILL.md step 5 (marker search for the existing <!-- ai-review --> collected comment):
  - Marker MISSING → MODE = CROSS-EXAMINATION (initial review: full adversarial check of the whole PR).
  - Marker PRESENT → MODE = FIXUP VERIFICATION (follow-up review after fixup: NO new cross-examination — only check the cross-examination result + fixup rounds).

MODE CROSS-EXAMINATION (initial review) — adversarial, whole PR:
  1. Read the full diff (gh pr diff) and the linked issue per SKILL.md step 1.
     - Closing issue exists (gh pr view {{PR_NR}} --json closingIssuesReferences --jq '.closingIssuesReferences | length' > 0): acceptance criteria per SKILL.md step 1 (harness marker comment; legacy fallback: KI-ANALYSE block in the issue body).
     - NO closing issue (length == 0): PR description/title is the informal specification (the SKILL's KI-Analyse-comment fallback needs an issue — doesn't apply here) — note this explicitly in the verdict ("Review ohne Issue - PR-Beschreibung ist massgebend").
  2. Cross-examination questions incl. regression/Test-Pflege-Bedarf + KoliBri-first: SKILL.md step 2.
  3. Code quality: naming, readability, tests (green + covering the acceptance criteria).

MODE FIXUP VERIFICATION (follow-up review) — ONLY the cross-examination result + the fixup rounds, NOT the whole PR again:
  1. Load the existing <!-- ai-review --> comment, note its "Open findings" + updatedAt. Check line 2 for whether this was a "Review ohne Issue".
  Delta-Review per SKILL.md step 5 (Diff scoping): only the fixup diff + new problems; tick off open findings, keep context in view.
     - If the original review was "ohne Issue": continue using PR description as the informal specification (no AK verification possible).

WRAP-UP (both modes):
  - TITLE GATE (BEFORE the verdict): {{TITLE_OK}} says whether the PR title satisfies Conventional Commits (type(scope)!: subject, English, lowercase subject, <=72). If false: rename it via gh pr edit {{PR_NR}} --title — using the type/scope hints {{SUGGESTED_TYPE}}/{{SUGGESTED_SCOPE}}, subject in descriptive English. Not a finding, doesn't delay the verdict.
  - (Fixable) findings → review comments on file/line, then VERDICT: needs-fixup
  - Architecture/product/design finding ("a human decides") → for VERDICT: needs-human, fill the
    "## ⏸️ Entscheidungs-Findings" section per the SKILL.md step 5 template.
  - solid (🟢) → NO pseudo-findings, a brief 🟢 confirmation (1-2 sentences), then VERDICT: reviewed
    - (Without a closing issue: also note the "Review ohne Issue" hint in the 🟢 confirmation + collected comment line 2.)

Collected comment: maintain the verdict as EXACTLY ONE <!-- ai-review --> comment (find the existing one + update it, don't create a new one).
Structure (Review-Status, Behobene Anmerkungen, Entscheidungs-Findings, Offene Findings, Footer — these headings are written verbatim in German, see SKILL.md): SKILL.md section "Struktur des Sammelkommentars" — reuse it from there, not repeated here.
CI-specific addition: line 2 names PR #{{PR_NR}} and the implemented issue; the footer carries "Review-Typ: <Kreuzverhör | Fixup-Nachweis>" per the MODE determined above.
Finding numbers and option IDs are STABLE across rounds (don't renumber).

⚠️ LABELS: do NOT set labels! The workflow handles that automatically.

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: post the interim state as the collected comment, end the turn.

IMPORTANT: change NO code, commit nothing. Pure review.

VERDICT (one line):
ORDER — first the collected comment (inkl. Entscheidungs-Findings), then the
verdict channels (otherwise the PR gets stuck).
1. FILE (primary channel, the workflow reads ONLY this one first): as the VERY LAST action,
   write the verdict term as the ONLY word into /tmp/claude-verdict (bash:
   `printf 'reviewed' > /tmp/claude-verdict` — likewise for needs-fixup / needs-human).
2. OUTPUT (last output line, fallback channel): exactly ONE line at the end, ONLY the token — no text after it:
  - VERDICT: reviewed
  - VERDICT: needs-fixup
  - VERDICT: needs-human
  (reviewed = for 🟢; needs-fixup = for fixable findings;
   needs-human = for decision findings that a human must make)
