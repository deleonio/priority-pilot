---
name: pr-documenter
description: "PR documenter — analyze merged PRs and document them as /tmp/doc.json for the changelog/release notes (classification, title, summaries, migration). Use for 'dokumentiere PR' (German: document PR), CI phase 6."
---

# Workflow: PR Documenter (after merge)

Use for merged PRs — analyzes the PR and writes documentation output (`/tmp/doc.json`) for the changelog/release notes.

**Selection criterion:** merged PRs that the workflow passes in via `{{PR_NR}}`. No `gh pr edit/comment/label` — only write output.

## Inputs (read them yourself)

- `gh pr diff {{PR_NR}}`
- `gh pr view {{PR_NR}} --json title,body,files,labels,author`
- `{{LINKED_ISSUES}}` (context on linked issues)
- `{{TITLE_OK}}` — is the title already compliant?
- `{{SUGGESTED_TYPE}}` — suggested type from title parsing
- `{{SUGGESTED_SCOPE}}` — suggested scope from title parsing

## Classification (exactly one)

- `breaking` — API/contract change, migration needed
- `new` — new feature/component/endpoint
- `improved` — extension, UX, performance (not pure visuals)
- `fixed` — bugfix, error correction
- `internal` — tests/CI/refactoring only, no user impact (when in doubt, **NOT** internal)

## Output (`/tmp/doc.json`)

```json
{
  "classification": "breaking|new|improved|fixed|internal",
  "title": "empty or new title (Conventional Commits, English, lowercase, ≤72)",
  "title_reason": "one sentence why it was renamed (only if title is set)",
  "summary_en": "3-5 sentences: files/components, core technical change",
  "summary_de": "the same statement in German",
  "release_note_en": "2-4 sentences: what can end users do now? (for internal: one sentence on why no note is needed)",
  "migration_en": "only for breaking, otherwise empty",
  "files": [{"path": "path", "note_de": "one sentence in German: what changed"}],
  "issues": [{"ref": "Closes #692", "note": "short description"}]
}
```

## Rules

- `title`: empty if `{{TITLE_OK}}`=`true` and the type fits. Otherwise Conventional Commits, English, lowercase, ≤72 characters.
- `files`: the 3-8 most relevant files from the diff.
- `issues`: from `{{LINKED_ISSUES}}` + body ("Closes #", "Fixes #").
- After writing: verify with `jq . /tmp/doc.json`.

## Time limit

`{{SOFT_DEADLINE}}`. On timeout: write a minimal snapshot (not a completely empty JSON).
