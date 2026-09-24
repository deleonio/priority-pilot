---
name: ticket-tree
description: "Solution plan and issue tree for a larger initiative - research code and external constraints, write the solution plan, cut it into issues of at most medium complexity, wire them under an epic with native blocked-by relations and derive the implementation order (waves, critical path). Use for 'Loesungsplan', 'Issue-Baum', 'Issue Tree', 'Epic planen', 'plane Vorhaben X in Tickets' (German: plan an initiative as a ticket tree)."
argument-hint: "<Vorhaben, z. B. Android-App mit Capacitor>"
---

# Workflow: Ticket tree (solution plan + issue tree)

Vorhaben: $ARGUMENTS

Use when a larger initiative has to become a solution plan plus a set of GitHub issues whose
`blocked-by` relations dictate the implementation order. Every issue is at most **medium**
complexity („Mittel“) and fits into one PR.

Note: this file's prose is English; the plan, the issue bodies and all questions to the author
stay German and follow the [vermenschlichen](../vermenschlichen/SKILL.md) rules.

Not a pipeline phase: it runs locally with the author present. It sets **no pipeline labels**;
each issue enters the pipeline later on its own via `ai:needs-analyse`.

## Step 1 — Collect, and find what already exists

- Read [MEMORY.md](../../../.ai-memory/MEMORY.md).
- Search for earlier planning on the topic before researching anything else — decisions may
  already be made: `grep -ril "<Stichwort>" docs .ai-knowledge` (plans `docs/plan-*.md`, ADRs
  in `docs/adr/`), plus open issues:
  `gh issue list --state open --search "<Stichworte>" --limit 20`.
- **Existing decisions are binding.** Build on them, don't re-litigate them. Anything you add
  on top is marked as an addition (with reason) in the plan.

## Step 2 — Research

- Code facts via the `recherche` subagent (keep only its findings): affected packages and entry
  points, the neighbouring patterns to continue, touchpoints in auth, API contract, data model,
  build, deploy and CI.
- External constraints: platform, store, legal or API rules that force work of their own
  (e.g. store policies such as privacy policy, account deletion, mandatory billing). Verify
  policy details when unsure instead of answering from memory. Each hard constraint becomes an
  issue or an acceptance criterion.
- Ask the author only what blocks the cut (max 3 questions, with options) — e.g. scope of
  stages, a decision without a sensible default. Everything else: pick the conventional default
  and name it in the plan.

## Step 3 — Solution plan

Short, German, in the epic body (Step 7). Contents:

- goal and non-goals
- decisions with the rejected alternative (link an existing plan/ADR instead of copying it)
- target structure (new packages, files, interfaces)
- stages as release increments (what is shippable after each)
- external duties and risks, manual steps outside the repo

Decisions worth keeping beyond the initiative become **ADR issues** at the root of the tree,
not a new plan file. Only update an existing plan doc (link to the epic, note additions).

## Step 4 — Cut into issues (the core)

An issue is **at most „Mittel“** when all of these hold:

- one PR, reviewable in one pass;
- preferably one layer/package (server, frontend, native, website, CI, docs) — a second layer
  only when its part is trivial;
- ≤ ~5 acceptance criteria, each verifiable from outside;
- no open design decision inside — decisions go into an ADR issue that blocks the rest.

Anything „Komplex“, or requirements joined by „und“, gets split further. Merge tiny
same-layer items into one issue instead of creating micro-tickets.

Issue kinds, in typical order:

1. **ADR** — decision work first.
2. **Foundation** — scaffolding every later issue builds on.
3. **Contract before consumer** — server/API issue blocks the UI issue that uses it.
4. **Duties from outside** — e.g. store or legal requirements found in Step 2.
5. **Manual** — accounts, consoles, secrets, first uploads. Title prefix `Manuell:`, body says
   „Aufgabe für den PO, nicht in die Pipeline geben“. They are real blockers, so they belong
   in the graph.
6. **Stage gate** — one manual release/acceptance issue per stage, blocked by all issues of
   that stage.

Body: the ticket template format from [ticket-create](../ticket-create/SKILL.md) Step 4 (all
required fields, `Thema` and `Komplexität` set to `Einfach` or `Mittel`). Under
`Screenshots / weitere Hinweise (optional)` always:

```markdown
Teil von #<Epic>. Blockiert durch #<a>, #<b>.   (oder: Keine Blocker.)
Plan: <Plan-Dokument/Abschnitt, falls vorhanden>
```

Title: names the goal, not the solution, with an area prefix — `ADR NNNN:`, `Server:`,
`Frontend:`, `Website:`, `CI:`, `Manuell:`, or the product surface (e.g. `Android-App:`).

## Step 5 — Dependencies and order

- `blocked-by` **only for real dependencies**: the issue needs an API, table, decision or
  artifact of its predecessor, or an acceptance criterion can't be verified without it. Never
  for mere preference.
- List **direct** blockers only (no transitive ones). No cycles.
- **Waves** = topological levels: wave = 1 + max(wave of the blockers); issues without
  blockers are wave 1. Within a wave, earlier stages go first.
- **Critical path** = the longest blocker chain; name it (per stage, if stages exist).
- Keep wave 1 wide — as many independent starts as the plan allows.

## Step 6 — Confirm

Creating an issue tree is a public GitHub write. Show the plan and a table (title, wave,
blockers, complexity) and wait for the author's go — **unless** the request already explicitly
asked for the issues to be created.

## Step 7 — Create

1. **Epic** without labels, placeholder body („Sammelticket, nicht in die Pipeline geben“).
2. **Sub-issues in wave order** (blockers exist before their successors, and the epic's
   sub-issue list reads as the execution order). Attach each as a real sub-issue — MCP
   `issue_write` with `parent_issue_number`, or via gh:
   `gh api graphql -f query='mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){clientMutationId}}' -f p=<epic-node-id> -f c=<child-node-id>`
3. **Native `blocked-by`** for every pair (successor B is blocked by K):

   ```sh
   REPO=<owner/repo>
   while read -r B K; do
     gh api -X POST "repos/$REPO/issues/$B/dependencies/blocked_by" \
       -F issue_id="$(gh api "repos/$REPO/issues/$K" --jq .id)"
   done <<'EOF'
   <B> <K>
   EOF
   ```

   The GitHub MCP tools cannot set issue dependencies. In a session without `gh`, hand this
   block with all pairs to the author to run locally; the „Blockiert durch“ line in each body
   is the fallback until then.
4. **Final epic body:** plan (Step 3), wave table (stage columns if stages exist), critical
   path, a Mermaid graph (`graph LR`, edge = „blockiert“, node labels without `#`), and the
   start notes below.
5. **Check:** sub-issue count matches the table; spot-check a few relations with
   `gh api "repos/$REPO/issues/<B>/dependencies/blocked_by" --jq '.[].number'`.

Start notes for the epic:

- Set `ai:needs-analyse` only on issues whose blockers are all closed (wave 1 at first).
- After a merge, the automatic unblocking only frees successors that already carry
  `ai:analysed` and have the native relation — others are started by hand once unblocked.
- Manual issues and the epic itself never go into the pipeline.

## Step 8 — Report

In German, short: epic URL, number of issues, waves in one line each, critical path, open
decisions for the PO, and anything the author still has to do (e.g. run the blocked-by block).

## Notes

- Never set pipeline labels; never modify issues that already existed before this run.
- If an existing plan doc exists, add a short pointer to the epic there (docs change → PR).
- Splitting a **single existing** oversized issue is [ticket-triage](../ticket-triage/SKILL.md)'s
  job; a single new ticket is [ticket-create](../ticket-create/SKILL.md)'s.
