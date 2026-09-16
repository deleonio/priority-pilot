---
name: ux-team
description: "UX-Team — weekly user-centered experience advisory: four perspectives (user advocate, interaction designer, habit analyst, commerce steward) review the app philosophy sources, the user guide and the running app, and produce a ranked report of small improvements for usability and retention. Use for 'ux-team' or 'Wochenblick' (German: weekly UX review)."
---

# Method: UX-Team (weekly user-centered advisory)

A recurring advisory run. The run prompt supplies the source paths (goal sources, work sources) and the report target; this file carries the method only. Read every source fresh at run time — the sources define the goals, nothing about them is baked in here. Advisory only: no code changes, no commits, no labels, no issues, no comments — the run's GitHub side effects are handled outside.

## Perspektiven

Play four perspectives in one moderated session; the moderator (you) collects, filters and ranks. The perspectives judge, they do not invent goals — their yardstick is what the goal sources say, read fresh.

1. Nutzer-Anwalt — steps into concrete situations: hurried, on a phone, first week with the app, returning after weeks away. For every step ask: does this feel like support, or like a form to fill in? Judge by what a person in that situation experiences, not by what the UI technically offers.
2. Interaktions-Designer — checks the same paths against the interaction rules supplied by the run prompt (design language, mobile rules, component choice): thumb zones, touch targets, feedback on async actions, the right component for the job.
3. Gewohnheits-Analyst — looks for what brings users back: a reason to return, visible progress, little friction between two sessions, an aha moment in the first week. Retention grows from repeated positive moments, not from feature count.
4. Monetarisierungs-Wächter — checks commercial flows (upgrades, badges, quotas) against the commerce guidelines supplied by the run prompt: an offer belongs in the moment the user can use it; commerce must not interrupt care.

## Verfahren

1. Bestand: collect what already exists — the previous report (if the run prompt carries an issue number), the list of open issues, and the open findings in the supplied optimization plan. This is the dedup inventory: a finding that duplicates open work is dropped or reduced to a status note. Also read the recorded decisions that cover the walked flows: `docs/adr/`, the matching `docs/spec/issue-*.md`, and the doc comments of the files a finding touches. Behaviour that a recorded decision deliberately chose is not a defect — name it as a decision, link the record, and say what it costs, so the report argues against the decision instead of reporting it as a bug.
2. Quellen lesen: goal sources first, then work sources — all fresh, none skimmed.
3. Live-Gang: walk the key flows of the running app at mobile and desktop width, as named by the run prompt. Collect evidence while walking: screenshots, file and line references, guide passages.
4. Sitzung: each perspective states its view per walked flow. Only observations with evidence stand.
5. Konsolidierung: rank by experience gain versus effort, drop duplicates, resolve carry-over statuses. A carry-over finding that would stand as "offen" for the second time has to leave the queue in this run: it goes into the Umsetzungs-Kandidaten, or it is set to "weggefallen" with a stated reason. A third "offen, unverändert" is not an allowed status — a finding nobody acts on twice is either worth a ticket or not worth carrying.

## Belege

Every finding carries at least one verifiable anchor: a screenshot from the live walkthrough, a file and line reference, or a passage in the guide or rules. Unbacked observations are discarded — the report must survive a skeptical reader.

## Ergebnis

Write the report in German (readers are the German-speaking maintainers) in the structure the run prompt prescribes. Carry-over items keep a status (offen / umgesetzt / weggefallen); "umgesetzt" is only allowed after verification in the live walkthrough or the code. Provide at most three Umsetzungs-Kandidaten, each small enough to become one ticket, drafted in the issue-template structure so a maintainer can paste it directly.

## Haltung

User language, not framework language: name what a person experiences. Small beats grand: every suggestion must fit into one ticket. An empty week is a valid result — say so instead of inventing findings.
