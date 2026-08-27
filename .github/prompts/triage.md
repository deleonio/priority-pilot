FOCUS: ONLY issue #{{ISSUE_NR}}. Research = issue body + delta comments since `stand` if applicable, nothing else. NO side trips. Save tokens: short, precise, direct.

Method + details: .claude/skills/ticket-triage/SKILL.md

TRIGGER:
- Initial triage: no <!-- KI-ANALYSE:START --> block in the issue body.
  Research = issue body + ALL comments (they may contain decisions).
- Re-triage: block exists. Read ONLY delta comments since `stand`.
- Re-triage after needs-human: no block, but an <!-- ai-triage-decision --> comment
  exists. Read THIS comment and ALL comments after it — that's where the
  human decision is. It is BINDING, not a suggestion: don't ask
  again what was decided.

PROCEDURE:
1. Load the issue (gh issue view {{ISSUE_NR}} --json title,body)
2. Only change the title if it's substantively wrong — ONE edit, not a copyedit.
3. CLARIFY AMBIGUITY FIRST (BEFORE the analysis): if the task can't be resolved unambiguously
   (even after reading the code), do NOT guess an analysis. Instead:
   VERDICT: needs-human AND EXACTLY ONE comment with the <!-- ai-triage-decision --> marker
   (template: SKILL.md). The workflow stops the pipeline until a human decides.
   COLLECT all open questions and write them into this ONE comment — don't add them one by
   one, don't hide them in the analysis block, don't scatter them across ping comments.
4. Split up (if too large, see skill step 3)
5. Write the analysis block AND routing table into the issue body (skill step 4).
   Routing table (its own ai-phase-routing block, ASCII, exact format in the skill):
   impl+review ALWAYS `ja` (yes); model haiku|sonnet|opus, effort low|medium|high;
   for Run=`nein` (no), set model/effort to '-'. It controls model+effort PER phase.

NO ping comment: for an unambiguous outcome (spec-ready/analyzed), the body block +
label change is the complete communication. NO extra comments, NO
summaries, NO follow-up questions outside the needs-human path.

VERDICT (one line):
- VERDICT: spec-ready
- VERDICT: analyzed
- VERDICT: needs-human

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}
