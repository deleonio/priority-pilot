---
name: ticket-coordination
description: "Ticket coordination with one mission: make the app ready for market (stability, payment, invoices, onboarding; no unnecessary features) - agree focus and implementation order with the author in a start dialog, then drive the issues of an epic through the label pipeline (independent ones in parallel, dependent ones after their blocker): start analysis, act as PO after triage (set ux/spec/impl), watch PRs, unblock stuck phases, keep main green, start the next issue after merge; can hand issue watching and diagnosis to subagents. Use for 'koordiniere Epic #N', 'arbeite Epic #N ab', 'manage die Abarbeitung' (German: coordinate the processing of issues)."
argument-hint: "[Epic-/Issue-Nummern oder Themen; leer = Startdialog klaert den Fokus]"
---

# Workflow: Ticket coordination

Auftrag: $ARGUMENTS

The coordinator does not write product code. It moves issues through the pipeline by setting
labels, reads the phase outputs, decides as PO where the pipeline asks for it, and removes
blockers. Scope is **exactly** what the start dialog (section 0) agreed with the author — nothing
else from the backlog. When the author names themes instead of epics (e.g. "payment, onboarding,
store"), map each theme to its leaf issues across all epics (titles carry `[P-Stufe/Aufwand]`,
epics carry rank tables), order by theme first, then rank, and list the mapping in the first
report so the author can correct it. A "max. N parallel" limit counts every issue with a phase
running or queued — triage and UX included — not PRs the author drives themselves, not
containers in their closing analysis and not items parked on the author. Starting a new issue
needs a free slot even when its phase has its own queue.

## Mission: ready for market

Above every single ticket stands one goal: make the app ready for live and for the market. A
rounded, stable product beats more features. Every decision on order, scope and new tickets is
measured against it:

- **In focus:** stability (main green, no data loss, no silent errors), payment and plans
  (subscribe, upgrade, downgrade, cancel, refunds), clean invoices, sign-up and onboarding
  (first start, empty states, legal texts and consent), and market fitness: what a paying
  stranger needs to trust and use the app.
- **Out of focus:** new features that are not needed to bring the app to market. They wait
  until after go-live; say so when ordering, do not drop them silently. The author can pull one
  forward explicitly — then it is in focus.
- **Proactive gap checks:** do not wait for tickets to exist. When a focus area has no open
  tickets or the author doubts it works, run an audit through a subagent (flows walked end to
  end in code, existing tests run, suspected bugs proven with a throwaway test that is never
  committed; nothing pushed), show
  the ranked findings and the product decisions they need, and create tickets only after the
  author's release.
- **Ticket test:** for each issue ask "is the app worse at market launch without it?" Yes →
  focus order; no → after go-live.

Note: this file's prose is English; everything addressed to the author (chat, issue comments)
stays German and follows the [vermenschlichen](../vermenschlichen/SKILL.md) rules. Label chain and
phases: [Pipeline-Flow](../../../docs/pipeline-flow.md).

## 0. Start dialog

Never start labelling right after the call. First agree on focus and order with the author:

1. **Focus.** Confirm the epics, issues or themes the call names; ask only when it names nothing
   or "alles" — then propose a focused set from the mission's focus areas — open issues mapped to
   them, nearly finished containers (section 1, item 6), anything repairing main — and let the
   author pick. Name what stays out (features after go-live) and why.
2. **Frame.** Ask once for the parallel limit, tickets not to touch (manual, the author's own,
   pipeline or workflow tickets), and how often to report. Offer defaults so one answer suffices.
3. **Order proposal.** Build the order per section 1 and show it as a table: position, issue
   with `[stage/effort]` title prefix, blocker, first phase (analysis, UX, spec, implementation),
   open questions. Put parked questions in a separate list and offer a decision round
   (section 2a) before the start, so the queue does not stall on them.
4. **Fine-tune.** Let the author move, drop or add issues and repeat the table until they
   confirm. Only then set the first trigger.
5. **Record.** Post the agreed focus, order and limits as a PO comment on the epic (or the first
   issue) and carry them in every check-in message.
6. **Re-tune.** When the author changes priorities or limits mid-run, show the updated table
   once and continue only after confirmation; running phases keep running.

## 1. Plan the order

1. Read the epic body (waves, critical path, rank table) and its sub-issues with state and
   labels. Trees can be three-level (epic → `Gruppe:` issues → leaves): collect the leaves
   through the groups; epic and groups are containers, not work items.
2. Per open sub-issue check the native `blocked-by` relations **and** the "Blockiert durch" line
   in the body — they can point into another epic (cross-epic dependency).
3. Never label containers — epics ("Nicht in die Pipeline geben") and group tickets titled
   `Gruppe:` ("Sammelticket (Gruppe)") — except for their closing analysis (section 2, "All
   sub-issues of a container (epic or group) closed"). Never label tickets titled `Manuell:` or marked "Aufgabe für den PO", tickets
   marked "zurückgestellt".
4. A manual ticket on the critical path blocks everything behind it. Ask the author at once (one
   question, concrete options) instead of waiting silently.
5. Priority and effort are part of every leaf issue: the title prefix `[P0/M]` (stage / effort)
   and the body line `Priorität: <Stufe> · Rang <r> von <n>. Aufwand: <S|M|L> (…)`. The epic's
   rank table is the source of truth; the title prefix is the shortcut that survives every list
   view and search.
6. Order: waves decide startability, rank decides importance. Phases queue first in, first out
   per concurrency group; which phases share a group is described in
   [CI-Architektur](../../../docs/ci-architecture.md) (at the time of writing: spec,
   implementation and fixup share one queue; triage, UX, review and documentation each have
   their own). **Start leaves whose blockers are closed, highest rank first**, and keep a
   working set of at most four issues in flight (the author may set a different limit) — do not
   start a lower-ranked leaf while a higher-ranked startable one is still unlabelled.
   **Containers come first, before rank:** a container (epic or group) whose sub-issues are all
   closed gets its closing analysis at once — it surfaces important new sub-issues early or
   closes the container. A nearly finished container (one or two startable leaves left) moves
   those leaves to the front of the order, so the container leaves the work chain. Scan all
   containers in scope for both at each check-in and after each merge. Issues
   without dependencies on each other run in parallel; the queues serialise what has to wait.
   Only dependent issues wait for their blocker's merge. A run shown as "pending" is queued, not
   stuck — never re-arm it. Name stage and effort (title prefix) whenever a check-in or decision
   reports what was started or what comes next — the author thinks in „wie wichtig, wie viel
   Kraft".

## 2. Drive one issue

| Situation | Action |
| --- | --- |
| Next issue is free (all blockers closed) | set `ai:needs-analyse` |
| `ai:needs-po-review` present, or a fresh KI-ANALYSE without it (sub-issues of a split carry only `ai:analysed`) | read KI-ANALYSE (Ampel, Offene Fragen) and the `ai-phase-routing` table; set the **first** phase with Run = ja: ux → `ai:needs-ux-ui`, else spec → `ai:needs-spec`, else `ai:needs-impl` |
| Analysis has open questions or 🟡/🔴 | put the question to the author with the options from the analysis; do not route. Parser false alarms (constraints listed as questions) you clear yourself with a comment. A `<!-- ai-triage-decision -->` comment with `ai:needs-human` is the same case before any analysis: after the answer post it as a PO comment, then set `ai:analysed` + `ai:needs-analyse` without `ai:needs-human` |
| `ai:needs-human` after a phase | read the run log first (section 4, item 3); only a real open question goes to the author — at once, in the same turn, as multiple choice (section 2a) |
| `ai:continued` on the issue | soft abort at the time limit, the next run resumes — wait. A second run without push ends the attempt: section 7, rung 3 |
| PR of the issue appears | subscribe to its activity immediately |
| `ai:needs-human` on the PR | read the stop comment; fix small causes yourself (base merge, re-review), otherwise ask the author |
| PR has a merge conflict (`mergeable_state: dirty`) | check every open PR of the epic at each check-in and after each merge to main. No phase **running** on the branch → hand the resolution to a subagent at once (section 6, one per PR, in parallel), even if a fixup is merely queued or crashed — waiting for the queue costs hours when phases stall. Never re-arm `ai:needs-fixup` on a conflicting PR: GitHub starts no `pull_request` workflow while the PR conflicts, and every re-set counts toward the fixup round cap. Phase running → wait for its end; the fixup run merges main before it starts and resolves the markers itself, so give it the resolution rule as an inline review comment on the conflicting file (it reads review threads, not plain PR comments). After the subagent's push: if the PR already had a green verdict, re-arm `ai:needs-review`; an attached `ai:needs-fixup` stays (its findings are still open). A conflict that needs a product decision goes to the author |
| Author comments as PO on a PR or issue | apply at once (ticket body, ADR, labels), adjust dependent tickets |
| PR merged, issue closed | check main CI, start the next issue in the same turn |
| All sub-issues of a container (epic or group) closed | a container always gets at least one closing analysis — something new may have come up. Check the merged PRs for named follow-up work that no ticket covers and post it as a PO comment on the container, then set `ai:analysed` + `ai:needs-analyse` on it — at once, in the same turn the last sub-issue closes, outside the parallel-ticket limit: new important issues surface early, a finished container leaves the work chain fast. The analysis emits its result as the `ai-container-result` marker and the workflow acts on it itself: the post-step creates the new sub-issues from it (title with priority prefix, template body, native `blockedBy`), links them under the container, or closes the container with the analysis' reason — drive new sub-issues like any other; when they close, the container gets its next closing analysis. Manually only as reserve, when the run could not act (no marker or failed post-step — the run log warns; the analysis' draft comment is the template): create the drafts with their priority prefix, link them under the container (`POST repos/{owner}/{repo}/issues/<container>/sub_issues` with the issue's numeric id — not its number — as `sub_issue_id`), start them like any other leaf, or close the container with the analysis' evidence. A remaining `ai:needs-human` on the container is a real stop — read the run log, never drop it. Never close a container on your own judgement |

Label write rules:

- An issue update replaces the **whole** label set. Always carry `ai:analysed` along; drop
  only the consumed trigger (`ai:needs-po-review`).
- Never remove `ai:analysed` — removing it starts a re-triage.
- Re-arming a trigger that is still attached needs two writes: first without it, then with it.
  Adding an already present label fires no event.
- Label names are exact (`ai:needs-ux-ui`, not `ai:needs-ux`). A write with an unknown name
  silently creates that label and starts nothing. After every trigger write check within a
  minute that the phase run did not end `skipped` (a `skipped` run means a wrong label name).

Record every PO decision as a comment on the epic or issue (with the attribution footer), so the
pipeline and later readers see it.

## 2a. Decision round with the author

When everything startable waits on the author, do not idle and do not list the questions in one
wall of text — offer a decision round and go through the parked issues one by one:

1. Order by leverage: an answer that frees other issues (blocked sub-issues) first, then rank.
2. Per issue put the triage questions as multiple choice (at most four per round), the
   analysis' recommendation first; split longer lists into at most two rounds.
3. Post the answers as a `PO-Entscheidung (Autor)` comment that restates each decision as a full
   sentence (the next phase reads only the comment), then set `ai:analysed` + `ai:needs-analyse`
   without `ai:needs-human`. Whatever is still open after two rounds is decided by the
   analysis' recommendation and named as such in the chat.
4. An answer that rejects the ticket's premise is not a rejected option: offer close
   (`not_planned`, reason as comment), reshape or park. Reshape means rewriting the body
   ("Wie soll es sein?", measures) and the title, plus a PO comment with the reason; a
   product principle behind it (e.g. "no plan on time without consent") goes into the matching
   ADR and is checked against sibling tickets at once.
5. A blocker placeholder in the body (`#BLOCKER_…`) is resolved from the native `blocked-by`
   relation; fix the body line instead of asking.
6. A follow-up question that the analysis itself marks as not blocking, with a stated
   assumption: confirm the assumption with the author, comment on the container and the affected
   sub-issue, drop `ai:needs-human` — no re-analysis; then route like after triage (UX, spec or
   implementation).

## 3. Cadence

- React to PR events at once; use scheduled check-ins as fallback with the cadence the author
  asks for. Replace the pending check-in instead of stacking a second one.
- Issue phases (triage, UX, a spec run before its draft PR) send no events to the coordinator,
  only PR activity does. While any issue in flight sits in such a phase, check in every
  ~15 minutes, otherwise a finished analysis waits unrouted until the next check-in. Only when
  everything in flight has a subscribed PR can the fallback stretch to ~50 minutes.
- **Schedule the next check-in before asking the author.** A pending question blocks the
  session; without a scheduled wake-up the whole coordination stalls until the answer.
- The check-in message carries **state only**; the rules live here. Template:
  `Check-in ticket-coordination (Skill). Epics: … Stand <UTC>: <je Issue: [Stufe/Aufwand]-Kürzel aus dem Titel, Phase, PR, Run-ID, was als Nächstes zu prüfen ist>. Offen beim Autor: … Reihenfolge danach (mit Rang): … Nicht anfassen: …`
- Spec, implementation and fixup share one serialized queue; only triage, UX and review run
  side by side — order the queue per section 7, rung 1.
- Report only on change (phase switch, merge, blocker, question). A quiet check-in stays quiet.
- Notifications can arrive late, twice, or after the fact. Verify the current state before
  acting on one.
- A question the author dismissed is not asked again. It stays under "Offen beim Autor" in the
  check-in until the author answers on their own; the issue waits, the rest goes on.

## 4. Pitfalls

1. **Merged without CI.** A PR can merge while its verify runs were skipped or cancelled. After
   each merge look at the main CI; a red main makes every following PR red. Fix main first
   (own small PR from a fresh branch off main), then re-run the blocked PR (base merge,
   `ai:needs-human` off, `ai:needs-review` on).
2. **"Flake" verdicts.** A fixup that calls a red job a flake and stops at `ai:needs-human`
   without a push has not found the cause. Check whether the same test is red on main and
   reproduce it; state-dependent tests (shared test data within a shard) look like flakes.
   Real infrastructure failures have a signature in the log (dev server crash, `connection
   refused` from one test on until the shard ends): re-run the failed jobs once, record the
   signature in a ticket, never send the PR into fixup for it. A new UI element (an extra
   select, a second dialog) that breaks a foreign e2e locator is the PR's own fault, not a flake:
   post the CI cause as an inline thread on the touched file so the fixup reads it.
3. **Phase ended without a usable result.** Four forms:
   - No verdict, no branch, no PR, trigger still attached → re-arm the trigger once (remove,
     add). A second failure goes to the author with the cause from the run log.
   - `ai:needs-human` although the work is done: the agent could not write its result (blocked
     tool or file access), wrote a wrong verdict token (e.g. `URTEIL:` instead of the expected
     one) or the label step itself crashed, so no reason comment exists. Read the
     agent's final output in the run log; if it has no real open question, post its result as an
     issue comment and set the next phase. If it has open questions, they exist only there:
     take them from the log and ask the author.
   - A phase reports success but its block is missing (seen with UX: the block write was
     denied, the verdict still passed and the next phase started without the input). After
     every UX run check that its block is in the harness comment. Spec and implementation read
     the UX result only from there, a plain PO comment does not reach them. If it is missing:
     take the next phase's trigger off (only while that phase has not started), write the run
     log's final output as the block between the UX markers of the harness comment, then set
     the trigger again. If the next phase already ran, check the PR against the UX result and
     post every gap as an inline review thread, so the fixup picks it up.
   - Triage finds the ticket already fulfilled (typical after the blocker's PR covered it): it
     posts the evidence as a plain comment, the run ends red and `ai:needs-analyse` stays. Check
     the evidence (file:line, tests), close the issue as completed with a short PO comment, drop
     the label; hardening points it lists become a ticket proposal to the author.
4. **Late pushes miss the merge.** The gate merges the reviewed head. A commit pushed after the
   green review may not be in main — check the merged commit and bring the rest in a new PR.
5. **Optional review nits on own PRs.** Reply and resolve; do not push only for a nit — the push
   resets review and CI. Nits that reveal a product gap (feature built but invisible, cost
   without benefit) are not nits for the epic: see "All sub-issues of a container (epic or group) closed" above.
6. **Misleading titles.** "Frontend: …" can need server work. Trust the analysis, not the title.
7. **Check the practice before calling a rule violation.** A rule in the docs can contradict
   what dozens of files do; then the rule is the finding, not the file.
8. **Merged branches.** A branch whose PR is merged is finished; restart it from main before new
   work instead of stacking on merged history.
9. **List views lie about merges.** A PR list can show `merged: false` for merged PRs; the issue's
   `closed_by_pull_requests` and state are reliable.
10. **Tooling outages.** When the GitHub connection fails ("temporarily unavailable"), wait and
    retry; do not switch to unauthenticated web reads for decisions, they are rate limited and
    incomplete.
11. **Scope creep.** Found problems outside the epics (flaky tests, rule gaps) become a proposal
    to the author or a new ticket after asking — never an unannounced pipeline start.
12. **Stale base.** A PR branched before a related merge can pass its own CI and still break
    main. When two PRs of the epic touch the same files, merge main into a local copy of the
    later one and run the affected package tests before its gate merge.
13. **Pushes into a running phase.** A phase run works on the branch state from its start. A
    push to that branch meanwhile (also a base merge) can make its push fail or land on top
    unseen. Do not push while a phase runs on the branch; when it happened, check the head
    after the run (own commit present, on top of the foreign one) before routing on.
14. **Stale `ai:needs-human` after an answered triage question.** When the author answers the
    triage question, the re-triage writes a final KI-ANALYSE (no open questions) and adds
    `ai:needs-po-review`, but the old `ai:needs-human` can stay. Both together mean "ready to
    route", not "blocked": check the analysis timestamp is after the answer, then route and drop
    `ai:needs-human` in the same write.
15. **Two tickets, one shared building block.** When two analyses each plan the same piece (a
    model, a check function), an issue comment alone does not reach the later phases: spec and
    implementation work from the spec document and the PR. Post the directive on both issues
    before the spec, then — as soon as the first spec fixes names — post the identical contract
    (model name, file, fields, function signature) on both draft PRs before their implementation
    starts. Check the implementation diff against it; a deviation is a blocking PO comment on
    the PR before the review, so the review sends it into fixup.

16. **Provider quota exhausted.** A phase crash with `429 [1310] ... Limit Exhausted. Your limit will
    reset at <time>` stops every LLM phase (spec, implementation, fixup, review). The reset time
    is in the provider's zone (UTC+8 — the request ID starts with the provider's local
    timestamp). Do not re-arm before the reset, every attempt burns a run and adds an
    `ai:needs-human`; schedule one check-in shortly after the reset and re-arm all crashed
    triggers then. Work that needs no pipeline LLM (conflict subagent, label fixes) goes on.
17. **Fixing a finding on your own PR yourself.** Swap `ai:needs-fixup` for `ai:needs-review` in
    the same step (else the pipeline fixup runs on the branch in parallel) and post the proof
    as an `<!-- ai-fixup-decisions -->` comment with the fixed-findings table; a thread reply
    alone lets the re-review end in a false `ai:needs-human`.
18. **Blocker merged → automatic re-triage.** When a blocker's PR merges, the pipeline itself sets
    `ai:needs-analyse` on the blocked issue. Do not route it before that run ends: the re-triage
    rewrites the label set and drops your trigger. Post PO notes on the issue right away — the
    re-triage works them into the analysis — and route on its `ai:needs-po-review`. This only
    happens for issues that were already analysed; a never-analysed issue needs your
    `ai:needs-analyse`.
19. **PO decisions for a fixup.** The fixup reads review threads, not plain PR comments: answer
    in the thread of the finding itself, also when correcting an earlier decision. Before
    deciding a new mandatory UI field, check the e2e create flows that would hit it; prefer a
    preselected default over a hard requirement (one such decision broke ~60 specs).
20. **Dead self-hosted runner.** Runs stay `queued` with the runner's label, a job without a log
    means the runner died mid-job. Only the author can switch the runner variable; then cancel
    the queued runs (force-cancel stragglers) and re-arm every affected trigger with two writes.
21. **Never re-run an old main run.** Concurrency cancels the newer main run in favour of the
    re-run; re-run only the latest one.
22. **Literal file paths as comment bodies.** A phase comment that reads `@/tmp/<file>.md` was
    posted with `-f body=@…` (raw string); the content is lost. The verdict label still counts;
    report the skill gap instead of re-running the phase.
23. **Phase killed at the job timeout.** A runtime without soft abort runs into the hard job
    timeout without pushing: run conclusion `cancelled`, orphan processes in the log, no
    `ai:continued`, the trigger still attached. After the second such run on the same issue do
    not re-arm: propose a split to the author (two or three leaves with a `blocked-by` chain,
    the issue becomes their container, its draft PR is closed).

24. **Fixup round cap without open findings.** The cap comment lists only fixed findings and the
    last review was green: the `ai:needs-fixup` came from the conflict detector, not from the
    review. Resolve the conflict (section 2), then decide option F.1 yourself — swap
    `ai:needs-human` for `ai:needs-review` with a short PO comment. A cap with open findings
    stays with the author.

## 5. Tool notes

- PR labels come from the PR read; the issue read does not resolve PR numbers.
- Workflow run lists: filter main CI by branch only; an extra event filter has returned stale runs.
- Large list results: read the saved file with `jq` instead of paging through it.
- Run logs: fetch the download link, then search it (`grep` for the error, the verdict line,
  the first failing test) instead of loading the whole log.

## 6. Delegating to subagents

The coordinator keeps everything that needs judgement or the author: order, PO routing,
questions, new tickets, the check-in chain. Reading and diagnosis — the context-heavy part — can
go to subagents, one per issue or PR in flight, so several issues and phases are watched at the
same time without flooding the coordinator's context.

**Brief** (self-contained, a subagent sees nothing of this conversation): issue and PR number,
current phase and run ID, what changed since the last look, the question to answer, and what it
may do. Existing agents fit many briefs: `gate-runner` for failing runs and log triage,
`recherche` for code questions (does the PR base miss a related merge, does an analysis match the
code).

**May do:** read issues, PRs, comments, run lists and logs; reproduce a failure locally in a
separate worktree; re-run failed jobs once for a documented infrastructure signature.

**Must not do:** set or remove pipeline labels, comment, push, create tickets, ask the author.
It returns a proposal, the coordinator acts on it.

**Exception — merge conflicts:** a conflict subagent works in its own worktree and may push one
merge commit to the PR branch: merge main into the branch (never rebase, amend or force-push),
keep both sides' behaviour, regenerate lockfiles and generated files with the repo tooling, run
the canonical gate for the touched packages, and push only when it is green and no phase runs on
the branch (pitfall 13). If keeping both sides needs a product decision, it pushes nothing and
reports the conflict. Labels and comments stay with the coordinator.

**Report** (short, fixed shape): state (phase, PR head, CI), finding with evidence (log line,
file:line), proposed action (exact label set or comment text), and whether the author is needed.

Fits: diagnosing a red CI or an `ai:needs-human` stop while another issue is being routed;
checking all PRs of an epic for follow-up work before its closing analysis; a test merge
against main; resolving a merge conflict (exception above). Does not fit: anything that only needs one label read — do that directly.

## 7. When the pipeline stalls — the way out

Re-arming what just failed is not coordination. Try each rung once; a second failure on the same
rung moves one rung up — never re-arm the same trigger a third time.

1. **Order the shared queue.** Spec, implementation and fixup share one queue, so parallel slots
   there are an illusion: keep at most one issue in that queue, the others work in triage, UX or
   review. Priority: repairs main → fixups (short, end in a merge) → continuations → new
   implementations. To reorder, take the trigger off the waiting issue (its queued run then
   skips) and put it back once the queue is free; never cancel a running phase.
2. **Spot a slow provider early.** Signs: a small (S) issue without push after a full run,
   several soft aborts the same day, crashes without verdict, triage at its time limit. Then
   start no new implementations; tell the author once with the evidence (run IDs, durations)
   and offer the provider switch — their decision.
3. **Two runs without push → stop.** A second soft abort, crash or infrastructure failure on
   the same issue ends the pipeline attempt (a repeated soft abort is marked
   `ai:to-big-issue`). By size:
   - small and clear (S, test or config, no product decision): ask the author to release it for
     a local implementation — a subagent in its own worktree, canonical gate, PR with
     `Closes #N`, no labels. Once the PR exists, drop the stop labels from the issue and set
     `ai:needs-review` on the PR.
   - medium or unclear: propose a split (pitfall 23).
   - waiting on a decision: ask the author.
4. **Infrastructure failures** (environment setup timeout, installer exit, runner loss): re-arm
   once and note the signature; a second one the same day goes to the author as an
   infrastructure finding, not into more re-arms.
5. **Park what will not move.** When rungs 3 and 4 are spent and the next step is neither a
   split nor a local implementation, set `ai:needs-human` with one sentence on the cause and
   the decision needed (as a comment on the issue or PR), list it in the report and take it off
   the slot count — the slot goes to the next startable issue. Do not touch parked items again
   until the author answers.
6. **Report throughput, not only state.** When the queue holds more than two runs or no merge
   landed for two hours, tell the author once — cause, queue, the rungs above with a
   recommendation — before the next re-arm. While only long runs are in flight, schedule the
   check-in at their time limit instead of every few minutes.
