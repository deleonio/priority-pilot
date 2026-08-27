# Link Style (Knowledge Graph)

Mandatory formats for all edges within the skill's scope. The style follows the
existing conventions in `.ai-knowledge/` — don't change anything there, only continue it.

## Basic rule

Relative Markdown links in GitHub syntax. Obsidian builds Graph View and backlinks from exactly
these links — the same edge works in both worlds. Wiki links are forbidden because GitHub
doesn't render them.

## Formats with repo examples

Within a single folder (e.g. `.ai-knowledge/` → `.ai-knowledge/`):

```markdown
- Ticket-Ablauf: [Ticket-Umsetzung](ticket-implementation.md), Regeln: [Projekt-Konventionen](project.md#konventionen)
- Testumfang: [TDD-Strategie → Testumfang](tdd-strategy.md#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich)
```

Between folders (e.g. `.ai-knowledge/` → `docs/`):

```markdown
- Begründung in [ADR 0001](../docs/adr/0001-github-workflows-bleiben-ungetestet.md)
- Konzept: [Testing](../docs/testing.md#4-abgrenzung)
```

From `AGENTS.md`/`README.md` (repo root) into a subfolder — path with folder:

```markdown
- [TDD-Strategie](.ai-knowledge/tdd-strategy.md) — test-getriebene KI-Workflows (Stufen 1+2+3 adoptiert)
```

(These examples are quoted verbatim from the still-German `.ai-knowledge/` content — keep them as-is.)

## Anchor rules

Anchors are GitHub's auto-generated ID of the target heading: lowercased, spaces →
hyphens, punctuation other than hyphens removed, umlauts preserved. Repeated
hyphens don't collapse (`nötig-so` → `--so`).

- Heading `## Testumfang — so viel wie nötig, so wenig wie irgend möglich`
- Anchor `#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich`

Before setting an anchor, read the target file and derive the anchor from the actual
heading — don't guess.

## Index entry in `AGENTS.md`

One line per `.ai-knowledge/` file in the knowledge-base list (excerpt):

```markdown
- [Projekt & Aufbau](.ai-knowledge/project.md) — Zweck, Monorepo, Befehle, Datenbank
```

Dash with two spaces on each side, then a hook of 3–8 words saying what the
file provides — not what it's called.

## Anti-patterns

- `[[Wiki-Links]]` — GitHub doesn't render them, the graph loses the GitHub side.
- Absolute paths (`/docs/…`) and URL-style repo paths — they break on a local clone.
- Line-number anchors (`file.md#L42`) — break on every change to the target file.
- Links inside code blocks and inline code: ignore them when checking, never place one there.
- External URLs (github.com, …): not part of the internal graph; don't check them during audit.
- "See also" lists at the end of a file as a dumping ground for edges — an edge belongs at
  the point in the text where the connection arises, otherwise it has no informational value.
