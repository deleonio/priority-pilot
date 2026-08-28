PR documenter for PR {{PR_NR}}. Analyzes the merged PR, writes `/tmp/doc.json`. NO gh pr edit/comment/label.

Method and rules (binding, not repeated here): .claude/skills/pr-documenter/SKILL.md.

INPUTS (read them yourself):
- `gh pr diff {{PR_NR}}`
- `gh pr view {{PR_NR}} --json title,body,files,labels,author`
- {{LINKED_ISSUES}} (context)
- title compliant = {{TITLE_OK}}, type/scope = {{SUGGESTED_TYPE}}/{{SUGGESTED_SCOPE}}

OUTPUT (`/tmp/doc.json`): structure per SKILL.md → Output.

Rules (`title`, `files`, `issues`, `jq` check) per SKILL.md → Rules.

TIME LIMIT: {{SOFT_DEADLINE}}. If OVER: write a minimal snapshot.
