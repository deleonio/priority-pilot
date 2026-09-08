FOCUS: Optimize ONE design target in the Priority Pilot frontend to shipping quality, end to end
with the Impeccable design skill: audit, adapt, harden, polish — then cleanly close remaining
TODOs and deliver the result as a regular PR with a fully traceable description. You CHANGE code in
this run (full tool tier).

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
   responsive, theming, implementation integrity). Document findings with file locations and
   severity; you need them verbatim for the PR description. Do not fix yet.
3. ADAPT: /impeccable adapt — act on the audit findings (responsive/device dimension first).
4. HARDEN: /impeccable harden — production-readiness (errors, edge cases, overflow, states).
5. POLISH: /impeccable polish — final pass; refinement, never redesign.
6. TODO CHECK (mandatory before closing): scan the touched surface for anything the sequence
   opened but did not cleanly close — skipped or red gates, debug leftovers, promised-but-open
   fixes, uncommitted changes. Finish what can be finished now. Anything that genuinely must
   stay open gets one line with reason in the PR's "Offene Punkte" section.
7. GATE before the commit: pnpm format && pnpm lint && pnpm test (repo root) — every command
   green; fix red results before continuing. The frontend e2e suite is NOT part of this gate.
8. BRANCH + COMMIT + PUSH: create the delivery branch with the EXACT name given under "RUN
   CONTEXT" below (git checkout -b), commit ALL changes
   (git add -A && git commit -m "design(frontend): <short slug from the DESIGN_TARGET>
   [impeccable]") and push it with git push -u origin HEAD.
9. PR: create it with gh pr create --base <BASE_REF from RUN CONTEXT> --head
   <branch> — title "design(frontend): <short slug>", body per the mandatory skeleton below
   (write it to a temp file, pass via --body-file). The PR is the complete deliverable and its
   description is the audit trail — every change must be traceable to an audit finding or an
   explicit decision. The worktree MUST be clean at the end.

PR BODY SKELETON (German, fill every section; omit nothing, no placeholders left):
  ## Design-Ziel
  <DESIGN_TARGET + one sentence how it was resolved to the concrete surface>
  ## Audit-Ausgangslage
  <impeccable audit score per dimension + the findings this run addressed, each with file
  locations and severity>
  ## Änderungen
  ### Adapt (responsiv)
  <what changed, which findings it closes — file paths>
  ### Harden
  <what changed — file paths>
  ### Polish
  <what changed — file paths>
  ## Offene Punkte
  <each deliberately open item with reason — or explicit "keine">
  ## Gate
  <pnpm format / pnpm lint / pnpm test — each with result; nothing may be red>
  ## Nachvollziehbarkeit
  <run link, model class, agent runtime, provider — taken from RUN CONTEXT below>

RULES:
- Refinement, never redesign (impeccable craft floor); KoliBri-first; token discipline
  (--pp-* in frontend/src/app.css, docs/mobile-ui-rules.md is the binding mobile rule set).
- Mobile-first: the 375px reference viewport is the bar for every change.
- The PR is a regular non-draft PR and the only GitHub write besides the branch push — no
  issues, no labels, no comments (the workflow sets `ai:needs-review` itself).
- TIME LIMIT: soft deadline noted below. Before every step: [ $(date +%s) -ge <epoch> ].
  If OVER: branch+commit+push the current state, create the PR with the skeleton
  (open items documented honestly), end the turn.

RESULT (the very LAST lines of your reply, in this order):
- PR-URL: <the created PR's URL>
- DESIGN-RUN: clean
- DESIGN-RUN: remaining
