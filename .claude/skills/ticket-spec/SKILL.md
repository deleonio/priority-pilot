---
name: ticket-spec
description: "Ticket spec — write red tests as an executable contract per acceptance criterion (spec-first, TDD separation of duties), create a draft PR. CI phase 3."
---

# Workflow: Ticket Spec (red tests before implementation)

Use for approved issues — writes the **red tests** (executable contract) from the acceptance criteria, **before** production code exists.

Note: this file's prose is English; PR/comment text written to GitHub and spec documents under `docs/spec/**` stay German — that content is for the project's German-speaking contributors.

This stage is the **separation of duties** of the TDD strategy (stage 3, see [tdd-strategy.md](../../../.ai-knowledge/tdd-strategy.md)): whoever writes the tests (this workflow) does **not** write the code (the implementation, [ticket-implementation](../ticket-implementation/SKILL.md)).

**Selection criterion:** Open issues with the label `ai:needs-spec` (set by the UX phase for UI issues, or directly by the analysis phase for non-UI issues), for which **no** open (draft) PR yet exists (idempotency).

## Step 1 — Select issue & create branch

- Find open issues with `ai:needs-spec`: `gh issue list --state open --label "ai:needs-spec" --json number,title --jq '.[] | "\(.number)\t\(.title)"'`
- A specifically given number takes priority; otherwise process in order (oldest first).
- **Idempotency:** If an open PR with `Closes #<nr>` already exists for the issue, **do not** spec it again — end the run.
- Load context + analysis: read the **acceptance criteria + test cases** block primarily from the issue's **body block** (`gh issue view <nr> --json body -q .body`, the section between `<!-- KI-ANALYSE:START … -->` and `<!-- KI-ANALYSE:END -->`). If the body block is missing (legacy issue), fall back to the most recent `🤖 KI-Analyse` comment.
- Create a branch from `main`: `git switch -c feat/issue-<nr>-<short-name>`.

## Step 2 — Spec-first: update the specification (BEFORE deriving tests)

- Check whether a relevant spec already exists: `ls docs/spec/*.md`
- **If yes** (e.g. `user-journeys.md` for feature changes): extend/correct/shorten the existing spec — document the behavior that is to be tested.
- **If no:** create a new spec `docs/spec/issue-<nr>.md` — structured by goal/precondition/steps/expected result (format reference: `user-journeys.md`).
- Update the spec in the **same commit** as the tests (no separate commit — the spec belongs to the spec phase).

## Step 3 — Write red tests (the contract)

- Tests are derived from the **spec** (not directly from the acceptance criteria). Every acceptance criterion must be covered by the spec; every test must reference the spec or an acceptance criterion.
- **Mind the KI-UX block:** if the issue has UX aspects (a KI-UX block present in the body), let its requirements flow into the spec derivation.
- **For confirm/delete/destructive dialogs:** base tests on `docs/ux-pattern-sequential-confirmation.md` — sequential yes/no steps, mandatory focus management on transition.
- Write the test case(s) for each acceptance criterion as **real, executable** tests — **only** for application code (`server/src/**`, `frontend/src/**`, `frontend/e2e/**`). Test level and target file by issue type:
  - **Backend logic / API** → `node:test` (`server/src/logics/*.test.ts`, `server/src/express/*.test.ts`).
  - **Frontend logic** → Vitest (`frontend/src/lib/*.test.ts`).
  - **Feature / UI behavior** → acceptance e2e (`frontend/e2e/*.spec.ts`, style `crud.spec.ts`).
  - **Pure styling/layout** → don't force a test; justify in the PR body that visual verification is used instead.
  - **Non-application code** (`.github/workflows`, `.github/scripts`, CI plumbing, config files, markdown content anywhere) → **write no test**. A string/YAML/config match is a change detector with no teeth (ADR 0001).
- **Dedup before writing:** use `grep` to check whether an acceptance criterion is already covered by an existing test. Already covered → **don't** duplicate. Does an acceptance criterion contradict an existing test? → **remove the old test** and name why in the PR body under `Test-Pflege-Bedarf` (test maintenance needed — the section name stays German; the implementation and review phases use the same literal).
- **As few as possible, but each with teeth:** a test must **evaluate** something, guard a **mirror** between files, or protect against a **silent/costly** failure. No test of the form "the file contains the string I just wrote into it".
- **Red, not broken:** every test checks real **expected behavior** and turns green as soon as the production code exists. For **new** functionality, a missing export/import is the legitimate first red state; for **existing** code, `pnpm test` shows the new tests as **failing**.
- **Write no production code** — only tests (at most minimal test helpers/fixtures).
- **Mutation check before commit:** for central logic, briefly verify that every new test actually evaluates something — mentally (or by hand) break the tested behavior: would the test turn red? A test that stays green even with broken behavior has no teeth and gets removed.
- **Spec-PR scope (mandatory):** the spec PR may contain **only** `docs/spec/*.md` and red tests — **no** implementation (neither production code nor CSS nor config). Any app-code change belongs in the implementation PR (phase 4). If app-code changes turn out to be necessary during the spec phase, note them in a workspace comment — phase 4 picks up the requirement.
- **For UI issues:** verify planned KoliBri components (custom element + properties) via KoliBri MCP so tests address the right elements.

## Step 4 — Commit, push, draft PR

- Commit the red tests as your **own, first commit**, e.g. `test: red spec tests for #<nr>`.
- Push the branch: `git push -u origin <branch>`.
- Create a **draft PR**: `gh pr create --draft --title "<issue title> (#<nr>)" --body "… Closes #<nr> …"` — `<issue title>` is the issue's title verbatim (no rephrasing, no "red tests"/"rote Tests" in the title). The body contains a short list of the covered acceptance criteria and the note "red spec tests; implementation follows" (PR body text in German).
- Verify the link: `gh pr view <pr> --json closingIssuesReferences --jq '.closingIssuesReferences[].number'` must contain `<nr>`.

## Notes

- Branch/push/PR/labels write **publicly** to GitHub — get confirmation first.
- This workflow writes **only tests**, **no** production code (that is the deliberate separation of duties).
- If the analysis deliberately doesn't mark an issue 🟢 (🟡/🔴), there is no phase trigger — a human decides.
- **Run mechanics** (verdict lines, time limit, label rules) are governed by the calling run's prompt, not by this skill.
