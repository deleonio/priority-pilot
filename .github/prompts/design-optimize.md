FOCUS: Optimize ONE design target in the Balamentum frontend to shipping quality, end to end
with the Impeccable design skill: audit first, then execute the remediation plan THE AUDIT ITSELF
recommends — then cleanly close remaining TODOs and deliver the result as a regular PR with a fully
traceable description. You CHANGE code in this run (full tool tier).

The DESIGN_TARGET below is a short natural-language text (workflow dispatch input). Resolve it
yourself to the concrete surface (route, components, CSS) under frontend/ and state that
resolution in one sentence before starting.

Inline docs (JSDoc/comments): .ai-knowledge/project.md "Code-Dokumentation (JSDoc)" — binding, not repeated here.

Method + details: the Impeccable skill installed at user level (SKILL.md in the skill base
directory the runtime reports; not tracked in this repo). Load it FIRST — its Commands table routes
every command to its own reference file; load the reference of each command the audit actually
prescribes, nothing else in advance. Project context lives in frontend/PRODUCT.md and
frontend/DESIGN.md (the skill's context helper reads them; if the helper is unavailable, read those
files directly instead and continue).

PROCEDURE (in this order, one bounded pass per phase — no open-ended polish loops):
1. Impeccable setup for the resolved target (skill setup step), then:
2. AUDIT: /impeccable audit <resolved target> — technical quality report (a11y, performance,
   responsive, theming, implementation integrity). Document findings with file locations and
   severity; you need them verbatim for the PR description. Do not fix yet.
3. PLAN — take the audit's OWN closing recommendation list ("Recommended Actions" / "Empfohlene
   Reihenfolge"): the commands it names, in the order and priority it gives them (P0 before P1
   before P2). Write that list down verbatim BEFORE touching code; it is the contract for this run
   and goes into the PR unchanged. Rules for the plan:
   - Never substitute a command the audit did not name, and never reorder by your own taste. A
     different target legitimately yields a different chain — that is the point of asking the audit.
   - Do not pad: if the audit recommends nothing (no P0/P1/P2 findings), change no code. Go straight
     to step 6 and deliver a PR that documents the clean audit. An empty plan is a valid outcome.
   - The only fixed element: if the plan contains any fix at all, /impeccable polish is the last
     step — the audit's own rules require it, so it is normally already in the list; add it if the
     audit omitted it.
   - Cap the chain by the TIME BUDGET below, not by a fixed count. Estimate before starting; if the
     full plan does not fit, drop from the LOWEST priority upward and list every dropped command
     under "Offene Punkte" with its audit finding. Never drop a P0.
4. EXECUTE the plan, one bounded pass per command, in the planned order. Before each command load
   its reference file from the skill; after each, note in one line what changed and which audit
   finding it closes — that line is the PR's change log. If a command turns out not to apply
   (its findings were already resolved by an earlier pass), skip it and say so instead of inventing
   work for it.
5. If executing the plan uncovered a defect the audit missed, fix it in the pass whose dimension
   owns it and mark it in the PR as found-while-fixing, not as an audit finding.
6. TODO CHECK (mandatory before closing): scan the touched surface for anything the sequence
   opened but did not cleanly close — skipped or red gates, debug leftovers, promised-but-open
   fixes, uncommitted changes. Finish what can be finished now. Anything that genuinely must
   stay open gets one line with reason in the PR's "Offene Punkte" section.
7. GATE before the commit (the canonical gate in AGENTS.md — mirror of CI Verify): pnpm format
   && pnpm exec prettier --check . && pnpm lint && pnpm -r build && pnpm test (repo root) —
   every command green; fix red results before continuing. E2E scoped: run the frontend e2e
   specs covering the touched surface (CI runs the full sharded suite over this PR).
8. BRANCH + COMMIT + PUSH: create the delivery branch with the EXACT name given under "RUN
   CONTEXT" below (git checkout -b), commit ALL changes
   (git add -A && git commit -m "design(frontend): <short slug from the DESIGN_TARGET>
   [impeccable]") and push it with git push -u origin HEAD.
   EMPTY PLAN: if the audit found nothing and you therefore changed no code, there is nothing to
   commit — but the PR still is the deliverable (the workflow parses its URL fail-loud). Commit
   with --allow-empty and the message "design(frontend): <slug> — Audit ohne Befund [impeccable]";
   the PR body then carries the audit report as the result.
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
  ## Maßnahmenplan aus dem Audit
  <the audit's recommendation list VERBATIM, in its order, each line with its priority — plus
  per entry: ausgeführt / übersprungen (reason) / entfallen wegen Zeitbudget. If the audit
  recommended nothing: "Audit ohne Befund — kein Eingriff." and no Änderungen section entries.>
  ## Änderungen
  <one ### section PER EXECUTED COMMAND, named after that command in the planned order, e.g.
  "### /impeccable layout" — each with what changed, which audit finding it closes, file paths.
  Nothing here that is not in the plan above, except items explicitly marked
  "beim Umsetzen gefunden".>
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
- DESIGN-PLAN: <the executed commands, comma-separated, in the order they ran, e.g.
  "audit, layout, harden, polish" — or "audit" alone when the audit recommended nothing>
- DESIGN-RUN: clean
- DESIGN-RUN: remaining
