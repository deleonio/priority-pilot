FOCUS: Optimize ONE design target in the Priority Pilot frontend to shipping quality, end to end
with the Impeccable design skill: audit, adapt, harden, polish — then cleanly close remaining
TODOs and commit the result. You CHANGE code in this run (full tool tier).

The DESIGN_TARGET below is a short natural-language text (workflow dispatch input). Resolve it
yourself to the concrete surface (route, components, CSS) under frontend/ and state that
resolution in one sentence before starting.

Method + details: the Impeccable skill installed at user level (SKILL.md in the skill base
directory the runtime reports; not tracked in this repo). Load it FIRST — it routes to
reference/audit.md, reference/adapt.md, reference/harden.md, reference/polish.md. Project context
lives in frontend/PRODUCT.md and frontend/DESIGN.md (the skill's context helper reads them; if
the helper is unavailable, read those files directly instead and continue).

PROCEDURE (in this order, one bounded pass per phase — no open-ended polish loops):
1. Impeccable setup for the resolved target (skill setup step), then:
2. AUDIT: /impeccable audit <resolved target> — technical quality report (a11y, performance,
   responsive, theming, implementation integrity). Document findings with file locations.
   Do not fix yet.
3. ADAPT: /impeccable adapt — act on the audit findings (responsive/device dimension first).
4. HARDEN: /impeccable harden — production-readiness (errors, edge cases, overflow, states).
5. POLISH: /impeccable polish — final pass; refinement, never redesign.
6. TODO CHECK (mandatory before closing): scan the touched surface for anything the sequence
   opened but did not cleanly close — skipped or red gates, debug leftovers, promised-but-open
   fixes, uncommitted changes. Finish what can be finished now. Anything that genuinely must
   stay open gets one line with reason in a "REMAINING" block right before the result line.
7. GATE before the commit: pnpm format && pnpm lint && pnpm test (repo root) — every command
   green; fix red results before continuing. The frontend e2e suite is NOT part of this gate.
8. COMMIT + PUSH: git add -A && git commit -m "design(frontend): <short slug from the
   DESIGN_TARGET> [impeccable]" && git push. The worktree MUST be clean at the end — the commit
   on the dispatched branch is the complete deliverable.

RULES:
- Refinement, never redesign (impeccable craft floor); KoliBri-first; token discipline
  (--pp-* in frontend/src/app.css, docs/mobile-ui-rules.md is the binding mobile rule set).
- Mobile-first: the 375px reference viewport is the bar for every change.
- Do NOT create issues or PRs and do not open anything label-triggered; the commit is the
  complete communication.
- TIME LIMIT: soft deadline noted below. Before every step: [ $(date +%s) -ge <epoch> ].
  If OVER: commit+push the current state, list what stayed open under REMAINING, end the turn.

RESULT (the very LAST line of your reply):
- DESIGN-RUN: clean
- DESIGN-RUN: remaining
