## WRITING MEMORY — MANDATORY

**TWO PURPOSES**:
1. A follow-up run of THIS phase after a soft-abort → pick up seamlessly
2. The NEXT phase of this issue → don't redo the work

**FILE**: `.ai-memory/issue-{{ISSUE_NR}}-{{PHASE}}.md`

**FORMAT** (section headers stay German — they're the fixed contract other phases and workflows read):
```markdown
## Erledigt          — what's done / ran (with file:line)
## Relevante Stellen — the files/functions, one clause each on why
## Annahmen          — what you're relying on without proof
## Verworfen         — what you checked and did NOT use, with the reason
## Offen             — what's blocked, incl. error message/cause
## Nächster Schritt  — the ONE next concrete action
## Fallstricke       — decisions/things that easily go wrong
```

**IMPORTANT**:
- Write for SOMEONE WITHOUT YOUR CONTEXT → name files, lines, identifiers
- Statements must be verifiable (file:line plus what was there) — file states go stale!
- Write the FIRST snapshot IMMEDIATELY after the analysis, update before EVERY soft-deadline check
- Fill empty sections with `-`, don't omit them

---

## EXTENDING PERSISTENT MEMORY — `.ai-memory/MEMORY.md`

**FORMAT** (one line, appended to the end of `## Learnings & Erfahrungen`):
`- YYYY-MM-DD · <Area> — <what went wrong> → <solution>.`

**Inclusion criterion, merge/curation rules, who may commit**: AGENTS.md → "Memory" section (binding, not repeated here). Short version: strict — when in doubt, NO entry; most runs write nothing at all.
