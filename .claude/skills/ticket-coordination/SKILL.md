---
name: ticket-coordination
description: "Ticket coordination with one mission: make the app ready for market (stability, payment, invoices, onboarding; no unnecessary features) - agree focus and implementation order with the author in a start dialog, then drive the issues of an epic through the label pipeline (independent ones in parallel, dependent ones after their blocker): start analysis, act as PO after triage (set ux/spec/impl), watch PRs, unblock stuck phases, keep main green, start the next issue after merge; can hand issue watching and diagnosis to subagents. Use for 'koordiniere Epic #N', 'arbeite Epic #N ab', 'manage die Abarbeitung' (German: coordinate the processing of issues)."
argument-hint: "[Epic-/Issue-Nummern oder Themen; leer = Startdialog klaert den Fokus]"
---

# Workflow: Ticket coordination

Auftrag: $ARGUMENTS

The coordinator writes no product code. It moves issues through the label pipeline, decides as PO
where the pipeline asks, and removes blockers. Prose here is English; everything to the author
(chat, issue comments) is **German** and follows [vermenschlichen](../vermenschlichen/SKILL.md).
Label chain: [Pipeline-Flow](../../../docs/pipeline-flow.md).

## Overview — read this first, then the whole file

1. **Mission** (below) decides what is in scope and in which order.
2. **§0 Start dialog:** agree focus, frame (parallel limit, untouchable tickets), order — before any label.
3. **§1 Order** → **§2 Drive one issue** (analysis → PO routing → PR → merge → next); **§2a** when everything waits on the author.
4. **§3 Cadence — binding:** *every round ends with the status block*, even quiet ones; a fixed
   progress report runs every 3 hours. This overrides every brevity rule (AGENTS.md, output style).
5. **§4 Pitfalls**, **§5 Tool notes**, **§6 Subagents** (diagnosis, conflicts), **§7 Stall ladder**.

Read the file completely before the first action (partial reads cost the status block once).

## Mission: ready for market

A stable, rounded product beats more features. Scope is **exactly** what §0 agreed.

- **In focus:** stability (main green, no data loss, no silent errors), payment and plans, clean
  invoices, sign-up and onboarding (empty states, legal texts, consent), what a paying stranger needs.
- **Out of focus:** features not needed at launch. They wait until after go-live (say so, don't drop silently); the author can pull one forward.
- **Ticket test:** is the app worse at launch without it? Yes → focus order.
- **Gap audit:** a focus area without tickets, or doubted by the author → subagent audit (flows
  walked in code, tests run, suspected bugs proven with a throwaway test, nothing pushed); show
  ranked findings, create tickets only after release.
- **Themes instead of epics:** map each theme to its leaf issues across all epics, order by theme
  then rank, list the mapping in the first report.
- **Parallel limit "max. N":** counts every issue with a phase running or queued (triage and UX
  included); not PRs the author drives, containers in closing analysis, or items parked on the author.

## 0. Start dialog

Never label right after the call.

1. **Focus:** confirm the named epics/issues/themes; if none or "alles", propose a set from the focus areas (nearly finished containers, repairs of main) and name what stays out.
2. **Frame:** ask once, with defaults: parallel limit, tickets not to touch (manual, the author's own, pipeline tickets), report cadence.
3. **Order:** table of position, issue with `[Stufe/Aufwand]`, blocker, first phase, open questions; parked questions in a separate list (offer §2a first).
4. Author adjusts until confirmed; only then set the first trigger.
5. Post focus, order and limits as a PO comment on the epic; carry them in every check-in.
6. When priorities change mid-run: show the new table once, continue after confirmation; running phases keep running.

## 1. Plan the order

1. Read the epic (waves, critical path, rank table) and its sub-issues; collect leaves through `Gruppe:` issues. Epics and groups are containers, not work items.
2. Check native `blocked-by` **and** the "Blockiert durch" line (may point into another epic).
3. **Never label:** containers (except their closing analysis), `Manuell:`/"Aufgabe für den PO" tickets, tickets marked "zurückgestellt". A manual ticket on the critical path: ask the author at once.
4. **Start order:** leaves with closed blockers, highest rank first; stay within the limit (default 4); don't start a lower rank while a higher startable one is unlabelled. Waves = startability, rank = importance.
5. **Containers first:** a container with all sub-issues closed gets its closing analysis at once (§2); a nearly finished one (1–2 startable leaves) moves those to the front. Scan at each check-in and after each merge.
6. Tickets the author files during the run go right after containers.
7. Spec, implementation and fixup share **one queue**; triage, UX, review run side by side. A "pending" run is queued, not stuck — never re-arm it.
8. Name stage and effort (title prefix) whenever reporting what started or comes next.

## 2. Drive one issue

| Situation | Action |
| --- | --- |
| Next issue free (blockers closed) | `ai:needs-analyse` |
| `ai:needs-po-review`, or fresh KI-ANALYSE without it | read Ampel, open questions and `ai-phase-routing`; set the **first** phase with Run = ja: ux → `ai:needs-ux-ui`, else spec → `ai:needs-spec`, else `ai:needs-impl` |
| Open questions or 🟡/🔴 | ask the author with the analysis' options; don't route. Parser false alarms: clear with a comment. `<!-- ai-triage-decision -->` + `ai:needs-human`: after the answer post it as PO comment, set `ai:analysed` + `ai:needs-analyse` without `ai:needs-human` |
| `ai:needs-human` after a phase | read the run log first (§4.3); only a real open question goes to the author — immediately, as multiple choice (§2a) |
| `ai:continued` | soft abort, next run resumes — wait. Second run without push: §7 rung 3 |
| PR appears | subscribe to its activity at once |
| `ai:needs-human` on the PR | read the stop comment; fix small causes (base merge, re-review), else ask |
| PR conflict (`mergeable_state: dirty`) | check every open PR at each check-in and after each merge. No phase **running** on the branch → conflict subagent at once (§6), even if a fixup is only queued. Never re-arm `ai:needs-fixup` on a conflicting PR (no workflow starts, rounds count). Phase running → wait; give it the resolution rule as an inline review comment (it reads threads, not PR comments). After the push: green verdict before → `ai:needs-review` again; attached `ai:needs-fixup` stays. Product decision needed → author |
| Author comments as PO | apply at once (body, ADR, labels), adjust dependents |
| PR merged | check main CI, start the next issue in the same turn |
| Container: all sub-issues closed | closing analysis, always: post named follow-up work as PO comment, set `ai:analysed` + `ai:needs-analyse` at once, outside the limit. The run emits the `ai-container-result` marker and the post-step creates sub-issues or closes it; reserve: create/close by hand from the run's draft (`POST …/issues/<container>/sub_issues` with the numeric id). `ai:needs-human` on the container is a real stop. Never close a container on your own judgement |

**Label writes:** an update replaces the **whole** set — always carry `ai:analysed`, drop only the consumed trigger. Never remove `ai:analysed` (starts re-triage). Re-arming an attached trigger = two writes (without, then with). Verify the name first (`GET …/labels/<name>`, 404 = wrong; unknown names silently create a label) and check within a minute that the run did not end `skipped`.

Record every PO decision as a comment (with attribution footer).

## 2a. Decision round

When everything startable waits on the author, go through the parked issues one by one:

1. Order by leverage (answers that free blocked issues first), then rank.
2. Per issue: multiple choice, at most four per round, the analysis' recommendation first; at most two rounds, the rest is decided by the recommendation and named as such.
3. Post answers as `PO-Entscheidung (Autor)` comment, each decision as a full sentence (the next phase reads only that), then `ai:analysed` + `ai:needs-analyse` without `ai:needs-human`.
4. An answer rejecting the premise: offer close (`not_planned`), reshape (new body and title, PO comment; product principle → matching ADR, check siblings) or park.
5. Blocker placeholder `#BLOCKER_…` in the body: resolve from the native relation, fix the line, don't ask.
6. A follow-up question the analysis marks non-blocking with an assumption: confirm with the author, comment on container and issue, drop `ai:needs-human` (no re-analysis), route as after triage.

## 3. Cadence and status block

**Triggers:** react to PR events at once. Phases without events (triage, UX, a spec before its draft PR) → check in every ~15 min; only when everything in flight has a subscribed PR, ~50 min. Replace the pending check-in, never stack. Schedule the next check-in **before** asking the author a question.

**Check-in message = state only** (rules live here): `Check-in ticket-coordination (Skill). Epics: … Stand <UTC>: <je Issue: [Stufe/Aufwand], Phase, PR, Run-ID, nächste Prüfung>. Erledigt-Basis (<n>): <Nummern>. Queue-Zusätze (<n>): <Nummern>. Offen beim Autor: … Reihenfolge danach (mit Rang): … Nicht anfassen: …` A finished container reads "Abschluss-Analyse starten", never "schließen".

**Every round ends with the status block** (quiet rounds included; query fresh, never from memory; nothing else around it):

1. `Fortschritt ████████░░ 80 % · Erledigt X/N (+n) · In Arbeit Y · Offen Z (davon W beim Autor)`
   N = every leaf the coordination owns (sub-issues of the containers incl. manual tickets, plus tickets added during the run; containers don't count). X+Y+Z = N, each leaf in exactly one: In Arbeit = phase label set/running or open PR; Offen = not started or waiting. Waiting on the author wins (Offen and W). Percent = X/N rounded, one bar step per 10 %, +n = merges since the last round.
2. Pace line: ▲ merge since last round · ▶ phases advanced, no merge · ⏸ nothing moved for two rounds (name the cause); plus merges in the last 3 h and minutes since the last merge.
3. Table `Status | Ticket | Thema | Aufwand | Phase/PR | seit`: in progress first, then waiting, done collapsed (count, latest numbers). ⚠️ when "seit" exceeds ~2× usual (triage/UX 20 min, spec 30, implementation 60, review 20) — pursue per §7.
4. One line on what the coordinator did, then the next check-in time.

**Status question** ("Status", "Stand", "Überblick", "was ist noch offen"): the full block over the whole queue, done leaves listed per row, then what waits on the author with links — never only the delta. Also after the coordination ended.

**Progress report** every 3 h (author may change), one recurring schedule set up once at the start: status block plus what finished since, next steps in order, open decisions. It also acts like a check-in.

**Empty queue → stop:** nothing in flight and everything startable waits on the author, §2a offered → cancel check-in and report schedule, send one push with the final block and open decisions. A new author message restarts.

Notifications can arrive late or twice — verify the state before acting. A dismissed question is not asked again; it stays under "Offen beim Autor".

## 4. Pitfalls

1. **Merged without CI:** verify runs may be skipped. After each merge check main CI; red main makes every PR red → fix main first (own small PR), then re-run the blocked PR (base merge, `ai:needs-human` off, `ai:needs-review` on). Never re-run an old main run (concurrency cancels the newer one).
2. **"Flake" verdicts:** a fixup that calls a job a flake and stops without a push found no cause. Compare with main, reproduce. State-dependent tests (shared data in a shard) look like flakes. Real infrastructure failures have a log signature (dev server crash, `connection refused` until shard end): re-run once, note the signature, no fixup. A new UI element breaking a foreign e2e locator is the PR's fault: post the cause as inline thread.
3. **Phase ended without usable result:**
   - no verdict/branch/PR, trigger attached → re-arm once; second failure → author with the log cause.
   - `ai:needs-human` though done (blocked write, wrong verdict token, label step crashed): read the final output in the log; no real question → post its result as comment, set the next phase; real questions exist only there → ask the author.
   - success but block missing (UX): after every UX run check the block in the harness comment. Missing → take the next trigger off (only if not started), write the log's output between the UX markers, set the trigger again; if already ran, post gaps as inline review threads.
   - triage finds the ticket fulfilled: it posts evidence, run red, `ai:needs-analyse` stays → verify (file:line, tests), close as completed with PO comment, drop the label; hardening points → proposal.
4. **Late pushes miss the merge:** the gate merges the reviewed head; check the merged commit, rest in a new PR.
5. **Optional nits on own PRs:** reply and resolve, no push (resets review/CI). Nits revealing a product gap belong to the container's closing analysis.
6. **Misleading titles:** trust the analysis. **Practice vs. rule:** if dozens of files contradict a docs rule, the rule is the finding.
7. **Merged branches** are finished; restart from main. **List views lie:** use `closed_by_pull_requests` and state, not `merged`. **Tooling outage:** wait and retry, no unauthenticated reads.
8. **Scope creep:** problems outside the epics → proposal or ticket after asking, never an unannounced start.
9. **Stale base:** two PRs touching the same files → merge main into a local copy of the later one and run the affected tests before its gate merge. **Never push while a phase runs on the branch** (also a base merge); after the run check that your commit is on top.
10. **Stale `ai:needs-human`** next to a fresh final analysis and `ai:needs-po-review` = ready to route: check the timestamp is after the answer, route and drop it in one write.
11. **Shared building block in two tickets:** post the directive on both issues before the spec, then the identical contract (names, file, fields, signature) on both draft PRs before implementation; a deviation is a blocking PO comment before the review.
12. **Quota exhausted** (`429 … reset at <time>`, provider zone UTC+8): stops all LLM phases; don't re-arm before the reset; one check-in shortly after, then re-arm all crashed triggers. Non-LLM work (conflict subagent, label fixes) goes on.
13. **Fixing a finding on your own PR yourself:** swap `ai:needs-fixup` for `ai:needs-review` in the same step and post an `<!-- ai-fixup-decisions -->` comment with the fixed-findings table; a thread reply alone causes a false `ai:needs-human`. Fixup round cap with only fixed findings and a green review = conflict detector: resolve the conflict, swap `ai:needs-human` for `ai:needs-review` with a PO comment; a cap with open findings stays with the author.
14. **Blocker merged → automatic re-triage** (only for already analysed issues): don't route before it ends (it drops your trigger); post PO notes right away, route on its `ai:needs-po-review`.
15. **PO decisions for a fixup** go into the thread of the finding (it reads threads, not PR comments). Before a new mandatory UI field check the e2e create flows; prefer a preselected default (one decision broke ~60 specs).
16. **Dead self-hosted runner** (runs `queued`, jobs without log): only the author switches the runner variable; then cancel queued runs and re-arm every affected trigger with two writes.
17. **Comment body `@/tmp/<file>.md`** = posted with `-f body=@…`, content lost; the verdict label counts, report the gap, don't re-run.
18. **Job timeout without soft abort** (`cancelled`, no `ai:continued`): after the second on one issue don't re-arm, propose a split (two or three leaves with a `blocked-by` chain, the issue becomes their container, its draft PR is closed).

## 5. Tool notes

- PR labels come from the PR read, not the issue read. Main CI runs: filter by branch only.
- Large lists: save to a file, read with `jq`. Run logs: fetch the link, `grep` for error, verdict, first failing test.

## 6. Subagents

The coordinator keeps judgement, the author, order, routing, tickets and the check-in chain. Reading and diagnosis go to subagents, one per issue or PR (`gate-runner` for failing runs, `recherche` for code questions).

- **Brief** (self-contained): issue/PR, phase and run ID, what changed, the question, what it may do.
- **May:** read issues, PRs, comments, runs, logs; reproduce locally in a separate worktree; re-run failed jobs once for a documented infrastructure signature.
- **Must not:** set labels, comment, push, create tickets, ask the author — it returns a proposal.
- **Exception, conflict subagent:** own worktree, may push one merge commit to the PR branch (merge main, never rebase/amend/force; keep both sides, regenerate generated files with the repo tooling, canonical gate for the touched packages; only when green and no phase runs on the branch). Product decision needed → push nothing, report.
- **Report:** state (phase, head, CI), finding with evidence, proposed action (exact label set or text), author needed or not.

## 7. Stall ladder

Re-arming what just failed is not coordination. Each rung once; a second failure moves one rung up; never re-arm the same trigger a third time.

1. **Order the shared queue:** at most one issue in spec/implementation/fixup, the others in triage, UX, review. Priority: repair main → fixups → continuations → new implementations. To reorder take the trigger off the waiting issue and put it back later; never cancel a running phase.
2. **Slow provider** (S issue without push after a full run, several soft aborts a day, crashes without verdict): start no new implementations; tell the author once with run IDs and durations, offer the provider switch (their decision).
3. **Two runs without push → stop** (repeated soft abort = `ai:to-big-issue`): small and clear (S, test/config, no product decision) → ask the author to release a local implementation (subagent worktree, canonical gate, PR with `Closes #N`, no labels; then drop stop labels, `ai:needs-review` on the PR); medium or unclear → split (pitfall 18); waiting on a decision → ask.
4. **Infrastructure failure** (setup timeout, installer exit, runner loss): re-arm once, note the signature; a second one the same day goes to the author. A run past 2× its usual duration is diagnosed, not waited out (`GET …/actions/runs/<id>/jobs`, then the job log); a hanging setup step is infrastructure at once.
5. **Park:** rungs 3 and 4 spent, next step neither split nor local → `ai:needs-human` plus one sentence on cause and decision (comment), list it, take it off the slot count, don't touch it until the author answers.
6. **Report throughput:** more than two runs queued or no merge for two hours → tell the author once (cause, queue, rungs, recommendation) before the next re-arm. While only long runs are in flight, check in at their time limit.
