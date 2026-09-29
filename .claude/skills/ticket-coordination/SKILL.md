---
name: ticket-coordination
description: "Ticket coordination - drive the issues of an epic one after the other through the label pipeline: start analysis, act as PO after triage (set ux/spec/impl), watch PRs, unblock stuck phases, keep main green, start the next issue after merge. Use for 'koordiniere Epic #N', 'arbeite Epic #N ab', 'manage die Abarbeitung' (German: coordinate the processing of issues)."
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
5. Order: follow the waves, **one issue at a time** per epic. A small, independent issue that is
   already analysed may run alongside; do not start new side work.

## 2. Drive one issue

| Situation | Action |
| --- | --- |
| Next issue is free (all blockers closed) | set `ai:needs-analyse` |
| `ai:needs-po-review` present | read KI-ANALYSE (Ampel, Offene Fragen) and the `ai-phase-routing` table; set the **first** phase with Run = ja: ux → `ai:needs-ux-ui`, else spec → `ai:needs-spec`, else `ai:needs-impl` |
| Analysis has open questions or 🟡/🔴 | put the question to the author with the options from the analysis; do not route |
| `ai:needs-human` on the issue (triage decision) | summarise options + recommendation for the author; after the answer post the decision as issue comment, then route or park |
| PR of the issue appears | subscribe to its activity immediately |
| `ai:needs-human` on the PR | read the stop comment; fix small causes yourself (base merge, re-review), otherwise ask the author |
| PR merged, issue closed | start the next issue in the same turn |

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
- Write each check-in message self-contained: current issue, its phase, the remaining order,
  open author questions. It is the only memory the next wake-up has.
- Report only on change (phase switch, merge, blocker, question). A quiet check-in stays quiet.

## 4. Pitfalls

1. **Merged without CI.** A PR can merge while its verify runs were skipped or cancelled. After
   each merge look at the main CI; a red main makes every following PR red. Fix main first
   (own small PR from a fresh branch off main), then re-run the blocked PR (base merge,
   `ai:needs-human` off, `ai:needs-review` on).
2. **"Flake" verdicts.** A fixup that calls a red job a flake and stops at `ai:needs-human`
   without a push has not found the cause. Check whether the same test is red on main and
   reproduce it; state-dependent tests (shared test data within a shard) look like flakes.
3. **Phase ended without result.** Run green or red, but no verdict, no branch, no PR, trigger
   label still attached → re-arm the trigger once (remove, add). A second failure goes to the
   author with the cause from the run log.
4. **Late pushes miss the merge.** The gate merges the reviewed head. A commit pushed after the
   green review may not be in main — check the merged commit and bring the rest in a new PR.
5. **Optional review nits on own PRs.** Reply and resolve; do not push only for a nit — the push
   resets review and CI.
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
