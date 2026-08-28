---
name: ticket-implementation
description: "Ticket implementation — implement approved issues test-driven (red-green-refactor), pick up the spec draft PR or run direct mode, drive the gate, make the PR review-ready; includes fixup follow-up work after review (ADR 0005). Use for 'implementiere Issue' (German: implement issue), CI phase 4."
---

# Workflow: Ticket Implementation (GitHub Issues)

Use for approved issues — turns them into code. Follows **Red → Green → Refactor** against the red tests from the spec stage.

Note: this file's prose is English; PR/comment text written to GitHub stays German — that content is for the project's German-speaking contributors.

**Selection criterion:** Open issues with the label `ai:needs-impl` that are **not yet assigned**. The assignment is the "in progress" marker.

## Step 1 — Select issue & assign yourself

- Find open, approved, not-yet-assigned issues: `gh issue list --state open --label "ai:needs-impl" --json number,title,assignees --jq '[.[] | select(.assignees | length == 0)] | .[] | "\(.number)\t\(.title)"'`
- A specifically given number takes priority.
- **Assign yourself:** `gh issue edit <nr> --add-assignee @me`
- Load context + analysis: read the analysis block from the **body** (`gh issue view <nr> --json body -q .body`); if missing, fall back to the most recent `🤖 KI-Analyse` comment.
- **Pick up the spec draft PR (the normal case):** find and check it out: `gh pr list --state open --draft --json number,headRefName,closingIssuesReferences` → choose the PR whose `closingIssuesReferences` contains `<nr>`.
  **Fallback for an empty `closingIssuesReferences`:** check the PR body, but **ONLY with a closing keyword** — `grep -Ei "(clos(e|es|ed)|fix(es|ed)?|resolv(e|es|ed))[[:space:]]*:?[[:space:]]*#?<nr>([^0-9]|$)"`. A mere mention of the number does **NOT** count (otherwise you'd check out a foreign PR that only describes the issue). Then `git fetch origin` and `git switch <headRefName>`.
- **Idempotency:** if **no** draft PR exists, but a **non-draft PR** with a closing keyword does → implementation already ran → end the run. Otherwise **direct mode** applies (own branch + write tests yourself).

## Step 2 — Read the analysis & quickly verify

- Take the **acceptance criteria + test cases** from the body block.
- **Check affected files:** do the files named there still exist?
- **Traffic light 🔴** → don't implement, comment with a justification, and end the run as not ready.
- **Traffic light 🟢/🟡** → proceed directly to step 3.

**No full re-triage.** The triage stage already did the work — implementation trusts it.

## Step 3 — Implement (test-driven: red-green)

- **Branch:** in **spec mode** the branch is already checked out. In **fallback mode**, the
  harness branch `ai/harness/<nr>` (usually already exists — `git fetch origin && git switch
  ai/harness/<nr>`; otherwise `git switch -c ai/harness/<nr>`).
- **(a) Red — tests exist before the code:**
  - **Spec mode:** the **red tests already exist** (from the spec stage). They are the **contract** and are **not changed**.
  - **Fallback/direct mode** (the analysis deliberately skipped the spec, field "Spec nötig: nein" [spec needed: no]): create the branch yourself, implement, commit, push, and create the PR **yourself** (`gh pr create`, **not** `--draft` — the PR goes straight into review; without this step there is nothing to review). **Test obligation in direct mode:** if, against expectations, application code is touched after all (`server/src/**`, `frontend/src/**`, `frontend/e2e/**`), write the tests yourself too — the test carve-out ([ticket-spec](../ticket-spec/SKILL.md) step 3, ADR 0001) applies ONLY to workflows, scripts, config, and markdown. If the scope turns out to be significantly larger than expected as a result, that's a sign the analysis misjudged it: end the run as not ready, with a justification in the PR body.
- **(b) Green — code until green:** implement production code until **all** tests are green (`pnpm test`). Follow conventions (tabs, `strict`, ESM). For **frontend changes**, **KoliBri-first** applies: find and use the matching component via KoliBri MCP. Additionally check visible UI changes via Playwright MCP at **375px and 1280px viewport** against the running inspect instance.
- **(c) Refactor & gate (CI mirror, before every commit):** clean up only once tests are green, then run the local CI gate:
  ```
  pnpm format
  pnpm exec prettier --check .
  pnpm lint
  pnpm knip
  pnpm test
  ```
  For **changed UI files**, apply the same order — **SPARINGLY:** for design/layout checks, use the deterministic, cheap tools first (design detectors + rules from `docs/mobile-ui-rules.md`); use Playwright MCP only for the short 375/1280 layout-break check on actually visible changes (screenshot + A11y snapshot), NOT for exploratory design analysis.
  **e2e:** `pnpm --filter frontend test:e2e` ONLY if the change affects UI behavior and an e2e spec exists for it — otherwise skip and note it in the PR body.
  **For confirm/delete/destructive dialogs:** apply `docs/ux-pattern-sequential-confirmation.md`. **For visible UI:** apply `docs/mobile-ui-rules.md` (touch targets ≥44px, async states, anti-patterns).
  Only commit/push once everything is green.

## Step 4 — Create & link the PR (ready to review)

- Commit the changes (reference the issue in the message).
- Push the branch.
- **Make the PR review-ready:**
  - **Spec mode:** take the existing **draft PR** from the spec stage out of draft (`gh pr ready <pr>`) and extend its description with the implementation summary.
  - **Fallback mode:** create a normal PR: `gh pr create --assignee @me --title "<title> (#<nr>)" --body "… Closes #<nr> …"`.
- **Development link:** the `Closes #<nr>` keyword in the PR body creates the association in the **"Development" section**.
- The PR description contains: a short implementation summary, affected files, `pnpm format`/lint/**test** results.
- **Follow up on the PR** — after creating it, react to incoming review comments and CI results in further rounds (step 5).

## Step 5 — Cross-examination loop (implement ⇄ review, until clean)

The freshly created PR is actively cross-examined and reworked — in rounds, until **no comment is left open**.

**Follow the PR:** react to incoming review comments, new commits, and CI results round by round.

**Per round:**

1. **Trigger a cross-examination** — adversarially review the full PR diff (see [review-kreuzverhoer](../review-kreuzverhoer/SKILL.md)). Post every finding as an anchored review comment, concluded with a verdict including a **traffic light** (🟢/🟡/🔴).
2. **Check CI** — `gh pr checks <pr>`. If something fails, diagnose and fix the cause.
3. **Work through findings:**
   - **Valid, small, unambiguous →** fix it: commit + push the fix, `pnpm format && prettier && lint`, reply in the thread and resolve.
   - **Ambiguous or architecturally relevant →** ask a follow-up question and wait for an answer.
   - **Not valid →** comment factually on why nothing is changed, and resolve.
4. **Cross-examine again** — after the fix commits, review the updated diff again.

**Exit condition:** the loop ends once the cross-examination verdict is **🟢** and **no open findings** remain.

**Loop guard:**

- Keep replies brief; don't announce every fix round individually.
- Don't reopen findings that were already rejected with a justification.
- If substantial findings are still open after **3 rounds**, let a human decide.

## Notes

- Assigning, push/PR, and review comments write **publicly** to GitHub — get confirmation first.
- The result is a **review-ready PR** that has gone through the cross-examination loop and continues to be followed. The final merge stays with a human.
- **Run mechanics** (verdict lines, time limit, label rules) are governed by the calling run's prompt, not by this skill.
