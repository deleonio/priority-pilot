---
name: pr-documenter
description: "PR documenter — analyze merged PRs and produce the changelog/release-notes JSON (classification, title, summaries, migration). Use for 'dokumentiere PR' (German: document PR), CI phase 6."
---

# Workflow: PR Documenter (after merge)

Use for merged PRs — analyzes the PR and produces the documentation output for the changelog/release notes.

**Selection criterion:** merged PRs passed in by the calling run. No `gh pr edit/comment/label` — only read input and write output.

## Inputs (read them yourself)

- `gh pr diff <pr>` and `gh pr view <pr> --json title,body,files,labels,author`
- Context on the linked issues, the title-compliance flag, and the suggested type/scope from title parsing — all provided by the calling prompt.
- The output write path is likewise given by the calling prompt.

## Classification (exactly one)

- `breaking` — API/contract change, migration needed
- `new` — new feature/component/endpoint
- `improved` — extension, UX, performance (not pure visuals)
- `fixed` — bugfix, error correction
- `internal` — tests/CI/refactoring only, no user impact (when in doubt, **NOT** internal)

## Output (JSON document)

Written to the path given by the calling prompt:

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

- `title`: empty if the existing title is already compliant and the type fits. Otherwise Conventional Commits, English, lowercase, ≤72 characters.
- `files`: the 3-8 most relevant files from the diff.
- `issues`: from the linked-issues context + body ("Closes #", "Fixes #").
- After writing: verify the JSON with `jq`.
