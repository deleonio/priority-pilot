FOCUS: ONLY issue #{{ISSUE_NR}}. Research = issue body + delta comments since `stand` if applicable, nothing else. NO side trips. Save tokens: short, precise, direct.

Method + details: .claude/skills/ticket-triage/SKILL.md

TRIGGER:
- Initial triage: no harness marker comment on the issue (no comment whose body
  STARTS with `<!-- ai-harness -->`). Research = issue body + ALL comments (they may
  contain decisions).
- Re-triage: marker comment exists. Its KI-ANALYSE block carries `stand=` — read ONLY
  the delta comments since `stand`, and SKIP the harness comment itself.
- Re-triage after needs-human: no marker comment, but an <!-- ai-triage-decision --> comment
  exists. Read THIS comment and ALL comments after it — that's where the
  human decision is. It is BINDING, not a suggestion: don't ask
  again what was decided.

PROCEDURE:
1. Load the issue (gh issue view {{ISSUE_NR}} --json title,body)
2. Only change the title if it's substantively wrong — ONE edit, not a copyedit.
   NEVER `gh issue edit --body` — ADR 0009, re-triggers the issue validator; details SKILL.md step 2.
3. CLARIFY AMBIGUITY FIRST (BEFORE the analysis): if the task can't be resolved unambiguously
   (even after reading the code), do NOT guess an analysis. Instead:
   VERDICT: needs-human AND EXACTLY ONE comment with the <!-- ai-triage-decision --> marker
   (template: SKILL.md). The workflow stops the pipeline until a human decides.
   COLLECT all open questions and write them into this ONE comment — don't add them one by
   one, don't hide them in the analysis block, don't scatter them across ping comments.
4. Split up (if too large, see skill step 3)
5. Write the analysis block AND routing table into the ONE harness marker comment — values
   and format per SKILL.md step 4. The comment body STARTS with the marker
   line `<!-- ai-harness -->`; read-modify-write: replace ONLY the KI-ANALYSE +
   ai-phase-routing sections, keep foreign sections (e.g. KI-UX) byte-for-byte.
   `stand` resets on every write. gh-only mechanics (restricted tier; HID lookup,
   update vs. create): SKILL.md step 4. CI delta: heredoc lines start at column 0,
   the EOF terminator must too.

NO ping comment: for an unambiguous outcome (spec-ready/analyzed), the harness comment +
label change is the complete communication. NO extra comments, NO
summaries, NO follow-up questions outside the needs-human path.

VERDICT (one line):
- VERDICT: spec-ready
- VERDICT: analyzed
- VERDICT: needs-human

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}
