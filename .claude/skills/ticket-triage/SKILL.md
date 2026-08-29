---
name: ticket-triage
description: "Ticket triage — analyze open GitHub issues, copyedit them, split them up if needed, write the analysis block (KI-ANALYSE) into the body, set the traffic-light verdict, and steer labels. Use for 'triage', 'analyze issues' (German: 'triage', 'analysiere Issues'), CI phase 1."
---

# Workflow: Ticket Triage (GitHub Issues)

Use when you need to analyze open GitHub issues — assesses feasibility, writes the analysis block into the body, and steers the following phases via labels.

Note: this file's prose is English; text written into GitHub issues/comments (the analysis block, ping comments, decision comments) stays German — that content is for the project's German-speaking issue authors and reviewers.

Issues = GitHub issues of `deleonio/priority-pilot`. Prerequisite: `gh` is authenticated.

**Selection criterion:** All **open** issues that do **not yet** carry the label
`ai:analysed` are analyzed. A **specifically given number** is always processed, even if it already carries `ai:analysed` (re-triage).

## Step 1 — Select & analyze issue(s)

- Find open, not-yet-analyzed issues:
  `gh issue list --state open --json number,title,labels --jq '[.[] | select((.labels | map(.name)) | index("ai:analysed") | not)] | .[] | "\(.number)\t\(.title)"'`
- A specifically given number takes priority; otherwise process in order (oldest first).
- **Batch processing:** Without a specific number, work through **all** matching issues in **one** run. Take each issue completely through steps 1–5, then move to the next.
- If no matching issue exists: say so clearly and stop.
- Load details per issue: for **initial triage** title + description (`gh issue view <nr> --json title,body`);
  for **re-triage** additionally **only the delta comments** since the last `stand` (as-of) timestamp.
- Design a solution from the issue's **title and description** together with the **repo**:
  find relevant files, take architecture/conventions from the knowledge base into account —
  don't guess. The file/convention research is read-heavy with a short result: delegate it to
  the `recherche` subagent role (ADR 0008; falls back to general-purpose if the role isn't
  available) and keep only its findings in your context.
- Result: problem summary, affected files/areas, root cause/solution approach, open questions/risks, plus **verifiable acceptance criteria** and **test cases**.
- **Re-triage of an existing analysis:** If the issue already carries `ai:analysed`, the analysis lives in a
  marked block in the **body** (`<!-- KI-ANALYSE:START stand=… -->` … `<!-- KI-ANALYSE:END -->`).
  1. Load the body, extract the analysis block, and read out the `stand` timestamp.
  2. **Read only the delta comments since `stand`** (NOT the whole thread).
  3. **Don't carry over the existing analysis unchanged:** check whether it **still fits** the (possibly revised)
     task, including the delta answers, and is **complete**. If it no longer fits
     or aspects are missing: **incorporate/remove** answered open questions, flip the traffic light if needed, update the
     acceptance criteria — don't leave gaps standing.

## Step 2 — Copyedit the description (content unchanged)

- **Copyedit the issue description:** improve spelling, grammar, and clarity.
- **The content must not be changed in the process:** no new or removed requirements,
  no change in meaning, no additional assumptions.
- **Template headings are untouchable:** the four ticket-template headings
  (`Was ist das Problem?`, `Wie soll es sein?`, `Wo tritt es auf?`, `Woran messen wir das?`)
  survive every body rewrite word-for-word — copyedit their **content**, never rename,
  merge, or drop the headings themselves. Insert or replace the analysis block and the
  routing table **below** the template sections, never in between: every later phase
  locates its input by these headings.
- Apply the copyedited version — pass a multi-line body with **real line breaks**, e.g.
  `gh issue edit <nr> --body-file -` with a heredoc.
- If the copyedit changes nothing substantively, leave the description untouched (no "pro forma" edit).

## Step 2b — Optimize the title (content unchanged)

- **Check consistency:** Does the title still accurately reflect the (copyedited) **description** and the issue's **actual
  goal**? Is it short, precise, and substantively coherent?
- **Adjust only on actual inconsistency** — faithful to the content, as with the copyedit:
  no change in meaning, no new requirements.
- Apply via `gh issue edit <nr> --title "<new title>"`.

## Step 3 — Split up oversized issues (optional)

An issue counts as **too large** if **at least one** of the following applies:

- it touches multiple layers/packages of the monorepo,
- it contains multiple independent acceptance criteria / requirements joined by "and",
- it couldn't reasonably be implemented/reviewed in **one** PR.

For an oversized issue:

- **Precondition — ensure labels exist:** `ai:analysed`, and for immediately implementable sub-tasks also `ai:needs-ux-ui`/`ai:needs-spec`, must **exist**.
- Derive **2–5 sub-tasks that are as independent as possible** from the analysis (each implementable in **one** PR).
- Create a **sub-issue** per sub-task — already with a mini-analysis + traffic light in the body, **including the START/END markers**.
- Attach the sub-issue as a **real GitHub sub-issue** under the parent issue (GraphQL, mandatory):
  `gh api graphql -f query='mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){clientMutationId}}' -f p=<parent-node-id> -f c=<child-node-id>`
- **For sequential dependencies — set the native `blocked-by` relation (mandatory):**
  `gh api graphql -f query='mutation($b:ID!,$k:ID!){addBlockedBy(input:{issueId:$b,blockingIssueId:$k}){clientMutationId}}' -f b=<successor-node-id> -f k=<predecessor-node-id>`
- **Recursion guard (mandatory):** Sub-issues are created directly with `ai:analysed` (they **are**
  already the analysis result) and thus fall outside step 1's selection criterion. Only **one** level of splitting is allowed.
- If sub-issues are immediately implementable (traffic light 🟢), also set the matching phase trigger (`ai:needs-ux-ui` for UI relevance, otherwise `ai:needs-spec`). **For sequential chains (`blocked-by`), give the trigger only to the first, unblocked sub-issue.**

## Step 4 — Solution proposal in the body block (with traffic light)

- Formulate the solution approach concretely and actionably: affected files, steps, alternatives, risks.
- **Acceptance criteria & test cases (mandatory part):**
  Extend the solution proposal with a list of **verifiable acceptance criteria** and name the
  concrete **test case** for each criterion — **only for application code** (`server/src/**`, `frontend/src/**`, `frontend/e2e/**`). Test level and target file by issue type:
  - **Backend logic / API** → `node:test` unit (`server/src/logics/*.test.ts`) or API test (`server/src/express/*.test.ts`).
  - **Frontend logic** → Vitest unit (`frontend/src/lib/*.test.ts`).
  - **Feature / UI behavior** → acceptance e2e (`frontend/e2e/*.spec.ts`, style `crud.spec.ts`). For user-visible UI features, add a **mobile-first acceptance criterion** (375px viewport) with its own test case.
  - **Pure styling/layout** → visual verification instead of a test (briefly justify).
  - **Non-application code** → **no test cases**.

- Put the **feasibility traffic light** at the start of the analysis block:
  - 🟢 **green** — clearly implementable: requirements unambiguous, affected files known, feasible in one PR **and verifiable acceptance criteria + test cases are in place**.
  - 🟡 **yellow** — conditionally implementable: open questions/assumptions, **acceptance criteria cannot (yet) be phrased verifiably**, larger scope or splitting recommended.
  - 🔴 **red** — not yet implementable: requirements unclear/contradictory or information missing; clarification needed.

- Write the analysis as a marked **block into the issue body**. This block's content is written in German — it is the ticket content itself, read by the (German-speaking) issue author and other contributors:
  ```
  <!-- KI-ANALYSE:START stand=YYYY-MM-DDTHH:MM:SSZ -->
  ### Umsetzungskontext
  - Betroffene Dateien: `pfad/a.ts`, `pfad/b.ts`
  - Betroffene Komponenten: <Funktion/Klasse/Endpunkt/Custom-Element>
  - Vorhandenes Muster: `pfad/vorbild.ts` — <was dort gleichartig gelöst ist>
  - Randbedingungen: <was nicht brechen darf>
  - Erwartetes Ergebnis: <von außen beobachtbares Verhalten>

  ### Akzeptanzkriterien
  - AK1: <prüfbar formuliert>

  ### Testfälle
  <Testfall je AK, Ebene benannt>

  ### Ampel
  - Ampel: 🟢|🟡|🔴
  - Begründung: <kurz>

  ### ❓ Offene Fragen
  - [ ] <Frage>
  <!-- KI-ANALYSE:END -->

  <!-- ai-phase-routing:START -->
  | Phase | Run | Modell | Effort |
  | --- | --- | --- | --- |
  | ux | ja|nein | haiku|sonnet|opus | low|medium|high |
  | spec | ja|nein | haiku|sonnet|opus | low|medium|high |
  | impl | ja | haiku|sonnet|opus | low|medium|high |
  | review | ja | haiku|sonnet|opus | low|medium|high |
  <!-- ai-phase-routing:END -->
  ```
  - **The routing table is the ONE control mechanism for all following phases** (ADR-0004,
    consistently analysis-driven): the Run column = phase trigger (UX label, spec skip),
    Model+Effort = phase setup. For `Run: nein` (no), set model/effort to `-`.
  - **Mandatory values:** `impl` and `review` ALWAYS run (`Run: ja` [yes] — review is the
    merge gate). `ux` runs when there's UI relevance; `spec` is skipped only for issues **without
    application code** (justify then in the analysis block under "Umsetzungskontext").
  - The table and analysis block belong together: on re-triage, rewrite BOTH.
    ASCII without umlauts/typographic quotes — the table is parsed by machine.
  - `stand` = ISO-8601 UTC, reset on **every** write: `date -u +%Y-%m-%dT%H:%M:%SZ`.
  - Write via `gh issue edit <nr> --body-file -` with a heredoc.

## Step 4b — Short ping comment

One **short ping comment** per run (`gh issue comment`), written in German:

- 1 sentence noting that the analysis is in the description.
- **Only if open questions exist:** address the issue author with `@<issue-author>` and attach the open questions as a list.

**Manual/local runs only.** In the CI pipeline the phase prompt overrides this step with its NO-ping rule (body block + label are the complete communication there) — post nothing.

## Step 5 — Label (`ai:analysed`; for a clear 🟢 analysis, also the phase trigger)

- Set the `ai:analysed` label: `gh issue edit <nr> --add-label "ai:analysed"`
- **Ambiguous task → `ai:needs-human` instead of a guessed analysis.** Post **exactly one** comment (in German) whose first line is exactly `<!-- ai-triage-decision -->`, followed by **what needs to be decided / options / recommendation**.
- **Phase trigger based on the traffic light:**
  - **🟢 green →** also set the follow-up trigger — per the routing table:
    `ux: ja` (yes) → `ai:needs-ux-ui`; otherwise `spec: ja` (yes) → `ai:needs-spec`; otherwise — if the
    `spec` row says `nein` (no) (issue without application code) — go directly to `ai:needs-impl`.
  - **🟡 yellow / 🔴 red →** set **no** phase trigger. If an issue already carries a phase trigger during **re-triage**, **remove it automatically**.

## Step 6 — Autonomous closing (when requirements are already met)

After step 5, the AI checks exactly **one** criterion:

> **Are the requirements described in the issue already fully implemented in the codebase?**

If this criterion is clearly met and a concrete piece of evidence (commit SHA, PR number, or file/line) exists, the issue is closed.

**Procedure when met** (comment text stays German):

```sh
gh issue comment <nr> --body-file - <<'CLOSE'
Die im Ticket beschriebenen Anforderungen sind bereits erfüllt.

Beleg: <Commit-SHA / PR-Nr. / Datei+Zeile>
CLOSE

gh issue close <nr> --reason "completed"
```

**Safety net:** Only close if **concrete evidence** exists — never close based on assumptions.

## Notes

- Steps 2, 3, 4, 4b, and 5 write **publicly** to GitHub — get confirmation before executing, especially for batch processing.
- **Never commit production code**; triage means only analysis, copyediting, optional splitting, the analysis block in the body, the ping comment, and labeling.
