---
name: ticket-ux
description: "Ticket UX — advisory UX review for UI issues (interaction, mobile-first, A11y/BITV, KoliBri) before spec; writes the KI-UX block into the harness marker comment. Use for 'ux-beratung' (German: UX review), CI phase 2."
---

# Workflow: Ticket UX (Advisory review before spec)

Use for UI issues after triage — analyzes from a UX perspective (interaction, mobile-first, A11y/BITV, KoliBri) and writes recommendations into the **harness marker comment** (the ONE comment whose body starts with `<!-- ai-harness -->`, ADR 0009) between `<!-- KI-UX:START -->` and `<!-- KI-UX:END -->`. The issue body stays untouched.

Note: this file's prose is English; the KI-UX block content written into the harness comment stays German — that content is for the project's German-speaking issue authors and reviewers.

Mandatory sources: [docs/mobile-ui-rules.md](../../../docs/mobile-ui-rules.md) for mobile-first/A11y and [ux-design.md](../../../.ai-knowledge/ux-design.md) for the "Cockpit" design language — color roles, scale tokens, component choice.

**Selection criterion:** Issues with the label `ai:needs-ux-ui` (set by the analysis phase) for which **no** UX input yet exists (KI-UX block missing from the harness marker comment). Non-UI issues never get this label.

## Output

KI-UX block inside the harness marker comment between the markers (written in German):

```markdown
<!-- ai-harness -->
<!-- KI-ANALYSE:START … -->
… (analysis, written by triage — keep byte-for-byte) …
<!-- KI-ANALYSE:END -->

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

**Read-modify-write (upsert):** fetch the harness comment, replace ONLY the KI-UX section, keep the KI-ANALYSE section and every other section byte-for-byte. Mechanics (gh only):

1. Node-ID lookup (empty = not created yet — legacy ticket without marker comment: create it with the marker line first and only the KI-UX section inside):
   `HID="$(gh issue view <nr> --json comments --jq '[.comments[] | select(.body | startswith("<!-- ai-harness -->"))] | .[0].id // ""')"`
2. Update: `gh api graphql -f query='mutation($i:ID!,$b:String!){updateIssueComment(input:{id:$i,body:$b}){clientMutationId}}' -f i="$HID" -F b=@-` with a heredoc carrying the FULL comment body (marker line first).
3. Create (no HID yet): `gh issue comment <nr> --body-file -` with the same heredoc.

The `VERDICT:` line does **not** belong in the block — the verdict is reported by the run itself, not written into the comment.

## Characteristics

- **Advisory, not blocking:** UX recommendations are hints, not hard blockers.
- **No code changes:** the prompt explicitly contains NO instructions about branch/PR/code.
- **No separation of duties like spec/implement:** UX is advice, not a contract.
- **Optional:** for non-UI issues (the analysis sets `ai:needs-spec` directly), the UX phase never runs.
- **Fail-safe:** if UX questions remain unclear, don't guess — collect the open questions in the UX block and report the issue as not UX-ready; a human clarifies before the spec.

## Tools

- **KoliBri MCP** (search/fetch): read component documentation to verify component choice.
- **Browser inspection (375px/1280px viewport) via Playwright MCP, LOCAL/on-demand only:**
  in the pipeline this phase runs purely statically (the app is not started) — only the rule
  check against the design system applies there. Dynamic inspection is the implementation
  phase's job.
