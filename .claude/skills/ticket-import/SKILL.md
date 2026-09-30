---
name: ticket-import
description: "Ticket import - turn a source document (Claude Docs doc, review notes, meeting notes, feature list) into template-conformant GitHub issues under one epic: enumerate every idea, match it against existing issues and the code, create only what is missing, wire sub-issues and native blocked-by relations, report an overview table. Use for 'Tickets aus Dokument', 'erstelle Tickets aus dem Doc', 'Sammelticket aus Notizen' (German: create tickets from a document)."
argument-hint: "<Link oder Name des Dokuments, optional Titel des Sammeltickets>"
---

# Workflow: Ticket import (document → issues under an epic)

Quelle: $ARGUMENTS

Use when an author hands over a document with many loose ideas (a review, meeting notes, a
wish list) and wants them as issues under one collective ticket. Unlike
[ticket-tree](../ticket-tree/SKILL.md) the content is already decided by the document — there
is no solution plan to write; the work is completeness, deduplication against what exists,
and the dependency wiring.

Note: this file's prose is English; issue bodies, the overview table and all questions to the
author stay German and follow the [vermenschlichen](../vermenschlichen/SKILL.md) rules.

Not a pipeline phase: it runs locally with the author present. It sets **no pipeline labels**.

## Step 1 — Get the document

- **Claude Docs:** a doc is only reachable by its link or id — there is no search by title and
  no list of docs. No link → offer the ways that don't need pasting: the author sends a doc
  comment to Claude (the comment turn carries the doc link), copies the URL from the browser
  instead of the app, or dictates the id at the end of the URL. Read the doc (`read` on the
  project, then the tab body without `projection` for the full text) and list its comment
  threads — an unanswered question there becomes an open question in the matching issue.
- **Other sources** (file in the repo, pasted text): read it whole.
- Read [MEMORY.md](../../../.ai-memory/MEMORY.md).

## Step 2 — Enumerate every idea

Number each actionable idea (one row per idea, not per heading). Keep the author's grouping as
the area column. Count them and state the count — the author checks it against their own; a
mismatch means an idea was merged or dropped silently. Ideas the author adds in chat get
their own row, marked as not from the document.

## Step 3 — Match against existing issues and code

Per idea, in parallel where possible:

- **Issues:** search open and closed issues with 2–3 distinctive keywords.
- **Code:** check whether the behaviour already exists, fully or in part (delegate the sweep to
  the `recherche`/`Explore` subagent; if it doesn't return, run targeted greps yourself — never
  wait idle).

Classify each row:

| Class | Action |
| --- | --- |
| new | create an issue |
| open issue exists | don't duplicate; attach it to the epic (Step 6) |
| done issue exists | no issue; name it in the epic as already done |
| partly in code | create an issue scoped to the gap, or as a check-and-prove issue (like the "Nachweis" style of earlier issues); name what exists under hints |
| decision only (price, legal text, strategy) | `Manuell:` issue for the PO, "nicht in die Pipeline geben" |
| document contradicts the code or docs | create the issue, put the contradiction as an open question with a proposal |

## Step 4 — Show the overview

One table: number, area, idea, planned issue type/prefix, status (planned / exists #N /
done #N / open question). List open questions below it (max 4, each with a proposal). The
author's explicit request to create counts as the go; otherwise wait for it.

## Step 5 — Draft the bodies

Body and quality bar exactly as in [ticket-create](../ticket-create/SKILL.md) Step 4 (template
headings, checkable `-` bullets, no vague wording). Additionally:

- Title with area prefix as in [ticket-tree](../ticket-tree/SKILL.md) Step 4 (`Server:`,
  `Frontend:`, `Website:`, `Android-App:`, `Manuell:`, `Doku:` …), naming the goal.
- Hints section starts with `Teil von #<Epic>. Blockiert durch #a, #b.` (or `Keine Blocker.`),
  then what exists in code (paths), related issues, open questions with a proposal.
- Complexity at most „Mittel“; a larger idea is split, or the hint asks triage to check a split.
- Numbers in acceptance criteria are computed, not guessed (prices, pro-rata amounts).

## Step 6 — Dependencies, create, wire

- `blocked-by` only for real dependencies (ticket-tree Step 5). Typical ones: a legal text
  before the consent step that links it; a documented UX rule before the UI issues that apply
  it; an ordering issue after the issues that change the set being ordered.
- Create the epic first if it doesn't exist (placeholder body), then the issues in wave order
  with `parent_issue_number` — so blockers have numbers before their successors are written.
- Existing open issues: an issue has only **one** parent. Moving one under the new epic
  removes it from its old epic — ask the author first; if yes, `sub_issue_write` with
  `replace_parent: true` (needs the issue's numeric id, not its number).
- Native blocked-by per pair — with `gh`: the loop in ticket-tree Step 7. Without `gh`, via REST
  with the session token; the `Content-Type: application/json` header is mandatory (without it
  the call fails with 415):

  ```sh
  curl -sS -X POST -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    "https://api.github.com/repos/<owner>/<repo>/issues/<B>/dependencies/blocked_by" \
    -d "{\"issue_id\": <numeric id of K>}"
  ```

- Verify: `GET …/issues/<B>/dependencies/blocked_by` per successor, `GET …/issues/<Epic>/sub_issues`
  count equals the table.
- Hierarchy stays flat (epic → issues). A sub-epic only when one area has its own stages and
  enough issues to be coordinated on its own.

## Step 7 — Epic body and report

Epic body: source of the ideas, overview table by area, wave table, critical path, Mermaid
graph (`graph LR`, edge = „blockiert“), start notes — same parts as ticket-tree Step 7.

Report in German, short: epic link, one table (idea → issue, wave, blockers), what was not
created and why (exists/done), open questions for the PO.

## Notes

- Never set pipeline labels; never edit the body of an issue that existed before this run
  (re-parenting after the author's go is fine).
- Don't answer comments in the source document on the author's behalf — carry them into the
  issues as open questions.
- A single new ticket is [ticket-create](../ticket-create/SKILL.md)'s job; a new initiative
  without a finished idea list is [ticket-tree](../ticket-tree/SKILL.md)'s.
