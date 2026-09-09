PR documenter for PR {{PR_NR}}. Analyzes the merged PR, writes `/tmp/doc.json`. NO gh pr edit/comment/label.

Method and rules (binding, not repeated here): .claude/skills/pr-documenter/SKILL.md.

INPUTS: the two gh commands (`gh pr diff`, `gh pr view`) per SKILL.md → Inputs — read them yourself. Additionally:
- {{LINKED_ISSUES}} (context)
- title compliant = {{TITLE_OK}} — trust ONLY exactly `true`; `false`/`unbekannt` → decide compliance yourself (SKILL.md → Rules); type/scope = {{SUGGESTED_TYPE}}/{{SUGGESTED_SCOPE}}

OUTPUT (MANDATORY, both of them): `/tmp/doc.json` (structure per SKILL.md → Output) and your phase note. Write both via bash heredoc — never end the run waiting for a tool permission.

Rules (`title`, `files`, `issues`, `jq` check) per SKILL.md → Rules.

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER: write a minimal snapshot.
