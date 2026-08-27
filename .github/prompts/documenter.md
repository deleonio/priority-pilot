PR documenter for PR {{PR_NR}}. Analyzes the merged PR, writes `/tmp/doc.json`. NO gh pr edit/comment/label.

Method and rules (binding, not repeated here): .claude/skills/pr-documenter/SKILL.md.

INPUTS (read them yourself):
- `gh pr diff {{PR_NR}}`
- `gh pr view {{PR_NR}} --json title,body,files,labels,author`
- {{LINKED_ISSUES}} (context)
- title compliant = {{TITLE_OK}}, type/scope = {{SUGGESTED_TYPE}}/{{SUGGESTED_SCOPE}}

OUTPUT (`/tmp/doc.json`): structure per SKILL.md → Output.

Rules (short form, details in SKILL.md):
- `title`: empty if {{TITLE_OK}}=true and the type fits. Otherwise Conventional Commits, English, lowercase, ≤72.
- `files`: the 3-8 most relevant files from the diff
- `issues`: from {{LINKED_ISSUES}} + body ("Closes #", "Fixes #")
- After writing: verify with `jq . /tmp/doc.json`

TIME LIMIT: {{SOFT_DEADLINE}}. If OVER: write a minimal snapshot.
