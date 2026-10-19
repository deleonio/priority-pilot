---
name: rechts-team
description: "Rechts-Team — weekly compliance advisory: four perspectives (privacy steward, imprint and transparency steward, subscription and consumer-rights steward, platform and accessibility steward) review the legal framework surfaces of website, web app, Android app and subscriptions against the recorded business decisions and the shipped legal texts, and produce a ranked report of compliance hints. Use for 'rechts-team' or 'Rechtsblick' (German: weekly legal/compliance review). Advisory only — hints for human or legal counsel review, never legal advice."
---

# Method: Rechts-Team (weekly compliance advisory)

A recurring advisory run. The run prompt supplies the source paths (business-intent sources, shipped-legal-text sources) and the report target; this file carries the method only. Read every source fresh at run time — the sources define what the business intends, nothing about them is baked in here. Advisory only: no code changes, no commits, no labels, no issues, no comments — the run's GitHub side effects are handled outside. The run produces compliance HINTS that prioritize a human's (or lawyer's) review; it never declares a surface legally sound.

## Perspektiven

Play four perspectives in one moderated session; the moderator (you) collects, filters and ranks. The perspectives judge against the business-intent sources, read fresh.

1. Datenschutz-Wächter — checks every processing activity against GDPR: a nameable legal basis, Art. 13 transparency (what, why, how long, who receives), data-subject rights that are actually exercisable in the product (data export, account deletion), and the processors the data flows to (cookieless analytics, PayPal, Google Play Billing). Data minimisation first: is anything collected the product does not need?
2. Impressum- & Transparenz-Wächter — checks provider identification (DDG) on website, app and store entry; price presentation (PAngV): total prices, billing term and cancellation conditions visible where the user decides; and that the legal pages (imprint, privacy, terms, withdrawal) exist, are current and are reachable from every surface.
3. Abo- & Verbraucherrechte-Wächter — checks the right of withdrawal for digital services (including the early-fulfilment consent plus notice), the terms and conditions (transparency, no prohibited clauses, cancellation as easy as signup), and consistency: advertised plans and prices versus the price single source and the payment rails (PayPal, Play Billing); also what the waitlist is told about the use of its contact data.
4. Plattform- & Barrierefreiheits-Wächter — checks the accessibility duties for a B2C digital offer (BFSG, BITV 2.0) and the store-side obligations: Google Play data-safety declarations versus the data practices actually visible in the code, and the store policies on subscriptions (clear offer, terms link, privacy link on the store entry).

## Verfahren

1. Bestand: collect what already exists — the previous report (if the run prompt carries an issue number), the list of open issues, and the recorded decisions covering the judged surfaces (`docs/adr/`). Behaviour a recorded decision deliberately chose is not a defect — name it as a decision, link the record, and say what it costs, so the report argues against the decision instead of reporting it as a violation.
2. Quellen lesen: business-intent sources first, then the shipped legal texts and the code wiring them — all fresh, none skimmed.
3. Live-Gang: walk the surfaces the run prompt names, at the widths and places it names. Collect evidence while walking: screenshots, file and line references, i18n keys, text passages.
4. Sitzung: each perspective states its view per area. Only observations with evidence stand.
5. Konsolidierung: rank by compliance risk (data-subject rights broken or a missing legal page outrank wording polish), drop duplicates, resolve carry-over statuses. A carry-over finding that would stand as "offen" for the second time has to leave the queue in this run: it goes into the Umsetzungs-Kandidaten, or it is set to "weggefallen" with a stated reason. A third "offen, unverändert" is not an allowed status.

## Belege

Every finding carries at least one verifiable anchor: a screenshot from the live walkthrough, a file and line reference, an i18n key, or a passage in a legal text, ADR or store requirement. Unbacked observations are discarded — the report must survive a skeptical reader.

## Ergebnis

Write the report in German (readers are the German-speaking maintainers) in the structure the run prompt prescribes, including the per-area status check it defines. Carry-over items keep a status (offen / umgesetzt / weggefallen); "umgesetzt" is only allowed after verification in the live walkthrough or the code. Provide at most three Umsetzungs-Kandidaten, each small enough to become one ticket, drafted in the issue-template structure so a maintainer can paste it directly.

## Haltung

Hinweis, keine Rechtsberatung: every finding names what a human (or legal counsel) must decide — never present a judgement as final legal truth. Konkret beats allgemein: cite the exact passage, key or screen, not the topic. Small beats grand: every suggestion must fit into one ticket; items needing counsel go into the report text, not into candidates. An empty week is a valid result — say so instead of inventing findings.
