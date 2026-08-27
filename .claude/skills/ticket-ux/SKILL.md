---
name: ticket-ux
description: "Ticket UX — advisory UX review for UI issues (interaction, mobile-first, A11y/BITV, KoliBri) before spec; writes the KI-UX block into the issue body. Use for 'ux-beratung' (German: UX review), CI phase 2."
---

# Workflow: Ticket UX (Advisory review before spec)

Use for UI issues after triage — analyzes from a UX perspective (interaction, mobile-first, A11y/BITV, KoliBri) and writes recommendations into the issue body between `<!-- KI-UX:START -->` and `<!-- KI-UX:END -->`.

Note: this file's prose is English; the KI-UX block content written into the issue body stays German — that content is for the project's German-speaking issue authors and reviewers.

Mandatory sources: [docs/mobile-ui-rules.md](../../../docs/mobile-ui-rules.md) for mobile-first/A11y and [ux-design.md](../../../.ai-knowledge/ux-design.md) for the "Cockpit" design language — color roles, scale tokens, component choice.

**Selection criterion:** Issues with the label `ai:needs-ux-ui` (set by the analysis phase) for which **no** UX input yet exists (KI-UX block missing from the body). Non-UI issues never get this label.

## Trigger

- **Automatic:** The `ai:needs-ux-ui` label is set → GitHub Action `02-claude-ux.yml` triggers.
- **Manual:** `workflow_dispatch` with the issue number as input.

## Output

KI-UX block in the issue body between the markers (written in German):

```markdown
<!-- KI-UX:START -->

## UX-Beratung

### Interaktion

[User-Flow, Click-Targets, Feedback]

### Mobile-First

[Breakpoints, Touch-Ziele, responsive Layouts — Maßstab: docs/mobile-ui-rules.md]

### A11y/BITV

[Tastatur-Navigation, Screenreader, ARIA, Kontrast — siehe docs/mobile-ui-rules.md]

### KoliBri

[Component-Wahl, Theme-Integration, BITV-2.1-PS]

### Design-Sprache

[Geltende Rollen-Tokens und Skalen-Stufen — Maßstab: .ai-knowledge/ux-design.md]

### Offene UX-Fragen

[Unklare Punkte, Entscheidungsbedarf]

<!-- KI-UX:END -->
```

The `VERDICT:` line does **not** belong in the block: the workflow parses it from the agent output (`/tmp/claude-output.log`).

## Verification & label setting

- The workflow checks the verdict line in the output.
- On `VERDICT: ux-ready` → set the label `ai:needs-spec` (`ai:needs-ux-ui` is consumed = removed).
- On `VERDICT: ux-not-ready` → set the label `ai:needs-human` (fail-safe) plus a comment (in German) with **why** and **concrete options** (clarify questions + set `ai:needs-ux-ui` again, or manually set `ai:needs-spec` if the blocker is immaterial).

## Characteristics

- **Advisory, not blocking:** UX recommendations are hints, not hard blockers.
- **No code changes:** the prompt explicitly contains NO instructions about branch/PR/code.
- **No separation of duties like spec/implement:** UX is advice, not a contract.
- **Optional:** for non-UI issues (the analysis sets `ai:needs-spec` directly), the UX phase never runs.

## Tools

- **Impeccable design skill** (`.claude/skills/impeccable/`, #828): back the UX review with `/impeccable critique <target-component>` — heuristic scores (Nielsen, 0-4), a cognitive-load check, and persona red flags provide solid evidence.
- **KoliBri MCP** (`mcp__kolibri-mcp__search/fetch`): read component documentation to verify component choice.
- **Browser inspection (375px/1280px viewport) via Playwright MCP, LOCAL/on-demand only** (#823). **In CI this phase runs purely statically:** `02-claude-ux.yml` doesn't start the app — only the rule check against the design system applies there. Dynamic inspection is the implementation phase's job.

## Model

- Default: `vars.CLAUDE_MODEL_SPEC` (default: `sonnet`)
- Provider via `vars.LLM_PROVIDER` (zai|claude)
