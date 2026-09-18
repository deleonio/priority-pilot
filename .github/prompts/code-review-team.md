FOCUS: daily architecture and code-quality review of this repository (team-of-perspectives method, see METHOD), a running protocol, and — if allowed today — exactly ONE uncritical, valuable fix committed locally. NO push, NO pull request, NO label, NO issue, NO comment (the workflow does the GitHub side effects after you). Save tokens: short, precise, direct.

METHOD: read and follow .claude/skills/code-review-team/SKILL.md (four perspectives, rulebook check, procedure, fix criteria, evidence rules). The protocol skeleton below is binding.

RULE SOURCES (yardstick for the perspectives AND subject of the rulebook check — read them fully yourself, fresh state):
  1. AGENTS.md
  2. .ai-knowledge/project.md
  3. .ai-knowledge/tdd-strategy.md
  4. .ai-knowledge/ux-design.md
  5. docs/arc42.md (section 1.2 ranks the quality goals — the yardstick for Wert; section 10 holds the measurable scenarios)
  6. docs/adr/ (read only — never edit; a conflict with an ADR is a finding, not a fix)
  7. docs/testing.md
  8. docs/mobile-ui-rules.md

CODE SOURCES (subject of the four perspectives): server/src/**, frontend/src/**, .github/scripts/** — broad reads via the `recherche` subagent role (ADR 0008), only file:line candidates back into your context.

FIX ALLOWED TODAY: {{FIX_ALLOWED}}
  - true: you are on branch {{BRANCH}} (reset to main). Implement exactly one fix per METHOD, run the gate once at the end (pnpm format && pnpm lint && pnpm knip && pnpm test), then `git add -A && git commit -m "<conventional-commit-subject>"` — exactly ONE commit, nothing else.
  - false: yesterday's fix is still in the review pipeline. Review and protocol only — do NOT edit files, do NOT commit; note the fix candidate under "Heutiger Fix" as ausgesetzt.

FORBIDDEN in a fix (the workflow rejects the commit): everything under .github/** EXCEPT .github/scripts/** (tested code), pnpm-lock.yaml, any package.json, docs/adr/**, openapi.yml, server/src/db/**. Allowed for a rule consolidation: AGENTS.md, .ai-knowledge/**, docs/*.md. Fix criteria, exclusions and size limit binding per SKILL.md (Fix-Auswahl/Umsetzung); CI orchestration outside the tested scripts is reported only (SKILL.md).

ORDER:
  1. BESTAND FIRST: if {{PROTOCOL_ISSUE_NR}} is not 0, read the body of issue {{PROTOCOL_ISSUE_NR}} (`gh issue view {{PROTOCOL_ISSUE_NR}} --json body --jq .body`) — this is the previous protocol; take over its open F- and V-findings with their numbers. Then `gh issue list --state open --limit 200 --json number,title` and `gh pr list --state open --limit 100 --json number,title,headRefName` as the open-work dedup list.
  2. read ALL rule sources.
  3. code review per METHOD (four perspectives) and rulebook check per METHOD (contradictions, duplicates, vague or outdated rules — with both locations).
  4. consolidation: rank, dedup against open work, resolve carry-over statuses (umgesetzt ONLY after verifying in the code on main).
  5. fix selection and implementation per METHOD, if FIX ALLOWED TODAY is true.
  6. protocol as below.

PROTOCOL (MANDATORY): write via bash heredoc to /tmp/code-review-protokoll.md. The workflow posts this file verbatim as the issue body — WRITE IT IN GERMAN (headings and findings alike). Keep the headings EXACTLY as given (the workflow checks them). Structure:
  # Code-Review-Team — Protokoll (Stand {{REPORT_DATE}})
  ## Methodik
  3-5 lines: perspectives applied, sources read (paths), review scope (which directories, how deep).
  ## Heutiger Fix
  The chosen finding (F-n or V-n), its title, why it is uncritical AND valuable, the commit subject — or `keiner — <Grund>` (nothing qualified) or `ausgesetzt — Vortags-PR noch in der Pipeline` (fix not allowed today).
  PR: (wird vom Workflow eingetragen)
  ## Offene Findings
  Table, ranked by value: `| # | Perspektive | Qualitätsziel | Ort | Finding | Wert | Risiko | Status |` — # = F-n (stable, never reused), Qualitätsziel = one of the Q42 tags listed in docs/arc42.md §1.2 (read the table, do not assume), Ort = Datei:Zeile, Wert = Beitrag zu diesem Ziel (hoch|mittel|gering, gewichtet nach der Priorität des Ziels), Risiko = hoch|mittel|gering, Status = offen|ausgesetzt. Every row names the violated rule (source path) in the Finding cell.
  ## Vorgaben: Widersprüche & Lücken
  Table: `| # | Art | Quelle A | Quelle B | Vorschlag | Status |` — # = V-n (stable), Art = Widerspruch|Dopplung|unkonkret|veraltet, Quelle = Datei:Zeile (Quelle B may be `Code: Datei:Zeile` or `—` for unkonkret), Vorschlag = one line: which location keeps the truth, what is deleted or made concrete. If nothing was found: `keine — Vorgaben konsistent`.
  ## Umgesetzt / Weggefallen
  Carry-over items that left the open list this run: number, status (umgesetzt | weggefallen), one-line reason with evidence. First run: `Erstlauf — keine Übernahme.`
  ## Historie
  One line per run, newest first: `- YYYY-MM-DD · <F-n|V-n|keiner> <Titel> · PR: (wird vom Workflow eingetragen) · <Status>` — carry the previous rows over, keep AT MOST 30 rows, oldest rows fall out.

ONLY evidence-backed findings — every row carries Datei:Zeile and the violated rule; no style nitpicks, no cosmetics.

VERDICT (one line, the very LAST line of your reply):
  - VERDICT: fixed        (protocol written AND exactly one local commit on {{BRANCH}} with a green gate)
  - VERDICT: review-only  (protocol written, no commit — nothing qualified, or fix not allowed today)

HONESTY RULE: output VERDICT: fixed ONLY if `git log origin/main..HEAD --oneline` shows exactly one commit and the gate passed. Output VERDICT: review-only ONLY with zero local commits. Never claim a fix you did not commit.

TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}. Before every step: [ $(date +%s) -ge {{SOFT_DEADLINE}} ]. If OVER during the review: write the protocol with the current state, VERDICT: review-only. If OVER during the fix: `git checkout -- . && git clean -fd` (discard the half-done fix), note it as ausgesetzt, write the protocol, VERDICT: review-only.
