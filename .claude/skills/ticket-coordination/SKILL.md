---
name: ticket-coordination
description: "Ticket coordination - drive the issues of an epic one after the other through the label pipeline: start analysis, act as PO after triage (set ux/spec/impl), watch PRs, unblock stuck phases, keep main green, start the next issue after merge; can hand issue watching and diagnosis to subagents. Use for 'koordiniere Epic #N', 'arbeite Epic #N ab', 'manage die Abarbeitung' (German: coordinate the processing of issues)."
argument-hint: "<Epic-Nummer(n) in Reihenfolge, z. B. #1789 #1780>"
---

# Workflow: Ticket coordination

Auftrag: $ARGUMENTS

The coordinator does not write product code. It moves issues through the pipeline by setting
labels, reads the phase outputs, decides as PO where the pipeline asks for it, and removes
blockers. Scope is **exactly** the epics named by the author, in the given order — nothing else
from the backlog.

Note: this file's prose is English; everything addressed to the author (chat, issue comments)
stays German and follows the [vermenschlichen](../vermenschlichen/SKILL.md) rules. Label chain and
phases: [Pipeline-Flow](../../../docs/pipeline-flow.md).

## 1. Plan the order

1. Read the epic body (waves, critical path) and its sub-issues with state and labels.
2. Per open sub-issue check the native `blocked-by` relations **and** the "Blockiert durch" line
   in the body — they can point into another epic (cross-epic dependency).
3. Never label: the epic itself ("Nicht in die Pipeline geben"), tickets titled `Manuell:` or
   marked "Aufgabe für den PO", tickets marked "zurückgestellt".
4. A manual ticket on the critical path blocks everything behind it. Ask the author at once (one
   question, concrete options) instead of waiting silently.
5. Order: follow the waves. Phases queue first in, first out per concurrency group; which
   phases share a group is described in [CI-Architektur](../../../docs/ci-architecture.md) (at
   the time of writing: spec, implementation and fixup share one queue; triage, UX, review and
   documentation each have their own). So one issue can be analysed or reviewed while another is
   implemented — keep one issue per shared queue in flight plus the next one in analysis, not
   more. A run shown as "pending" is queued, not stuck — never re-arm it.

## 2. Drive one issue

| Situation | Action |
| --- | --- |
| Next issue is free (all blockers closed) | set `ai:needs-analyse` |
| `ai:needs-po-review` present | read KI-ANALYSE (Ampel, Offene Fragen) and the `ai-phase-routing` table; set the **first** phase with Run = ja: ux → `ai:needs-ux-ui`, else spec → `ai:needs-spec`, else `ai:needs-impl` |
| Analysis has open questions or 🟡/🔴 | put the question to the author with the options from the analysis; do not route. Parser false alarms (constraints listed as questions) you clear yourself with a comment |
| `ai:needs-human` after a phase | read the run log first (section 4, item 3); only a real open question goes to the author |
| `ai:continued` on the issue | soft abort at the time limit, the next run resumes — wait. A second run without push is a finding |
| PR of the issue appears | subscribe to its activity immediately |
| `ai:needs-human` on the PR | read the stop comment; fix small causes yourself (base merge, re-review), otherwise ask the author |
| Author comments as PO on a PR or issue | apply at once (ticket body, ADR, labels), adjust dependent tickets |
| PR merged, issue closed | check main CI, start the next issue in the same turn |
| All sub-issues of an epic closed | check the merged PRs for named follow-up work that no ticket covers; ask the author about a follow-up ticket. Never close the epic yourself |

Label write rules:

- An issue update replaces the **whole** label set. Always carry `ai:analysed` and `ai:model:*`
  along; drop only the consumed trigger (`ai:needs-po-review`).
- Never remove `ai:analysed` — removing it starts a re-triage.
- Re-arming a trigger that is still attached needs two writes: first without it, then with it.
  Adding an already present label fires no event.

Record every PO decision as a comment on the epic or issue (with the attribution footer), so the
pipeline and later readers see it.

## 3. Cadence

- React to PR events at once; use scheduled check-ins as fallback with the cadence the author
  asks for. Replace the pending check-in instead of stacking a second one.
- **Schedule the next check-in before asking the author.** A pending question blocks the
  session; without a scheduled wake-up the whole coordination stalls until the answer.
- The check-in message carries **state only**; the rules live here. Template:
  `Check-in ticket-coordination (Skill). Epics: … Stand <UTC>: <je Issue: Phase, PR, Run-ID, was als Nächstes zu prüfen ist>. Offen beim Autor: … Reihenfolge danach: … Nicht anfassen: …`
- Report only on change (phase switch, merge, blocker, question). A quiet check-in stays quiet.
- Notifications can arrive late, twice, or after the fact. Verify the current state before
  acting on one.

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
   signature in a ticket, never send the PR into fixup for it.
3. **Phase ended without a usable result.** Two forms:
   - No verdict, no branch, no PR, trigger still attached → re-arm the trigger once (remove,
     add). A second failure goes to the author with the cause from the run log.
   - `ai:needs-human` although the work is done: the agent could not write its result (blocked
     tool or file access) or the label step itself crashed, so no reason comment exists. Read the
     agent's final output in the run log; if it has no real open question, post its result as an
     issue comment and set the next phase.
4. **Late pushes miss the merge.** The gate merges the reviewed head. A commit pushed after the
   green review may not be in main — check the merged commit and bring the rest in a new PR.
5. **Optional review nits on own PRs.** Reply and resolve; do not push only for a nit — the push
   resets review and CI. Nits that reveal a product gap (feature built but invisible, cost
   without benefit) are not nits for the epic: see "All sub-issues closed" above.
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

**Report** (short, fixed shape): state (phase, PR head, CI), finding with evidence (log line,
file:line), proposed action (exact label set or comment text), and whether the author is needed.

Fits: diagnosing a red CI or an `ai:needs-human` stop while another issue is being routed;
checking all PRs of an epic for follow-up work before asking about closing it; a test merge
against main. Does not fit: anything that only needs one label read — do that directly.
