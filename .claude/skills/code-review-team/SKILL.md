---
name: code-review-team
description: "Code-Review-Team — daily architecture and code-quality review by four perspectives (architect, clean-code reviewer, test engineer, ops and security steward) plus a rulebook check that surfaces contradictory or vague project rules; maintains one running review protocol and implements exactly one uncritical, valuable fix per run (code fix or rule consolidation). Use for 'code-review-team', 'Tagesreview' (German: taegliches Code-Review)."
---

# Method: Code-Review-Team (daily architecture and code-quality review)

A recurring review run. The run prompt supplies the rule sources, the code sources, the previous
protocol, whether a fix is allowed today, and where the protocol goes; this file carries the method
only. Read every source fresh at run time — the sources define the rules, nothing about them is
baked in here. The run's GitHub side effects (push, pull request, issue, labels) are handled
outside: the team commits locally at most once and writes the protocol, nothing more.

## Perspektiven

Play four perspectives in one moderated session; the moderator (you) collects, filters and ranks.
The perspectives judge against what the rule sources say — they do not invent rules.

1. Architekt — layers and building blocks, dependency direction, pattern fidelity to neighbouring
   code, conformity with the architecture documentation and the architecture decisions.
2. Clean-Code-Reviewer — duplication that belongs in one abstraction, `any`/`unknown` where a
   precise type exists, needless complexity, dead exports, ESM rules (server imports with `.js`
   suffix), assertions that silence the type checker.
3. Test-Ingenieur — untested critical paths, tautological tests, tests that assert nothing, test
   scope against the project's TDD strategy (a test exists only if it evaluates something).
4. Betriebs- und Sicherheits-Wächter — error handling, logging, input validation, secrets,
   dependency risks, failure modes that stay silent.

## Regelwerk-Prüfung

The moderator carries a fifth duty with no code view of its own: the rules themselves are under
review. For every rule source check

- Widerspruch — two sources say different things (source A vs. source B, or a source vs. the code);
- Dopplung — the same rule lives in two places and has drifted;
- unkonkret — the rule cannot be checked: no yardstick, no example, no observable criterion;
- veraltet — the source describes something the code no longer has.

Every observation names both locations (`Datei:Zeile` and `Datei:Zeile`) and a consolidation
proposal: which location keeps the truth, what is deleted or made concrete. Rules that a code
perspective could not apply because the rule is vague are collected here — never turned into a
code finding by guessing what the rule meant. Architecture decision records are read, never
edited; a conflict with one is reported as a finding only.

## Verfahren

1. Bestand: read the previous protocol (if the run prompt carries one) and take over its open
   findings with their numbers; list open issues and open pull requests. This is the dedup
   inventory: a finding that duplicates open work is dropped or reduced to a status note.
2. Regelquellen lesen: all of them, fresh, none skimmed. This reading feeds both the perspectives
   (their yardstick) and the rulebook check (their subject).
3. Durchsicht: read the code sources. Broad fan-out reads go to the `recherche` subagent role —
   only `file:line` candidates come back into the moderator's context; the judgement stays here.
4. Sitzung: each perspective states its findings, with evidence. The rulebook check reports its
   observations.
5. Konsolidierung: rank by value against risk, drop duplicates, resolve carry-over statuses.
6. Fix-Auswahl and Umsetzung (below), if the run prompt allows a fix today.
7. Protokoll.

## Fix-Auswahl

Exactly one finding becomes today's fix. It must satisfy all of these:

- no observable behaviour change for users;
- no change to the API surface, the database schema or migrations;
- no dependency or workflow change;
- small: as a guide at most 200 changed lines across at most 6 files;
- verifiable with the project's existing gate;
- among the qualifying candidates the one with the highest value.

Two fix classes qualify equally: a code fix (findings of the four perspectives) and a rule
consolidation (findings of the rulebook check: a contradiction resolved, a duplicate merged into one
place, a vague rule made checkable — in the agent instructions, the knowledge base or the
documentation, never in the decision records). On a tie the consolidation wins: a vague rule produces
wrong code findings every following day. If nothing qualifies, there is no fix today — say so.

## Umsetzung

Follow the project's TDD rules. Run the gate once at the end over all changes (`pnpm format`,
`pnpm lint`, `pnpm knip`, `pnpm test`) and fix what it reports. Commit locally exactly once with a
Conventional Commits subject (`refactor(...)`, `test(...)`, `chore(...)`, `docs(...)` for a
consolidation). Never push, never open a pull request.

For a consolidation: one truth per rule — the more specific source keeps it, the other links to it;
no history prose ("früher", "jetzt", "neu"); relative Markdown links only; the knowledge-base index
in the agent instructions stays consistent with the files; German prose, plain and factual.

## Belege

Every finding carries at least one verifiable anchor: a `Datei:Zeile` reference and the rule it
violates (source path). Unbacked observations are discarded — the protocol must survive a sceptical
reader.

## Protokoll

Write the protocol in German (readers are the German-speaking maintainers) in the structure the run
prompt prescribes. Finding numbers are stable across runs and never reused (`F-<n>` for code
findings, `V-<n>` for rule findings). Status vocabulary: `offen`, `umgesetzt`, `ausgesetzt`,
`weggefallen`. `umgesetzt` is only allowed after verification in the code or on the main branch;
`weggefallen` when the code or rule no longer exists or the item now lives in an open ticket. The
history is capped as the run prompt says — the oldest rows fall out.

## Haltung

Small beats grand: every fix fits one small pull request. A day without a fix is a valid result —
say so instead of forcing one. Never inflate findings; the Minimalprinzip applies to the review as
much as to the code. Cosmetics (formatting, comments) are not findings.
