---
name: knowledge-graph
description: >-
  Use when repo documentation is being linked, the knowledge graph needs maintenance, dead links need checking, orphaned documents need finding, or the AGENTS.md index needs updating — also automatically on every change to .ai-knowledge/, docs/, or AGENTS.md, even when not explicitly asked about the graph. Triggers: "knowledge graph", "graph", "Obsidian", "link the docs", "link check", "update index" (German: "Wissensgraph", "Graph", "Obsidian", "verlinke die Doku", "Link-Check", "Index aktualisieren"). Not for code analysis or UI work.
version: 1.0.0
user-invocable: true
argument-hint: "[audit · link · index] [target]"
---

# Knowledge Graph

This repo doubles as an Obsidian vault (repo root). The documentation forms a
knowledge graph: Obsidian's Graph View and backlinks read the same relative Markdown links that
GitHub renders. Your job is to keep this graph consistent — set meaningful edges,
remove dead edges, no islands, an up-to-date index. The graph is a secondary use case: it must
work identically without Obsidian (GitHub, editor, pipeline context).

## Scope

- `.ai-knowledge/**`
- `docs/**` (loose files, `adr/`, `spec/`)
- `AGENTS.md` and `README.md`

Everything else is out of scope: code, workflows, prompts, configuration, the package READMEs
(`server/`, `client/`, `frontend/`), and repo meta files (`CONTRIBUTING.md` etc.). Never touch
Obsidian-internal files (`.obsidian/**`, `*.canvas`, `*.base`) — that is the user's personal
area.

You still check internal links from in-scope files to targets outside the scope (e.g. `server/README.md`)
for existence — a dead link is dead regardless of where it points. But nothing links back
there, and no index is maintained for it.

## Link style

Read [references/link-style.md](references/link-style.md) before any link work. It covers
formats, anchor rules, and anti-patterns with repo examples. In short: relative Markdown links in
the file's existing style, never `[[wiki links]]` (GitHub doesn't render them).

## Mode: incremental (runs automatically alongside other work)

If you edit or newly create a file within scope without this skill having been explicitly
invoked:

1. **New file** → add an entry to the knowledge-base list in `AGENTS.md`. Match the format of
the existing lines: link, dash, a short hook describing what the file provides.
2. **Edited file** → check its links: does every target file still exist? Does the anchor still
match the heading? Fix or remove dead links immediately — a dead link is worse
than no link.
3. **Set real cross-references** → if the change has a topical connection to another
in-scope file, link it at the point where the connection arises. The edge must be
justified by content, not just similar topic.

The incremental mode runs as **a final check** on the actual task — it doesn't replace the
task and doesn't expand it into full audits.

## Mode: `audit`

Full check of the graph. Read all in-scope files, then assess in this order:

1. **Dead links:** for every internal Markdown link (target file + anchor) — does the target exist?
External URLs are not touched.
2. **Islands:** files in scope without a single incoming link from other
in-scope files. `README.md` as the entry point, `docs/spec/issue-*.md` as a
historical ticket archive, and new, not-yet-connected files are **expected islands** —
assess before wiring everything up algorithmically.
3. **Missing edges:** pairs that should reference each other by content but aren't
linked. Only name edges a reader would actually follow.
4. **Index match:** every in-scope file from `.ai-knowledge/` has an entry in the
`AGENTS.md` list — and every list entry points to an existing file.

Then apply the fixes with minimal footprint: correct/remove dead links, add missing edges,
align the index, connect islands only where a real connection exists. End with a compact
report: what you changed and which findings you deliberately **did not** fix (with one sentence
of justification each).

## Mode: `link [target]`

Find cross-references for a specific file or topic: read the file, identify related
in-scope files, set edges at the points where the connection arises in the text. Here too:
only edges with genuine informational value.

## Mode: `index`

Just the `AGENTS.md` reconciliation from the audit (item 4), without link checking.

## Core rules

- **Minimalism:** every line is maintenance burden. An edge exists only if a reader would
follow it to understand something currently relevant in the text. No link spam, no
"see also" collections without concrete cause.
- **Link, don't rewrite:** you add links and index entries — you don't rephrase
paragraphs to force linkability.
- **No style breaks:** relative Markdown links, GitHub anchors, text in the language the target
file already uses. No wiki links, no absolute paths, no frontmatter migration.
- **Preserve what exists:** existing, working links stay as they are, even if a different
wording would be nicer.
- **Reporting duty:** every run ends with a short summary of the changes. A
run without changes ends with "graph consistent" — never conjure up work that wasn't there.
