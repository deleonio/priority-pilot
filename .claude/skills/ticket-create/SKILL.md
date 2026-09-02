---
name: ticket-create
description: "Ticket creation — guide a human author through the ticket template, ask targeted follow-up questions before submitting, and draft a body that passes the mechanical quality check on first try. Use for 'create a ticket', 'new issue', 'file a ticket' (German: 'Ticket erstellen', 'neues Ticket', 'Ticket anlegen')."
---

# Workflow: Ticket create (guided authoring)

Use when a human wants to file a new GitHub issue — collect what they already have, ask the
follow-up questions the pipeline would otherwise bounce the ticket for, and draft a body that
follows [.github/ISSUE_TEMPLATE/ticket.yml](../../../.github/ISSUE_TEMPLATE/ticket.yml) and
passes the mechanical PRECHECK
([verify-issue-quality.sh](../../../.github/scripts/verify-issue-quality.sh)) first try.

Note: this file's prose is English; every question to the author and the finished ticket body
stay German — the author is the live counterpart, and the ticket is read by German-speaking
contributors plus the analysis phase. Ticket text follows the
[vermenschlichen](../vermenschlichen/SKILL.md) rules: natural, factual wording, no AI-typical
patterns.

Not a pipeline phase: it runs locally in a session with the author present, before any label
exists. It sets no labels, writes no comments, no harness state — the pipeline still starts
manually via `ai:needs-analyse`.

**Plan mode (optional):** when the session runs with an active plan-mode contract, deliver the
Step 3 questions via the structured questionnaire (max 3, each with 2–4 options) and the Step 4
draft via the plan-completion step — the plan approval then enforces Step 5's explicit go
mechanically. Outside plan mode, ask and draft in chat as described below. This skill never
requires plan mode.

## Step 1 — Collect what exists

Let the author dump context freely — half sentences, bullet points, a voice-note style brain
dump all count. Don't force field order, don't interrogate yet. An existing draft text counts
as input, not as a finished body.

Repo research (does the problem already exist in the code? where roughly?) may be delegated to
a `scout` subagent — same pattern as `/gather-context-and-clarify`. Its findings sharpen the
follow-up questions; keep only the findings in context.

## Step 1b — Duplicate check

Before drafting, search open issues with 2–3 distinctive keywords from the dump:

```sh
gh issue list --state open --search "<Stichworte>" --limit 10
```

On hits, show them and let the author decide (in German): **Duplikat** → stop, link the
existing issue instead; **verwandt** → create, and put the related issue's URL under
„Screenshots / weitere Hinweise (optional)“; **trotzdem anlegen** → continue.

## Step 2 — Map & gap check

Sort the input into the template fields (labels and order byte-compatible with what GitHub
issue forms emit — the PRECHECK matches on these headings):

| Template field | Required | Captures |
| --- | --- | --- |
| `Was ist das Problem?` | yes | observed behavior — what happens, where, for whom |
| `Wo tritt es auf?` | yes | one place per line — page, component, endpoint (user-level wording is fine) |
| `Wie soll es sein?` | yes | expected behavior — observable from outside, not a technical solution |
| `Thema (optional)` | no | dropdown value: UX/UI, Feature, Test, Logik, Performance, Security, Documentation, Infrastructure, Other |
| `Komplexität (optional)` | no | dropdown value: Einfach, Mittel, Komplex |
| `Woran messen wir das?` | yes | at least one `-` bullet, externally checkable |
| `Screenshots / weitere Hinweise (optional)` | no | anything else the author has |

Quality bar (mirrors the PRECHECK, [verify-issue-quality.sh](../../../.github/scripts/verify-issue-quality.sh)):

- every required field ≥ 10 characters of real text
- `Woran messen wir das?` ≥ 1 `-` bullet that a third party can verify from outside
- no vague wording (irgendwie, einfach mal, besser machen, verschönern, irgendwas,
  „geht nicht/funzt nicht") in problem/expected
- optional dropdowns only with the exact template values

## Step 3 — Follow-up questions (the point of this skill)

Ask **only** what measurably improves the ticket — each question must change what lands in the
body. Rules: max **3 questions per round**, each with concrete answer options where possible,
at most **two rounds**, then draft with what exists.

Ask when:

1. **Observation is an interpretation** — „die App fühlt sich langsam an" → what exactly is
   seen, where, since when, how often?
2. **Expected field holds a solution** — „wir sollten React Query nutzen" → ask for the
   observable outcome instead; the how is the pipeline's job.
3. **Criteria aren't checkable** — „es funktioniert besser" → propose draft bullets derived
   from problem/expected and let the author confirm/strike/adjust (cheapest for the author).
4. **Multiple independent requirements in one ticket** → propose splitting into 2+ tickets
   (same criterion as triage's split rule: multiple layers or "and"-joined criteria).
5. **Place unclear** — nothing indicates where → ask for page/component/endpoint in user
   language.
6. **Decision-relevant context missing** — e.g. affects everyone vs. mobile only, workaround
   exists → only if it changes scope or priority.

Never ask:

- anything the repo answers (affected files, existing patterns — that's triage's job);
  the author gives user-level places („Einstellungen → Push-Benachrichtigungen"), no paths
- leading questions that add scope the author never mentioned
- everything at once, or questions whose answer wouldn't change the ticket

## Step 4 — Draft

Title: short, content-true, names the goal not the solution (same bar as triage's title
check). Show the full body before creating anything:

```markdown
### Was ist das Problem?

<one sentence, observed>

### Wo tritt es auf?

<one place per line>

### Wie soll es sein?

<expected, observable from outside, no solution>

### Thema (optional)

<dropdown value>

### Komplexität (optional)

<dropdown value>

### Woran messen wir das?

- <checkable bullet, at least one>

### Screenshots / weitere Hinweise (optional)

<only if provided>
```

Optional fields are omitted entirely when empty (GitHub forms omit them the same way). If the
input was split into several tickets: one draft per ticket.

## Step 5 — Create (only after explicit confirmation)

Creating is a public GitHub write — get the author's go before executing:

```sh
gh issue create --title "<title>" --body-file - <<'BODY'
<body as drafted>
BODY
```

Afterwards report only the issue URL. No labels, no pipeline trigger, no comment.

## Notes

- Never create or modify an issue without the author's explicit go.
- A required field that stays empty after two question rounds → say so and stop; don't paper
  over it with filler text — the PRECHECK would bounce it anyway.
- Analyzing, copyediting, or splitting **existing** issues is
  [ticket-triage](../ticket-triage/SKILL.md)'s job.
