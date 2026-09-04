---
name: review-kreuzverhoer
description: "PR cross-examination — adversarially review pull requests, post findings as inline comments, traffic-light verdict in the ai-review collected comment. Use for 'review PR <number>', 'cross-examine this PR' (German: „review PR <Nr>“, „prüf/kreuzverhöre diesen PR“), re-review after fixup. CI phase 5/7 uses the same method."
allowed-tools: Read, Grep, Glob, Bash(gh *)
---

# PR Cross-Examination (Pull Request Review)

Reviews a pull request **critically, like a cross-examination**. This file is the canonical method
for local/manual reviews — the CI review phase (5/7) implements it via its operational prompt.

Note: this file's prose is English; the review body and collected comment written to GitHub stay German — that content is for the project's German-speaking contributors.

PRs = pull requests of `deleonio/priority-pilot`. Prerequisite: `gh` is authenticated.

**Selection criterion:** a specifically given PR is reviewed; without one, the most recently
opened/updated open PR.

## Stance

Question every assumption, every decision, every compromise — relentlessly and systematically,
constructive but **adversarial**, instead of rubber-stamping the obvious. Evidence over gut feeling:
back every point with a concrete file/line reference.

- Work through the decision tree **branch by branch**. If one decision builds on another,
  clarify the foundation first.
- Don't let up until every point has been resolved.
- Questions answerable through your own research or existing information should be **answered
  yourself** — only ask what genuinely cannot be figured out independently.

## Delegation — neighborhood research only, never the verdict (ADR 0008)

Reading the diff and judging it is the review — that stays in your context and is never
delegated. What
goes to the cheaper role (`recherche`, agent in `.claude/agents/`, haiku via subagent model)
is the **neighborhood** around the diff, where broad reading produces a short answer:

- "Where else is this function/symbol used?" — blast radius of a change.
- "Which tests cover the touched files?" — coverage gaps behind a finding.
- "How does the existing code solve the same problem elsewhere?" — pattern deviations.

Return contract lives in the agent file (paths + findings, ≤ 30 lines). If the role isn't
available locally, the same question to a general-purpose subagent works.

## Step 1 — Understand the PR

- Read the title, description, and **full diff**:
  `gh pr view <pr> --json title,body,files,additions,deletions` and `gh pr diff <pr>`.
- Load the linked issue (expected behavior): resolve the PR's `closingIssuesReferences`
  (`gh pr view <pr> --json closingIssuesReferences`) → `gh issue view <nr> --json body,comments`.
  Read the triage's **acceptance criteria** primarily from the **harness marker comment** (ADR 0009 — the
  comment whose body starts with `<!-- ai-harness -->`; the section between
  `<!-- KI-ANALYSE:START … -->` and `<!-- KI-ANALYSE:END -->`); if missing (legacy issue), fall back to the
  issue body block. The remaining comments stay context (dialogue/pings).
- Clarify the target state: what problem should the PR solve, and how is "done" recognizable?

## Step 2 — Cross-examination (critical questions)

Check the diff against these questions:

- **Does it solve the problem?** Does the change fully meet the goal stated in the issue/description?
- **Edge cases:** empty/very large inputs, error paths, boundary values, `null`/`undefined`, concurrency.
- **Simplest path?** Could it be simpler? Unnecessary complexity, duplication, dead code, over-abstraction?
- **Performance:** avoidable O(n²) loops, N+1 queries (Sequelize), unnecessary allocations/re-reads.
- **Security:** input validation, injection (SQL/path), secrets in code, missing authorization checks.
- **Regression/obsolescence:** does the change make existing tests or behavior **outside the
  diff** obsolete, or contradict them (requirement changed)? **Note:** obsolete tests should already have been removed at the spec stage (ticket-spec.md). If a contradiction still turns up anyway → name it as a finding (`Test-Pflege-Bedarf`, the German section literal, with file/line) — don't silently accept it, but also don't change it yourself (a human, or a follow-up spec, decides on the adjustment/removal).
- **KoliBri-first for UI changes** ([design language § 4](../../../.ai-knowledge/ux-design.md#4-komponentenwahl--kolibri-zuerst)): custom styling without a KoliBri alternative?
  When in doubt, search for alternatives via the KoliBri MCP. A missing justification for
  a custom-styling decision in the PR body is a finding.

## Step 3 — Code quality

- **Naming & readability:** descriptive names, clear function boundaries, comments only where needed.
- **Tests (mandatory gate):** are the issue's acceptance criteria covered by **green** tests?
  Do they cover the new paths and edge cases? Is the test-driven order recognizable (tests
  as their own/first commit, cf. [ticket-implementation](../ticket-implementation/SKILL.md) step 3)?
  **Missing tests for an acceptance criterion, or red tests, prevent a 🟢** (exception: pure
  styling/layout, justified in the PR). For **spec PRs** (stage 3), additionally check: were the **red
  spec tests from the first commit turned green unchanged**? Watered-down/deleted spec tests, or ones
  adapted to fit the code, are a **separation-of-duties violation** → no 🟢, unless a test correction
  is reported back with justification in the PR and approved.
- **Test substance over test count** ([tdd-strategy.md → test scope](../../../.ai-knowledge/tdd-strategy.md#testumfang--so-viel-wie-nötig-so-wenig-wie-irgend-möglich)):
  many tests are not a quality signal. For every new test, check whether it **can** fail at all —
  tests that only confirm a file contains the string you just wrote into it are
  a finding ("tautological test"), not a plus. Also a finding: a universal claim ("for all
  X…") without ensuring the checked set isn't empty.
- **Project conventions** ([project.md → conventions](../../../.ai-knowledge/project.md#konventionen)): tabs, `strict`, ESM with `.js` imports,
  no type assertions to suppress errors, exactly one central Prettier config.
- **Mobile-first for UI changes** ([project.md → mobile-first](../../../.ai-knowledge/project.md#mobile-first-frontend)): new `@media` rules as
  `min-width` (upward cascade), no `max-width` downgrade from desktop. Check wide tables/grids without
  a narrow alternative at phone width (avoid horizontal scrolling of the core content). If a
  375px-viewport e2e test is missing for a visible UI change (see `login.spec.ts` AC5,
  `task-tree.spec.ts` AC-6 as a pattern), that's a finding — exception only if justified in the PR.
- **Design audit for UI PRs:** for changes under `frontend/`, extend the cross-examination with
  a systematic UI audit — five dimensions (accessibility, performance, theming, responsive,
  implementation integrity, each scored 0-4). Prefer deterministic detector evidence over
  guesses; verify false positives in context and name them as such.
- **Format/lint:** are `pnpm format`/`pnpm lint` documented in the PR description? Follow up if in doubt.

## Step 4 — Post findings as review comments

Per finding, **one concrete comment anchored to a file/line** — each with:

1. **What** the problem/question is (precise, not vague).
2. **Why** it matters (impact: bug, risk, maintainability, performance, …).
3. A **concrete suggestion** for improvement (ideally with a code/suggestion block).

- Classify every finding so the fixup loop can act on it (the fixup prompt keys off these
  classes — use the same terms): **fixable** (you know the fix, the fixup implements it),
  **decision** (a human must choose — options + option IDs in the collected comment) or
  **ambiguous** (context missing — name exactly what the fixup should ask in the thread).
  The classification needs a justified match (Abgleich): a finding only becomes **decision**
  if fixing it yourself would overrule a documented human choice or a binding ADR — say which.
- **Severity decides whether a fixup round runs at all (cost gate):** every fixable finding
  also carries a severity — **blocker** (bug, security, uncovered acceptance criterion, red
  tests, convention violation with impact) or **nit** (style/naming/minor simplification
  without behavioral risk). Blockers → verdict `needs-fixup`. **A nit-only round does NOT
  trigger a fixup run**: the verdict stays `reviewed` (🟢 if the acceptance criteria are
  covered by green tests) and the nits go into the collected comment as a non-blocking list —
  a human can still order a fixup later. Rationale: one fixup round plus re-review costs
  ~45 turns; a nit almost never justifies that.
- Post them bundled as **one review** with inline-anchored comments, event **`COMMENT`** (not
  `APPROVE`/`REQUEST_CHANGES`): `gh api repos/{owner}/{repo}/pulls/<pr>/reviews` with `event=COMMENT`,
  `body` (summary), and one entry per finding in `comments[]` (`path`, `line`, `body`).
  Individual comments alternatively via `repos/{owner}/{repo}/pulls/<pr>/comments`.
- **No** formal approve/request-changes — the merge stays with a human.

## Step 5 — Summary verdict with traffic light

Review body (German) with a **traffic light** at the start:

- 🟢 **solid** — no relevant findings **and the acceptance criteria are covered by green
  tests**: a brief confirmation of what was solved well.
- 🟡 **basically OK** — improvements recommended: name the points, bundled.
- 🔴 **fundamental problems** — doesn't achieve the goal / bug / security or architecture problem.

Then the most important findings as a short list; details live in the inline comments.

### Maintain one collected AI comment (consolidation instead of duplicates)

Across the fixup loop (`ai:needs-review` → review → `ai:needs-changes` → fixup → …), the
cross-examination runs multiple times on the same PR. So that **not every round accumulates a new
comment** and clutters the PR, the review maintains **exactly one** summarizing collected AI
comment per PR — it gets updated in place instead of duplicated. (The findings anchored inline to
lines from step 4 are unaffected by this — they can't be deduplicated and updated the same way and
age with the diff regardless; what gets consolidated is the **collected comment** with the verdict.)

- **Marker-based identification:** the collected comment carries a hidden HTML marker
  `<!-- ai-review -->` as its first line, by which it is found again in later rounds.
- **Search instead of blindly creating:** before posting, **search via the API** for the
  **existing** marked comment from the AI bot — more robust than `gh pr comment --edit-last`,
  because other bots/humans may have commented in the meantime (confirmed by the owner):
  `gh api repos/{owner}/{repo}/issues/<pr>/comments` and filter for `<!-- ai-review -->`.
- **Update instead of creating anew:** if a marked comment is **found**, **update/extend** it
  (`gh api --method PATCH repos/{owner}/{repo}/issues/comments/<id> -f body=…`) — the
  comment ID stays the same. If **not found** (no marked comment exists yet),
  **create it once** (`gh pr comment` with the marker as the first line).
- **Diff scoping on a follow-up review (cost/time savings):** if an existing collected comment is
  found (follow-up review after a fixup push), do NOT walk the entire PR diff again from
  scratch. The primary input is the fixup's **claim checklist**: its `<!-- ai-fixup-decisions -->`
  collected comment lists every addressed finding as `Finding #<N> — fixed in <SHA>` under
  "✅ Behobene Anmerkungen" — verify **each row against the fixup diff** (commit exists, actually
  fixes the finding, introduces nothing new) instead of re-discovering the delta. Findings
  without a claim row stay open. Beyond that, read the review comment's `updatedAt` timestamp
  and check only the commits/diff **since that point in time** (`gh pr view --json commits`
  filtered on `committedDate > updatedAt`, then `git diff`) — don't re-litigate points already
  listed under "Resolved comments". Keep the issue context and architectural touchpoints in
  view (don't judge purely diff-locally). If the marked comment is missing (first review),
  always check the full diff (step 1 stays unchanged).
- **Struktur des Sammelkommentars** (status line, then sections as needed). The section
  headings below are written **verbatim in German** — they are the German artifact's own
  headings, the fixup sibling comment uses the same ones, and the pipeline's needs-human
  verification substring-tests the comment body for `Entscheidungs-Findings`. Translating a
  heading makes that verification fall back to "Begründung ist nicht verifizierbar":
  - **🎯 Review-Status** — line 2 (after the marker): `reviewed | needs-fixup | needs-human`
    plus 1–2 sentences of context (mode, round, outcome).
  - **✅ Behobene Anmerkungen** — a **history table** of findings already resolved across rounds
    (columns: **#** | Finding | Behoben via | **Datum**). When updating, resolved points
    move here so the historical view of what has already been handled is preserved.
  - **⏸️ Entscheidungs-Findings** — only for needs-human: per finding, a stable number `<F>`
    (stable across rounds), what/where, 2–3 options EACH with a stable option ID `` `<F>.<n>` ``
    (e.g. `4.1`) and effort/risk, a recommendation with ID and justification. Finally, the
    **selection line**: the human replies with a comment containing the option ID and sets
    `ai:needs-fixup` (implement) or `ai:needs-review` (accept) — the fixup implements the
    chosen option without re-evaluating.
  - **📋 Offene Findings** — only for needs-fixup: the points of the **current** round (with
    traffic light, file/line, suggestion).
  - **📝 Nits (nicht blockierend)** — nit-only rounds: the non-blocking points as a short list
    (file/line, suggestion). Never a reason for `needs-fixup`; entries get removed or checked
    off once addressed (by a later fixup or the human).
  - **Footer** — `Review-Typ: Kreuzverhör | Fixup-Nachweis` (review type: cross-examination | fixup evidence) and `Updated: JJJJ-MM-TT` (ISO date; the German placeholder is kept so it matches the sibling ai-fixup-decisions comment).

**CI/quality gate as a precondition:** a green content verdict (🟢) is **necessary but not
sufficient** for `ai:ready-to-merge` — the mandatory checks (CI: format/lint/build/test) must
also be green. In the pipeline, a deterministic gate/auto-merge step handles this: if at least
one of the allowlisted checks **CI** or **Reviewer** is red, it degrades to `ai:needs-changes`
and thereby triggers the fixup — `ai:ready-to-merge` is only granted once both are green (and
then the PR is merged automatically). The same rule applies in any mode: don't conclude with 🟢
while CI is red.

## Notes

- Posting a review/comments writes **publicly** to GitHub — get confirmation first.
- Stay brief and concrete; anchor and justify every point against code lines.
- Pure review: **never** change or commit production code.
