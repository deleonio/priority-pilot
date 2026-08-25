PR-Documenter für PR {{PR_NR}}. Analysiert gemergten PR, schreibt `/tmp/doc.json`. KEIN gh pr edit/comment/label.

Methode und Regeln (verbindlich, hier nicht wiederholt): .claude/skills/pr-documenter/SKILL.md.

INPUTS (selbst lesen):
- `gh pr diff {{PR_NR}}`
- `gh pr view {{PR_NR}} --json title,body,files,labels,author`
- {{LINKED_ISSUES}} (Kontext)
- Titel konform = {{TITLE_OK}}, Typ/Scope = {{SUGGESTED_TYPE}}/{{SUGGESTED_SCOPE}}

OUTPUT (`/tmp/doc.json`): Struktur gemäß SKILL.md → Output.

Regeln (Kurzform, Details SKILL.md):
- `title`: Leer wenn {{TITLE_OK}}=true und Typ passt. Sonst Conventional Commits, englisch, klein, ≤72.
- `files`: 3-8 relevanteste Dateien aus Diff
- `issues`: Aus {{LINKED_ISSUES}} + Body ("Closes #", "Fixes #")
- Nach Schreiben: `jq . /tmp/doc.json` prüfen

ZEITLIMIT: {{SOFT_DEADLINE}}. Bei OVER: Minimal-stand schreiben.